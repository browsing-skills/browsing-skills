# Instagram — User Posts Reference

## Requirements

**Auth:** Instagram requires a logged-in session to view post grids. Ask the user for their `sessionid` cookie from instagram.com (DevTools → Application → Cookies → `sessionid`). Inject before navigating:

```js
await context.addCookies([{
  name: 'sessionid', value: '<user-provided>', domain: '.instagram.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Browser:** A real (non-headless) browser is required. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

## How to run this action

Navigate to the profile URL, wait for the grid to load (scroll or wait ~2s), then execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ limit: 12, mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: user-posts

Use when the user wants the visible posts from an Instagram user's profile grid (thumbnails, URLs, captions). Requires the user's Instagram username.

**Navigate to:** `https://www.instagram.com/<username>/` (include the trailing slash). The grid loads on the profile page; scroll down before running if you want more posts.

**Code:**

```js
({
  name: "instagram-user-posts",
  description: "Extract visible posts from an Instagram user's profile grid",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Maximum number of posts to return (default 12)" },
      mode: { type: "string", enum: ["data", "display"] }
    }
  },
  execute: function(params) {
    var limit = (params && params.limit) || 12;
    var mode = (params && params.mode) || "data";
    var posts = [];

    // Posts are inside article elements or anchors with /p/ in href
    var anchors = document.querySelectorAll('a[href*="/p/"]');
    for (var i = 0; i < anchors.length && posts.length < limit; i++) {
      var a = anchors[i];
      var post = {};

      var href = a.getAttribute('href') || '';
      post.url = href.startsWith('http') ? href : 'https://www.instagram.com' + href;

      var img = a.querySelector('img');
      if (img) {
        post.thumbnailSrc = img.src || img.getAttribute('data-src') || '';
        post.altText = img.alt || '';
      } else {
        post.thumbnailSrc = '';
        post.altText = '';
      }

      // Try to extract like/comment counts from aria-label on the anchor or parent
      var ariaLabel = a.getAttribute('aria-label') || '';
      var parent = a.parentElement;
      var parentAria = parent ? (parent.getAttribute('aria-label') || '') : '';
      var combined = ariaLabel + ' ' + parentAria;

      var likeMatch = combined.match(/([\d,]+)\s+[Ll]ike/);
      post.likes = likeMatch ? likeMatch[1] : null;

      var commentMatch = combined.match(/([\d,]+)\s+[Cc]omment/);
      post.comments = commentMatch ? commentMatch[1] : null;

      // Deduplicate by URL
      var alreadySeen = false;
      for (var j = 0; j < posts.length; j++) {
        if (posts[j].url === post.url) { alreadySeen = true; break; }
      }
      if (!alreadySeen && post.thumbnailSrc) {
        posts.push(post);
      }
    }

    var username = window.location.pathname.replace(/\//g, '');
    var result = { username: username, posts: posts, totalVisible: posts.length };

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#fafafa;color:#262626;padding:24px;max-width:700px;margin:0 auto;border-radius:12px;border:1px solid #dbdbdb;\">";
      h += "<h2 style=\"margin:0 0 16px;\">@" + username + " — " + posts.length + " posts</h2>";
      h += "<div style=\"display:grid;grid-template-columns:repeat(3,1fr);gap:4px;\">";
      for (var pi = 0; pi < posts.length; pi++) {
        var p = posts[pi];
        h += "<a href=\"" + p.url + "\" target=\"_blank\" style=\"display:block;aspect-ratio:1;overflow:hidden;\">";
        if (p.thumbnailSrc) {
          h += "<img src=\"" + p.thumbnailSrc + "\" alt=\"" + (p.altText || '').replace(/"/g, '&quot;') + "\" style=\"width:100%;height:100%;object-fit:cover;display:block;\">";
        }
        h += "</a>";
      }
      h += "</div>";
      if (posts.length > 0 && posts[0].likes) {
        h += "<p style=\"color:#8e8e8e;font-size:12px;margin-top:8px;\">Like/comment counts shown when available from aria-labels.</p>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
})
```

**Returns:** `{ username, posts: [{ url, thumbnailSrc, altText, likes, comments }], totalVisible }`

---

## Reporting issues

If one of these actions breaks (selectors changed, Instagram updated their UI), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
