# Hacker News — Frontpage Reference

## Requirements

**Auth:** Not required. HN frontpage is public.

**Browser:** Not required. HN is server-rendered HTML — a static HTTP fetch is sufficient, but a browser works fine too.

## How to run this action

Navigate to the page, then execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data", page: 1 });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: frontpage

Use when the user wants to read the top stories currently listed on Hacker News.

**Navigate to:** `https://news.ycombinator.com/` for page 1, or `https://news.ycombinator.com/news?p=<page>` for subsequent pages.

**Code:**

```js
({
  name: "hn-frontpage",
  description: "Extract top stories from the Hacker News frontpage",
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["data", "display"],
        description: "Output mode. data (default) returns JSON. display returns self-contained HTML."
      },
      page: {
        type: "number",
        description: "Page number (default 1). Reflect in the navigate-to URL before running."
      }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var page = (params && params.page) || 1;

    var stories = [];
    var athings = document.querySelectorAll("tr.athing");

    for (var i = 0; i < athings.length; i++) {
      var row = athings[i];
      var story = {};

      story.id = row.getAttribute("id") || "";

      var rankEl = row.querySelector(".rank");
      story.rank = rankEl ? parseInt(rankEl.textContent.trim(), 10) || (i + 1) : (i + 1);

      var titleAnchor = row.querySelector(".titleline > a");
      story.title = titleAnchor ? titleAnchor.textContent.trim() : "";
      story.url = titleAnchor ? titleAnchor.getAttribute("href") || "" : "";
      if (story.url && story.url.indexOf("//") === -1) {
        story.url = "https://news.ycombinator.com/" + story.url.replace(/^\//, "");
      }

      var siteEl = row.querySelector(".sitestr");
      story.domain = siteEl ? siteEl.textContent.trim() : "";

      var scoreRow = row.nextElementSibling;
      if (scoreRow) {
        var scoreEl = scoreRow.querySelector(".score");
        if (scoreEl) {
          var scoreText = scoreEl.textContent.trim();
          var scoreMatch = scoreText.match(/(\d+)/);
          story.score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
        } else {
          story.score = 0;
        }

        var userEl = scoreRow.querySelector(".hnuser");
        story.author = userEl ? userEl.textContent.trim() : "";

        var ageEl = scoreRow.querySelector(".age a");
        story.age = ageEl ? ageEl.textContent.trim() : "";

        var subtextLinks = scoreRow.querySelectorAll("a[href]");
        var commentsLink = null;
        for (var j = subtextLinks.length - 1; j >= 0; j--) {
          var href = subtextLinks[j].getAttribute("href") || "";
          if (href.indexOf("item?id=") !== -1) {
            commentsLink = subtextLinks[j];
            break;
          }
        }
        if (commentsLink) {
          story.commentsUrl = "https://news.ycombinator.com/" + commentsLink.getAttribute("href").replace(/^\//, "");
          var commentsText = commentsLink.textContent.trim();
          var commentsMatch = commentsText.match(/(\d+)/);
          story.commentsCount = commentsMatch ? parseInt(commentsMatch[1], 10) : 0;
        } else {
          story.commentsUrl = "https://news.ycombinator.com/item?id=" + story.id;
          story.commentsCount = 0;
        }
      } else {
        story.score = 0;
        story.author = "";
        story.age = "";
        story.commentsUrl = "https://news.ycombinator.com/item?id=" + story.id;
        story.commentsCount = 0;
      }

      story.hnUrl = "https://news.ycombinator.com/item?id=" + story.id;

      stories.push(story);
    }

    var data = { stories: stories, totalStories: stories.length, page: page };

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a1a;color:#e0e0e0;padding:24px;max-width:800px;margin:0 auto;border-radius:12px;\">";
      h += "<h2 style=\"color:#ff6600;margin:0 0 16px;\">Hacker News — Page " + page + " (" + stories.length + " stories)</h2>";
      for (var m = 0; m < stories.length; m++) {
        var s = stories[m];
        h += "<div style=\"padding:12px 0;border-bottom:1px solid #2a2a2a;display:flex;gap:12px;align-items:flex-start;\">";
        h += "<span style=\"color:#888;min-width:24px;text-align:right;\">" + s.rank + ".</span>";
        h += "<div style=\"flex:1;\">";
        h += "<div><a href=\"" + s.url + "\" style=\"color:#e0e0e0;text-decoration:none;font-weight:500;\">" + s.title + "</a>";
        if (s.domain) h += " <span style=\"color:#888;font-size:12px;\">(" + s.domain + ")</span>";
        h += "</div>";
        h += "<div style=\"color:#888;font-size:12px;margin-top:4px;\">";
        h += s.score + " points by " + s.author + " " + s.age;
        h += " | <a href=\"" + s.commentsUrl + "\" style=\"color:#888;\">" + s.commentsCount + " comments</a>";
        h += "</div></div></div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ stories: [{ id, rank, title, url, domain, score, author, age, commentsUrl, commentsCount, hnUrl }], totalStories, page }`

---

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
