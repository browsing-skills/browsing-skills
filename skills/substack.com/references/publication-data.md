# Substack — Publication Data Reference

## Requirements

**Auth:** Not required. Most Substack publications are publicly accessible. Subscriber-only content may be hidden but publication metadata is always visible.

**Browser:** A real browser or plain fetch. Substack is server-rendered so most content is present in the initial HTML.

## How to run this action

Navigate first, wait until the page has rendered, then execute the code via `page.evaluate()` or Chrome Bridge `/run-action`.

---

## Action: publication-data

Use when the user wants metadata about a Substack publication and its recent posts.

**Navigate to:** `https://<publication>.substack.com`

Examples: `https://stratechery.substack.com`, `https://lenny.substack.com`.

**Code:**

```js
({
  name: "substack-publication-data",
  description: "Extract Substack publication metadata: name, author, description, subscriber count, post count, recent post list",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] },
      postLimit: { type: "number" }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var postLimit = (params && params.postLimit) ? params.postLimit : 20;

    function clean(s) { return (s || "").replace(/\s+/g, " ").trim(); }
    function esc(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function textOf(root, selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var el = root.querySelector(selectors[i]);
        if (el) { var t = clean(el.innerText || el.textContent); if (t) return t; }
      }
      return "";
    }
    function numFrom(v) {
      v = clean(v).replace(/,/g, "");
      if (!v) return null;
      if (/k$/i.test(v)) return Math.round(parseFloat(v) * 1000);
      if (/m$/i.test(v)) return Math.round(parseFloat(v) * 1000000);
      var n = parseInt(v.replace(/[^0-9]/g, ""), 10);
      return isNaN(n) ? null : n;
    }
    function abs(url) {
      if (!url) return "";
      try { return new URL(url, window.location.href).href; }
      catch (e) { return url; }
    }

    // Publication name
    var pubName = textOf(document, [
      "h1.publication-name", ".pub-name", ".publication-name",
      "[class*='publication-name']", "h1", "title"
    ]);
    if (pubName === document.title) pubName = document.title.replace(/\s*[\|\-–].*$/, "").trim();

    // Author / byline
    var author = textOf(document, [
      ".author-name", "[class*='author-name']", ".byline", "[class*='byline']",
      ".pencraft-author", "[class*='pencraft'] [class*='name']"
    ]);

    // Description
    var description = textOf(document, [
      ".publication-description", "[class*='publication-description']",
      ".pub-description", ".subtitle", "meta[name='description']"
    ]);
    if (!description) {
      var metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) description = clean(metaDesc.getAttribute("content") || "");
    }

    // Subscriber count — shown on some publications as "X subscribers"
    var subscriberRaw = textOf(document, [
      "[class*='subscriber-count']", "[class*='subscriberCount']",
      "[class*='audience']"
    ]);
    // Also search for text nodes containing "subscribers"
    if (!subscriberRaw) {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (/\d+[\s,\.]*(?:k|m)?\s*subscribers?/i.test(node.nodeValue)) {
          subscriberRaw = clean(node.nodeValue);
          break;
        }
      }
    }
    var subscriberCount = subscriberRaw ? numFrom(subscriberRaw) : null;

    // Posts
    var postEls = document.querySelectorAll(
      ".post-preview, article.post, [class*='post-preview'], .inbox-item, [class*='post-item'], [class*='postItem']"
    );
    var posts = [];
    var seen = {};
    for (var i = 0; i < postEls.length && posts.length < postLimit; i++) {
      var el = postEls[i];
      var titleEl = el.querySelector("h2, h3, [class*='post-title'], [class*='postTitle'], a[href*='/p/']");
      var title = titleEl ? clean(titleEl.innerText || titleEl.textContent) : "";
      var linkEl = el.querySelector("a[href*='/p/']") || el.closest("a[href*='/p/']");
      var url = linkEl ? abs(linkEl.getAttribute("href")) : "";
      if (!title && !url) continue;
      var key = url || title;
      if (seen[key]) continue;
      seen[key] = true;

      var dateEl = el.querySelector("time, [class*='date'], [class*='Date']");
      var date = dateEl ? (dateEl.getAttribute("datetime") || clean(dateEl.innerText || dateEl.textContent)) : "";
      var likesEl = el.querySelector("[class*='like'], [class*='Like'], [aria-label*='like'], [aria-label*='Like']");
      var likes = likesEl ? numFrom(clean(likesEl.innerText || likesEl.textContent)) : null;

      posts.push({ title: title, date: date, url: url, likes: likes });
    }

    // If no post-preview containers found, look for any links to /p/ slugs
    if (posts.length === 0) {
      var links = document.querySelectorAll("a[href*='/p/']");
      for (var j = 0; j < links.length && posts.length < postLimit; j++) {
        var href = links[j].getAttribute("href");
        var postUrl = abs(href);
        if (seen[postUrl]) continue;
        seen[postUrl] = true;
        var linkTitle = clean(links[j].innerText || links[j].textContent);
        if (!linkTitle || linkTitle.length < 3) continue;
        posts.push({ title: linkTitle, date: "", url: postUrl, likes: null });
      }
    }

    var data = {
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      name: pubName,
      author: author,
      description: description,
      subscriberCount: subscriberCount,
      postCount: posts.length,
      posts: posts
    };

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:750px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 4px;'>" + esc(data.name) + "</h2>";
      if (data.author) h += "<div style='color:#666;font-size:14px;margin-bottom:8px;'>by " + esc(data.author) + "</div>";
      if (data.subscriberCount) h += "<div style='color:#666;font-size:13px;margin-bottom:8px;'>" + data.subscriberCount.toLocaleString() + " subscribers</div>";
      if (data.description) h += "<p style='color:#444;margin:0 0 16px;'>" + esc(data.description) + "</p>";
      h += "<h3 style='margin:0 0 12px;'>Recent Posts</h3>";
      for (var k = 0; k < data.posts.length; k++) {
        var p = data.posts[k];
        h += "<div style='border-bottom:1px solid #eee;padding:10px 0;'>";
        h += "<a href='" + esc(p.url) + "' style='font-weight:600;text-decoration:none;color:#1a1a1a;'>" + esc(p.title) + "</a>";
        if (p.date || p.likes !== null) {
          h += "<div style='color:#999;font-size:12px;margin-top:2px;'>" + esc(p.date) + (p.date && p.likes !== null ? " &bull; " : "") + (p.likes !== null ? p.likes + " likes" : "") + "</div>";
        }
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ name, author, description, subscriberCount, postCount, posts: [{ title, date, url, likes }] }`
