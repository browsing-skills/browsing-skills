# Substack — Post Data Reference

## Requirements

**Auth:** Not required for public posts. Subscriber-only (paywalled) posts will return only the preview/teaser body. Most Substack posts are fully public.

**Browser:** A real browser or plain fetch. Substack is server-rendered so full post content is present in the initial HTML.

## How to run this action

Navigate first, wait until the post has fully rendered, then execute the code via `page.evaluate()` or Chrome Bridge `/run-action`.

---

## Action: post-data

Use when the user wants the full content of a single Substack post.

**Navigate to:** `https://<publication>.substack.com/p/<slug>`

Examples: `https://stratechery.substack.com/p/why-openai-is-so-powerful`, `https://lenny.substack.com/p/building-great-products`.

**Code:**

```js
({
  name: "substack-post-data",
  description: "Extract a Substack post: title, subtitle, author, date, full body text, like count, comment count",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display", "markdown"] }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";

    function clean(s) { return (s || "").replace(/\s+/g, " ").trim(); }
    function cleanMultiline(s) { return (s || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim(); }
    function esc(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function textOf(selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (el) { var t = clean(el.innerText || el.textContent); if (t) return t; }
      }
      return "";
    }
    function numFrom(v) {
      var n = parseInt(String(v || "").replace(/[^0-9]/g, ""), 10);
      return isNaN(n) ? null : n;
    }

    // JSON-LD — most reliable on custom-domain Substack pages (no time elements, no class-based selectors)
    var jsonLdData = {};
    var jsonLdEl = document.querySelector('script[type="application/ld+json"]');
    if (jsonLdEl) {
      try {
        var parsed = JSON.parse(jsonLdEl.textContent);
        jsonLdData.title = parsed.headline || "";
        jsonLdData.subtitle = parsed.description || "";
        jsonLdData.date = parsed.datePublished || "";
        if (parsed.author) {
          jsonLdData.author = Array.isArray(parsed.author) ? parsed.author[0].name : (parsed.author.name || parsed.author);
        }
      } catch (e2) {}
    }

    // Title
    var title = jsonLdData.title || textOf(["h1.post-title", "h1[class*='post-title']", "h1[class*='postTitle']", "h1"]);

    // Subtitle
    var subtitle = jsonLdData.subtitle || textOf([
      "h3.subtitle", ".subtitle", "[class*='subtitle']",
      "h2.post-subtitle", "h2[class*='subtitle']"
    ]);

    // Author
    var author = jsonLdData.author || textOf([
      ".author-name", "[class*='author-name']",
      ".byline-name", "[class*='byline-name']",
      "a[href*='/about']", ".pencraft-author"
    ]);

    // Publication name
    var publication = textOf([
      ".publication-name", "[class*='publication-name']", ".pub-name"
    ]);

    // Date
    var date = jsonLdData.date || "";
    if (!date) {
      var dateEl = document.querySelector("time[datetime], [class*='post-date'] time, .post-date, [class*='date'] time");
      date = dateEl ? (dateEl.getAttribute("datetime") || clean(dateEl.innerText || dateEl.textContent)) : "";
    }

    // Body text — try .available-content first (Substack standard), then .body, then article
    var bodyEl = document.querySelector(
      ".available-content, [class*='available-content'], .body.markup, [class*='body markup'], .post-content, [class*='post-content'], article .markup, article"
    );
    var bodyText = bodyEl ? cleanMultiline(bodyEl.innerText || bodyEl.textContent) : "";

    // Like count
    var likeEl = document.querySelector(
      "[class*='like-count'], [class*='likeCount'], [aria-label*='like'], [aria-label*='Like'], .like-button"
    );
    var likeRaw = likeEl ? clean(likeEl.innerText || likeEl.textContent) : "";
    var likeCount = numFrom(likeRaw);

    // Comment count — Substack 2025 uses a generic [class*='comment'] element containing just the count
    var commentEl = document.querySelector(
      "[class*='comment-count'], [class*='commentCount'], a[href*='#comments'], .comment-btn, [class*='comment']"
    );
    var commentRaw = commentEl ? clean(commentEl.innerText || commentEl.textContent) : "";
    var commentCount = numFrom(commentRaw.replace(/comments?/i, ""));

    // Paywalled?
    var paywalled = !!(document.querySelector(".paywall, [class*='paywall'], .subscription-required, [class*='paywall-jump']"));

    var data = {
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      title: title,
      subtitle: subtitle,
      author: author,
      publication: publication,
      date: date,
      paywalled: paywalled,
      likeCount: likeCount,
      commentCount: commentCount,
      body: bodyText
    };

    if (mode === "markdown") {
      var md = "";
      if (data.title) md += "# " + data.title + "\n\n";
      if (data.subtitle) md += "_" + data.subtitle + "_\n\n";
      if (data.author || data.date) md += "**" + (data.author || "") + (data.author && data.date ? " — " : "") + (data.date || "") + "**\n\n";
      if (data.paywalled) md += "> Note: This post is paywalled. Only the preview is shown.\n\n";
      md += data.body;
      if (data.likeCount !== null || data.commentCount !== null) {
        md += "\n\n---\n";
        if (data.likeCount !== null) md += data.likeCount + " likes";
        if (data.likeCount !== null && data.commentCount !== null) md += " | ";
        if (data.commentCount !== null) md += data.commentCount + " comments";
      }
      return { content: [{ type: "text", text: md }] };
    }

    if (mode === "display") {
      var h = "<div style='font-family:Georgia,serif;max-width:680px;margin:0 auto;padding:20px;line-height:1.7;'>";
      h += "<h1 style='font-size:28px;margin:0 0 10px;line-height:1.2;'>" + esc(data.title) + "</h1>";
      if (data.subtitle) h += "<p style='font-size:18px;color:#666;margin:0 0 16px;font-style:italic;'>" + esc(data.subtitle) + "</p>";
      if (data.author || data.date) {
        h += "<div style='font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;color:#888;margin-bottom:24px;'>";
        h += esc(data.author) + (data.author && data.date ? " &bull; " : "") + esc(data.date);
        if (data.paywalled) h += " &bull; <span style='color:#e05;'>Paywalled</span>";
        h += "</div>";
      }
      if (data.body) {
        h += "<div style='font-size:17px;white-space:pre-wrap;'>" + esc(data.body) + "</div>";
      }
      if (data.likeCount !== null || data.commentCount !== null) {
        h += "<div style='font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;color:#999;margin-top:24px;border-top:1px solid #eee;padding-top:12px;'>";
        if (data.likeCount !== null) h += data.likeCount + " likes";
        if (data.likeCount !== null && data.commentCount !== null) h += " &bull; ";
        if (data.commentCount !== null) h += data.commentCount + " comments";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ title, subtitle, author, publication, date, paywalled, likeCount, commentCount, body }`
