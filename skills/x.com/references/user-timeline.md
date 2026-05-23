# X (Twitter) — User Timeline Reference

## Requirements

**Auth:** X requires login to view most content. Ask the user for their `auth_token` cookie from x.com (DevTools → Application → Cookies → `auth_token`). Inject before navigating:

```js
await context.addCookies([{
  name: 'auth_token', value: '<user-provided>', domain: '.x.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Browser:** A real (non-headless) browser is required. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

## How to run this action

Once you're on the right URL, execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: user-timeline

Use when the user wants to see a specific user's recent posts from their profile page.

**Navigate to:** `https://x.com/<handle>` (the user's profile, no trailing path — same URL as profile-data, but this action extracts the tweets rather than the bio).

**Code:**

```js
({
  name: "x-user-timeline",
  description: "Extract visible posts from an X user's profile timeline page",
  inputSchema: { type: "object", properties: { mode: { type: "string", enum: ["data", "display"] } } },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};
    var pathParts = window.location.pathname.split("/").filter(Boolean);
    data.profileHandle = pathParts.length > 0 ? "@" + pathParts[0] : "";
    var articles = document.querySelectorAll("article[data-testid=tweet]");
    data.posts = [];
    for (var i = 0; i < articles.length; i++) {
      var a = articles[i];
      var post = {};
      var textEl = a.querySelector("[data-testid=tweetText]");
      post.content = textEl ? textEl.textContent.trim() : "";
      var nameEl = a.querySelector("[data-testid=User-Name]");
      if (nameEl) {
        var nameLink = nameEl.querySelector("a span");
        post.authorName = nameLink ? nameLink.textContent.trim() : "";
        var spans = nameEl.querySelectorAll("span");
        for (var j = 0; j < spans.length; j++) { if (spans[j].textContent.startsWith("@")) { post.authorHandle = spans[j].textContent.trim(); break; } }
        var link = nameEl.querySelector("a[href]");
        if (link) post.authorProfileUrl = link.href.split("?")[0];
      }
      post.verified = a.querySelector("[data-testid=icon-verified]") !== null;
      var timeEl = a.querySelector("time");
      if (timeEl) post.timestamp = timeEl.getAttribute("datetime") || "";
      var statusLink = a.querySelector("a[href*=\"/status/\"]");
      if (statusLink) post.postUrl = statusLink.href.split("?")[0];
      var metrics = { reply: "replies", retweet: "reposts", like: "likes" };
      var keys = Object.keys(metrics);
      for (var k = 0; k < keys.length; k++) {
        var btn = a.querySelector("[data-testid=" + keys[k] + "]");
        if (btn) { var bp = btn.closest("button"); post[metrics[keys[k]]] = bp ? bp.textContent.trim() : "0"; }
      }
      post.hasMedia = a.querySelectorAll("[data-testid=tweetPhoto]").length > 0 || a.querySelector("[data-testid=videoPlayer]") !== null;
      var allSpans = a.querySelectorAll("span");
      for (var v = 0; v < allSpans.length; v++) {
        var sv = allSpans[v].textContent;
        if (sv.includes("Views") || sv.includes("views")) {
          var vMatch = allSpans[v].parentElement.textContent.trim().match(/^([\d,.]+[KMB]?)/i);
          if (vMatch) { post.views = vMatch[1]; break; }
        }
      }
      data.posts.push(post);
    }
    data.totalResults = data.posts.length;
    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:700px;margin:0 auto;border-radius:12px;\">";
      h += "<h2 style=\"color:#fff;margin:0 0 16px;\">Timeline: " + data.profileHandle + " (" + data.totalResults + " posts)</h2>";
      for (var m = 0; m < data.posts.length; m++) {
        var r = data.posts[m];
        h += "<div style=\"padding:12px 0;border-bottom:1px solid #222;\">";
        h += "<div style=\"font-weight:600;\">" + (r.authorName||"") + " <span style=\"color:#888;font-weight:normal;\">" + (r.authorHandle||"") + "</span></div>";
        h += "<div style=\"margin:8px 0;line-height:1.5;\">" + r.content.substring(0,280) + "</div>";
        h += "<div style=\"color:#888;font-size:13px;display:flex;gap:16px;\">";
        h += "<span>💬 " + (r.replies||"0") + "</span><span>🔄 " + (r.reposts||"0") + "</span><span>❤️ " + (r.likes||"0") + "</span>";
        if (r.views) h += "<span>👁 " + r.views + "</span>";
        h += "</div></div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})

```

**Returns:** `{ profileHandle, posts: [{ content, authorName, authorHandle, authorProfileUrl, verified, timestamp, postUrl, replies, reposts, likes, hasMedia, views }], totalResults }`

---

## Reporting issues

If one of these actions breaks (selectors changed, X updated their UI), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
- **Comparison:** Not yet benchmarked.
