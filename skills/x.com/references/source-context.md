# X (Twitter) - Source Context Reference

## Requirements

**Auth:** X requires login to view most content. Ask the user for their `auth_token` cookie from x.com (DevTools -> Application -> Cookies -> `auth_token`). Inject before navigating:

```js
await context.addCookies([{
  name: 'auth_token', value: '<user-provided>', domain: '.x.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Browser:** A real browser is required. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

## How to run this action

Once you're on the right URL, execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data", limit: 10 });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: source-context

Use when the user needs a reviewable source packet from visible X posts before drafting, research, fact-checking, reporting, archiving, or handing public URLs to another tool. This action does not post, reply, like, follow, send direct messages, schedule, scrape hidden data, or use private API routes.

**Navigate to:** a loaded X search, profile, timeline, list, or direct post URL with the relevant posts visible.

**Code:**

```js
({
  name: "x-source-context",
  description: "Extract visible X posts into a source context packet with public URLs, authors, timestamps, links, media flags, and engagement metrics",
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["data", "display"],
        description: "Output mode. data (default) returns JSON. display returns self-contained HTML."
      },
      limit: {
        type: "number",
        description: "Maximum visible posts to include, from 1 to 25. Defaults to 10."
      }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var rawLimit = params && typeof params.limit === "number" ? params.limit : 10;
    var limit = Math.max(1, Math.min(25, Math.floor(rawLimit)));

    function cleanText(value) {
      return (value || "").replace(/\s+/g, " ").trim();
    }

    function absoluteUrl(value) {
      if (!value) return "";
      try {
        return new URL(value, window.location.origin).href.split("?")[0];
      } catch (e) {
        return String(value).split("?")[0];
      }
    }

    function uniquePush(values, value) {
      if (!value) return;
      for (var i = 0; i < values.length; i++) {
        if (values[i] === value) return;
      }
      values.push(value);
    }

    function metric(article, testId) {
      var node = article.querySelector("[data-testid=" + testId + "]");
      if (!node) return "0";
      var button = node.closest("button");
      var value = cleanText(button ? button.textContent : node.textContent);
      return value || "0";
    }

    function statusIdFromUrl(value) {
      var match = String(value || "").match(/\/status\/(\d+)/);
      return match ? match[1] : "";
    }

    function extractPost(article, index) {
      var post = {
        index: index,
        content: "",
        authorName: "",
        authorHandle: "",
        authorProfileUrl: "",
        verified: article.querySelector("[data-testid=icon-verified]") !== null,
        timestamp: "",
        postUrl: "",
        statusId: "",
        replyCount: "0",
        repostCount: "0",
        likeCount: "0",
        bookmarkCount: "0",
        viewCount: "",
        outboundLinks: [],
        relatedPostUrls: [],
        photos: [],
        hasVideo: article.querySelector("[data-testid=videoPlayer]") !== null,
        sourceNotes: []
      };

      var textEl = article.querySelector("[data-testid=tweetText]");
      post.content = textEl ? cleanText(textEl.textContent) : "";

      var nameEl = article.querySelector("[data-testid=User-Name]");
      if (nameEl) {
        var nameLink = nameEl.querySelector("a span");
        post.authorName = nameLink ? cleanText(nameLink.textContent) : "";
        var spans = nameEl.querySelectorAll("span");
        for (var i = 0; i < spans.length; i++) {
          var spanText = cleanText(spans[i].textContent);
          if (spanText.charAt(0) === "@") {
            post.authorHandle = spanText;
            break;
          }
        }
        var profileLink = nameEl.querySelector("a[href]");
        post.authorProfileUrl = profileLink ? absoluteUrl(profileLink.getAttribute("href")) : "";
      }

      var timeEl = article.querySelector("time");
      post.timestamp = timeEl ? timeEl.getAttribute("datetime") || "" : "";

      var statusLinks = article.querySelectorAll("a[href*=\"/status/\"]");
      for (var j = 0; j < statusLinks.length; j++) {
        var statusUrl = absoluteUrl(statusLinks[j].getAttribute("href"));
        if (!post.postUrl) {
          post.postUrl = statusUrl;
          post.statusId = statusIdFromUrl(statusUrl);
        } else if (statusUrl !== post.postUrl) {
          uniquePush(post.relatedPostUrls, statusUrl);
        }
      }

      post.replyCount = metric(article, "reply");
      post.repostCount = metric(article, "retweet");
      post.likeCount = metric(article, "like");
      post.bookmarkCount = metric(article, "bookmark");

      var allSpans = article.querySelectorAll("span");
      for (var k = 0; k < allSpans.length; k++) {
        var spanValue = cleanText(allSpans[k].textContent);
        if (/views/i.test(spanValue)) {
          var viewsMatch = spanValue.match(/^([\d,.]+[KMB]?)/i);
          if (viewsMatch) post.viewCount = viewsMatch[1];
          break;
        }
      }

      var links = article.querySelectorAll("a[href]");
      for (var l = 0; l < links.length; l++) {
        var href = absoluteUrl(links[l].getAttribute("href"));
        if (!href) continue;
        if (href.indexOf("/status/") !== -1 || href.indexOf("/i/web/status/") !== -1) continue;
        if (href.indexOf("x.com/") !== -1 || href.indexOf("twitter.com/") !== -1) continue;
        uniquePush(post.outboundLinks, href);
      }

      var photos = article.querySelectorAll("[data-testid=tweetPhoto] img");
      for (var m = 0; m < photos.length; m++) {
        uniquePush(post.photos, photos[m].src);
      }

      if (!post.postUrl) post.sourceNotes.push("No canonical post URL was visible.");
      if (!post.timestamp) post.sourceNotes.push("No timestamp was visible.");
      if (!post.content) post.sourceNotes.push("No post text was visible; media or restricted content may be present.");
      return post;
    }

    var pageUrl = window.location.href.split("?")[0];
    var queryParams = new URLSearchParams(window.location.search);
    var articles = document.querySelectorAll("article[data-testid=tweet]");
    var posts = [];
    for (var n = 0; n < articles.length && posts.length < limit; n++) {
      posts.push(extractPost(articles[n], posts.length + 1));
    }

    var postUrls = [];
    var handles = [];
    var statusIds = [];
    for (var p = 0; p < posts.length; p++) {
      uniquePush(postUrls, posts[p].postUrl);
      uniquePush(handles, posts[p].authorHandle);
      uniquePush(statusIds, posts[p].statusId);
    }

    var data = {
      pageUrl: pageUrl,
      fullPageUrl: window.location.href,
      pageKind: window.location.pathname.indexOf("/status/") !== -1 ? "post" : window.location.pathname.indexOf("/search") !== -1 ? "search" : "timeline",
      searchQuery: queryParams.get("q") || "",
      capturedAt: new Date().toISOString(),
      totalVisiblePosts: articles.length,
      includedPosts: posts.length,
      posts: posts,
      sourcePack: {
        postUrls: postUrls,
        authorHandles: handles,
        statusIds: statusIds
      },
      handoffGuidance: {
        passOnly: "public post URLs, author handles, status IDs, search query, timestamps, and notes",
        doNotPass: "auth_token cookies, browser profile paths, private session values, or unpublished drafts",
        approvalBoundary: "Keep posting, replies, likes, follows, media uploads, and direct-message actions behind explicit user approval."
      }
    };

    if (mode === "display") {
      var html = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:760px;margin:0 auto;border-radius:12px;\">";
      html += "<h2 style=\"color:#fff;margin:0 0 8px;\">X Source Context</h2>";
      html += "<div style=\"color:#aaa;font-size:13px;margin-bottom:16px;\">" + data.pageKind + " - " + data.includedPosts + " visible post(s)</div>";
      for (var q = 0; q < posts.length; q++) {
        var item = posts[q];
        html += "<div style=\"padding:14px 0;border-top:1px solid #2a2a2a;\">";
        html += "<div style=\"font-weight:600;\">" + (item.authorName || "") + " <span style=\"color:#888;font-weight:400;\">" + (item.authorHandle || "") + "</span></div>";
        html += "<div style=\"line-height:1.5;margin:8px 0;white-space:pre-wrap;\">" + (item.content || "[no visible text]") + "</div>";
        html += "<div style=\"color:#888;font-size:13px;display:flex;gap:14px;flex-wrap:wrap;\">";
        html += "<span>replies " + item.replyCount + "</span><span>reposts " + item.repostCount + "</span><span>likes " + item.likeCount + "</span>";
        if (item.viewCount) html += "<span>views " + item.viewCount + "</span>";
        if (item.postUrl) html += "<span>" + item.postUrl + "</span>";
        html += "</div></div>";
      }
      html += "</div>";
      return { content: [{ type: "text", text: html }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ pageUrl, fullPageUrl, pageKind, searchQuery, capturedAt, totalVisiblePosts, includedPosts, posts: [{ index, content, authorName, authorHandle, authorProfileUrl, verified, timestamp, postUrl, statusId, replyCount, repostCount, likeCount, bookmarkCount, viewCount, outboundLinks, relatedPostUrls, photos, hasVideo, sourceNotes }], sourcePack: { postUrls, authorHandles, statusIds }, handoffGuidance }`

## Handoff Guidance

Use `sourcePack` as public follow-up context. Do not pass browser cookies, auth tokens, session values, browser profile paths, or unpublished drafts to another tool. Treat this action as source selection only; any write action such as posting, replying, liking, following, uploading media, or direct messaging needs explicit user approval.
