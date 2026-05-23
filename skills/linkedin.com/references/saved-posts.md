# LinkedIn — Saved Posts Reference

## Requirements

**Auth:** Required. Saved posts are private to the logged-in user. Ask the user for their `li_at` session cookie (DevTools → Application → Cookies → `li_at`). Inject before navigating:

```js
await context.addCookies([{
  name: 'li_at', value: '<user-provided>', domain: '.linkedin.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Browser:** Required. Page is client-side rendered and requires an active session.

## How to run

Navigate to the saved posts page, then execute via `page.evaluate()` or chrome-bridge `/run-action`:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ maxScrolls: 20, mode: "markdown" });
}, scriptCode);

const output = result.content[0].text;
```

Modes:
- `"data"` — JSON array of post objects
- `"display"` — self-contained dark-theme HTML card list
- `"markdown"` — filtered markdown digest, one post per heading

---

## Action: saved-posts

**Navigate to:** `https://www.linkedin.com/my-items/saved-posts/`

**Code:**

```js
({
  name: "linkedin-saved-posts",
  description: "Extract saved posts from LinkedIn, with auto-scroll, see-more expansion, topic tagging, and optional regex filter. Returns JSON, HTML, or markdown digest.",
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["data", "display", "markdown"],
        description: "Output mode. data=JSON array, display=HTML cards, markdown=filtered digest (default: data)"
      },
      maxScrolls: {
        type: "number",
        description: "Max scroll iterations before stopping (default: 50). Each scroll waits scrollPause ms."
      },
      scrollPause: {
        type: "number",
        description: "Milliseconds to wait between scrolls (default: 1200)."
      },
      stableRounds: {
        type: "number",
        description: "Stop scrolling after this many rounds with no new posts (default: 3)."
      },
      maxPosts: {
        type: "number",
        description: "Stop after collecting this many posts. 0 = unlimited (default: 0)."
      },
      expandSeeMore: {
        type: "boolean",
        description: "Click 'see more' buttons to expand truncated post bodies (default: true)."
      },
      filterPattern: {
        type: "string",
        description: "Regex pattern (case-insensitive) to filter posts. Only matching posts included in markdown output. Empty = include all."
      },
      tags: {
        type: "string",
        description: "JSON object mapping tag names to regex patterns. Pattern strings may include flags with /pattern/flags syntax. Replaces the built-in tag set when provided. Example: {\"ClaudeCode\":\"/claude.?code|mcp/i\",\"Startup\":\"/founder|saas/i\"}"
      }
    }
  },
  execute: async function(params) {
    var mode = (params && params.mode) || "data";
    var maxScrolls = (params && params.maxScrolls != null) ? params.maxScrolls : 50;
    var scrollPause = (params && params.scrollPause != null) ? params.scrollPause : 1200;
    var stableRounds = (params && params.stableRounds != null) ? params.stableRounds : 3;
    var maxPosts = (params && params.maxPosts != null) ? params.maxPosts : 0;
    var expandSeeMore = (params && params.expandSeeMore != null) ? params.expandSeeMore : true;
    var filterPattern = (params && params.filterPattern) || "";

    // Build TAGS from params.tags (JSON string) or fall back to built-in defaults.
    // Pattern values accept either a plain string (treated as case-insensitive) or
    // "/pattern/flags" notation, e.g. "/claude.?code|mcp/i".
    var TAGS;
    if (params && params.tags) {
      TAGS = {};
      try {
        var raw = (typeof params.tags === "string") ? JSON.parse(params.tags) : params.tags;
        var rawKeys = Object.keys(raw);
        for (var rk = 0; rk < rawKeys.length; rk++) {
          var val = raw[rawKeys[rk]];
          var m = (typeof val === "string") ? val.match(/^\/(.+)\/([gimsuy]*)$/) : null;
          TAGS[rawKeys[rk]] = m ? new RegExp(m[1], m[2] || "i") : new RegExp(val, "i");
        }
      } catch(e) { TAGS = {}; }
    } else {
      TAGS = {
        "AI/ML":      /\b(ai|machine.?learning|llm|gpt|claude|gemini|deep.?learning|neural|transformer|rag|agent)\b/i,
        "Career":     /\b(hiring|job|career|interview|promotion|resume|cv|recruiter|layoff|offer)\b/i,
        "Leadership": /\b(leadership|management|ceo|founder|startup|culture|team|mentor)\b/i,
        "Product":    /\b(product|roadmap|launch|feature|ux|design|saas|b2b|gtm)\b/i,
        "Dev":        /\b(javascript|python|typescript|react|node|git|docker|kubernetes|api|backend|frontend)\b/i,
        "Marketing":  /\b(marketing|seo|content|brand|growth|funnel|email|campaign)\b/i
      };
    }

    var sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

    // Click all visible "…see more" buttons
    var clickSeeMore = function() {
      var btns = document.querySelectorAll("button");
      for (var b = 0; b < btns.length; b++) {
        var txt = btns[b].textContent.trim();
        if (txt === "…see more" || txt === "see more") {
          try { btns[b].click(); } catch(e) {}
        }
      }
    };

    // Auto-scroll loop to load lazy posts
    var stableCount = 0;
    var prevCount = 0;
    for (var s = 0; s < maxScrolls; s++) {
      if (expandSeeMore) clickSeeMore();
      var curCount = document.querySelectorAll("[data-chameleon-result-urn]").length;
      if (maxPosts > 0 && curCount >= maxPosts) break;
      if (curCount === prevCount) {
        stableCount++;
        if (stableCount >= stableRounds) break;
      } else {
        stableCount = 0;
        prevCount = curCount;
      }
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(scrollPause);
    }
    // Final expansion pass after all scrolling
    if (expandSeeMore) { clickSeeMore(); await sleep(300); }

    // Extract posts using innerText line parsing.
    // LinkedIn 2025 Chameleon DOM: [data-chameleon-result-urn] is the stable post card anchor.
    // All class names are obfuscated hashes — innerText line parsing is the only reliable approach.
    //
    // Card line structure (variable due to "Status is online" indicator that may prepend):
    //   anchor: "View <author>'s profile" line always present — author is the line before it
    //   after anchor: "• Nth" degree badge, then headline, then "<age> •" timestamp
    //   after timestamp: "<age> Visible to everyone" privacy line, then body
    //   last body line may be "…see more" if truncated

    var isViewProfile = function(l) { return l.indexOf("View ") === 0 && l.indexOf(" profile") === l.length - 8; };
    var isDegree = function(l) { return /^•\s*(1st|2nd|3rd)$/i.test(l); };
    var isTimestamp = function(l) { return /^\d+[smhwdm]+\s*•\s*$/.test(l); };
    var isVisibility = function(l) { return /Visible to|sponsored|promoted/i.test(l); };
    var isSkipLine = function(l) { return /^Status is (online|offline)$/i.test(l) || isViewProfile(l) || isDegree(l); };

    var cards = document.querySelectorAll("[data-chameleon-result-urn]");
    var posts = [];

    for (var i = 0; i < cards.length; i++) {
      if (maxPosts > 0 && posts.length >= maxPosts) break;
      var card = cards[i];
      var post = { index: posts.length + 1 };

      // URN → permalink
      post.urn = card.getAttribute("data-chameleon-result-urn") || "";
      var actId = post.urn.replace("urn:li:activity:", "").replace(/\D/g, "");
      post.permalink = actId
        ? "https://www.linkedin.com/feed/update/urn:li:activity:" + actId + "/"
        : "";

      // Parse innerText lines
      var lines = card.innerText.split("\n")
        .map(function(l) { return l.trim(); })
        .filter(function(l) { return l.length > 0; });

      // Find "View X's profile" anchor — author is the line immediately before it
      var viewIdx = -1;
      for (var vi = 0; vi < lines.length; vi++) {
        if (isViewProfile(lines[vi])) { viewIdx = vi; break; }
      }

      if (viewIdx > 0) {
        post.author = lines[viewIdx - 1];
      } else {
        post.author = lines[0] || "";
      }

      // After viewIdx: skip degree badge, take headline, find timestamp
      var cursor = (viewIdx > -1) ? viewIdx + 1 : 2;
      if (cursor < lines.length && isDegree(lines[cursor])) cursor++;
      post.authorHeadline = (cursor < lines.length) ? lines[cursor] : "";
      cursor++;

      // Timestamp: next line matching "22h •" pattern
      post.timestamp = "";
      if (cursor < lines.length && isTimestamp(lines[cursor])) {
        post.timestamp = lines[cursor].replace(/\s*•\s*$/, "").trim();
        cursor++;
      }
      // Skip visibility line ("1h Visible to everyone")
      if (cursor < lines.length && isVisibility(lines[cursor])) cursor++;

      // Body: remaining lines, drop trailing "…see more"
      var bodyLines = lines.slice(cursor);
      if (bodyLines.length > 0 && /^[…\.]*\s*see more$/i.test(bodyLines[bodyLines.length - 1])) {
        bodyLines = bodyLines.slice(0, bodyLines.length - 1);
      }
      post.body = bodyLines.join("\n").trim();

      // Preview image — first non-avatar img inside the card
      var imgs = card.querySelectorAll("img");
      post.previewImg = "";
      for (var im = 0; im < imgs.length; im++) {
        var src = imgs[im].src || "";
        if (src && src.indexOf("data:") === -1 && src.indexOf("profile-displayphoto") === -1 && src.indexOf("ghost-person") === -1) {
          post.previewImg = src;
          break;
        }
      }

      // Media type detection via links/structure
      post.mediaType = "text";
      if (card.querySelector("video")) post.mediaType = "video";
      else if (post.previewImg && !post.previewImg.includes("/article-")) {
        // articles have article- in their img URL pattern; images don't
        var articleLink = card.querySelector("a[href*='/pulse/'], a[href*='/articles/']");
        if (articleLink) post.mediaType = "article";
        else if (post.previewImg) post.mediaType = "image";
      }

      // Auto-tag from body + headline
      var searchText = post.body + " " + post.authorHeadline;
      post.tags = [];
      var tagKeys = Object.keys(TAGS);
      for (var t = 0; t < tagKeys.length; t++) {
        if (TAGS[tagKeys[t]].test(searchText)) post.tags.push(tagKeys[t]);
      }

      posts.push(post);
    }

    // Apply filter
    var filterRe = filterPattern ? new RegExp(filterPattern, "i") : null;
    var filtered = filterRe
      ? posts.filter(function(p) { return filterRe.test(p.body) || filterRe.test(p.author) || filterRe.test(p.tags.join(" ")); })
      : posts;

    // ── markdown mode ────────────────────────────────────────────────────────
    if (mode === "markdown") {
      var md = "# LinkedIn Saved Posts\n\n";
      md += "_Extracted: " + new Date().toISOString().slice(0, 10);
      md += " · " + filtered.length + " of " + posts.length + " posts";
      if (filterRe) md += " (filter: `" + filterPattern + "`)";
      md += "_\n\n---\n\n";
      for (var m = 0; m < filtered.length; m++) {
        var p = filtered[m];
        md += "## " + (p.author || "Unknown author") + "\n";
        if (p.authorHeadline) md += "_" + p.authorHeadline + "_\n\n";
        if (p.timestamp) md += "**" + p.timestamp + "**";
        if (p.mediaType !== "text") md += " · `" + p.mediaType + "`";
        if (p.tags.length) md += " · " + p.tags.map(function(tg) { return "#" + tg.replace(/[^a-zA-Z0-9]/g, ""); }).join(" ");
        md += "\n\n";
        md += p.body.slice(0, 600);
        if (p.body.length > 600) md += "\n…";
        md += "\n\n";
        if (p.permalink) md += "[View post](" + p.permalink + ")\n\n";
        md += "---\n\n";
      }
      return { content: [{ type: "text", text: md }] };
    }

    // ── display mode ─────────────────────────────────────────────────────────
    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:720px;margin:0 auto;\">";
      h += "<h2 style=\"color:#fff;margin:0 0 4px;\">LinkedIn Saved Posts</h2>";
      h += "<p style=\"color:#888;margin:0 0 24px;font-size:13px;\">" + filtered.length + " posts" + (filterRe ? " matching <code>" + filterPattern + "</code>" : "") + "</p>";
      for (var d = 0; d < filtered.length; d++) {
        var dp = filtered[d];
        h += "<div style=\"padding:16px;margin-bottom:12px;background:#1a1a1a;border-radius:8px;\">";
        if (dp.previewImg) h += "<img src=\"" + dp.previewImg + "\" style=\"width:100%;height:160px;object-fit:cover;border-radius:4px;margin-bottom:12px;display:block;\">";
        h += "<div style=\"font-weight:600;color:#fff;\">" + (dp.author || "Unknown") + "</div>";
        if (dp.authorHeadline) h += "<div style=\"font-size:12px;color:#888;margin-bottom:8px;\">" + dp.authorHeadline.slice(0, 100) + "</div>";
        h += "<div style=\"font-size:13px;line-height:1.6;margin:8px 0;\">" + dp.body.slice(0, 400) + (dp.body.length > 400 ? "…" : "") + "</div>";
        if (dp.tags.length) {
          h += "<div style=\"margin-top:8px;\">";
          for (var tgi = 0; tgi < dp.tags.length; tgi++) {
            h += "<span style=\"background:#0a66c2;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;margin-right:4px;\">" + dp.tags[tgi] + "</span>";
          }
          h += "</div>";
        }
        if (dp.permalink) h += "<div style=\"margin-top:10px;\"><a href=\"" + dp.permalink + "\" style=\"color:#70b5f9;font-size:12px;\">View post →</a></div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    // ── data mode (default) ───────────────────────────────────────────────────
    return { content: [{ type: "text", text: JSON.stringify({ total: posts.length, filtered: filtered.length, filterPattern: filterPattern || null, posts: filtered }, null, 2) }] };
  }
})
```

**Returns:**
- `data` mode: `{ total, filtered, filterPattern, posts: [{ index, urn, permalink, author, authorHeadline, timestamp, body, mediaType, previewImg, tags }] }`
- `markdown` mode: ready-to-paste markdown digest
- `display` mode: self-contained dark-theme HTML

**Notes:**
- Uses `[data-chameleon-result-urn]` as the stable DOM anchor — LinkedIn 2025's Chameleon design system exposes this attribute consistently across saved post cards.
- All CSS class names are obfuscated hashes; extraction relies entirely on `innerText` line parsing anchored to the stable "View X's profile" line. The line before it is always the author name; subsequent lines yield headline, timestamp, and body regardless of optional "Status is online" prefix lines.
- Auto-scroll loads lazily rendered posts. Increase `maxScrolls` for large saved collections (each scroll adds ~5–8 posts).
- `filterPattern` is a case-insensitive regex matched against body text, author name, and tags.
- The `li_at` cookie is required; LinkedIn redirects unauthenticated requests to the login page.

---

## Reporting issues

If this breaks (LinkedIn changes their DOM or section ids), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `linkedin.com` `saved-posts`.
