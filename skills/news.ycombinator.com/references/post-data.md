# Hacker News — Post Data Reference

## Requirements

**Auth:** Not required. HN item pages are public.

**Browser:** Not required. HN is server-rendered HTML — a static HTTP fetch is sufficient, but a browser works fine too.

## How to run this action

Navigate to the item page, then execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: post-data

Use when the user wants the details of a specific HN post (title, URL, score, author, age) plus its top-level comments.

**Navigate to:** `https://news.ycombinator.com/item?id=<id>` (the post's HN item URL).

**Code:**

```js
({
  name: "hn-post-data",
  description: "Extract a Hacker News post's details and top-level comments from its item page",
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["data", "display"],
        description: "Output mode. data (default) returns JSON. display returns self-contained HTML."
      }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};

    var urlParams = new URLSearchParams(window.location.search);
    data.storyId = urlParams.get("id") || "";

    var titleAnchor = document.querySelector(".titleline > a");
    data.title = titleAnchor ? titleAnchor.textContent.trim() : "";
    data.url = titleAnchor ? titleAnchor.getAttribute("href") || "" : "";
    if (data.url && data.url.indexOf("//") === -1) {
      data.url = "https://news.ycombinator.com/" + data.url.replace(/^\//, "");
    }

    var scoreEl = document.querySelector(".score");
    if (scoreEl) {
      var scoreMatch = scoreEl.textContent.trim().match(/(\d+)/);
      data.score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    } else {
      data.score = 0;
    }

    var userEl = document.querySelector(".hnuser");
    data.author = userEl ? userEl.textContent.trim() : "";

    var ageEl = document.querySelector(".age a");
    data.age = ageEl ? ageEl.textContent.trim() : "";

    var subtextLinks = document.querySelectorAll(".subtext a[href]");
    var commentsCount = 0;
    for (var i = subtextLinks.length - 1; i >= 0; i--) {
      var linkText = subtextLinks[i].textContent.trim();
      var cMatch = linkText.match(/(\d+)\s+comment/);
      if (cMatch) { commentsCount = parseInt(cMatch[1], 10); break; }
    }
    data.commentsCount = commentsCount;

    var comments = [];
    var commentRows = document.querySelectorAll("tr.comtr");
    for (var j = 0; j < commentRows.length && comments.length < 20; j++) {
      var row = commentRows[j];
      var indImg = row.querySelector("td.ind img");
      if (!indImg) continue;
      var indWidth = parseInt(indImg.getAttribute("width") || "0", 10);
      if (indWidth !== 0) continue;

      var comment = {};
      comment.indentLevel = 0;

      var commentUserEl = row.querySelector(".hnuser");
      comment.author = commentUserEl ? commentUserEl.textContent.trim() : "";

      var commentAgeEl = row.querySelector(".age a");
      comment.age = commentAgeEl ? commentAgeEl.textContent.trim() : "";

      var commentTextEl = row.querySelector(".commtext");
      comment.text = commentTextEl ? commentTextEl.textContent.trim() : "";

      if (comment.text || comment.author) comments.push(comment);
    }

    data.comments = comments;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a1a;color:#e0e0e0;padding:24px;max-width:800px;margin:0 auto;border-radius:12px;\">";
      h += "<h2 style=\"color:#ff6600;margin:0 0 8px;\">" + (data.title || "Untitled") + "</h2>";
      if (data.url) h += "<div style=\"margin-bottom:8px;\"><a href=\"" + data.url + "\" style=\"color:#4a9eff;font-size:14px;\">" + data.url + "</a></div>";
      h += "<div style=\"color:#888;font-size:13px;margin-bottom:20px;\">";
      h += data.score + " points by " + (data.author || "unknown") + " " + (data.age || "");
      h += " | " + data.commentsCount + " comments";
      h += "</div>";
      h += "<h3 style=\"color:#e0e0e0;margin:0 0 12px;\">Top Comments</h3>";
      for (var k = 0; k < data.comments.length; k++) {
        var c = data.comments[k];
        h += "<div style=\"padding:12px;margin-bottom:8px;background:#222;border-radius:8px;\">";
        h += "<div style=\"color:#ff6600;font-size:13px;margin-bottom:6px;\">" + (c.author || "unknown") + " <span style=\"color:#888;\">" + (c.age || "") + "</span></div>";
        h += "<div style=\"line-height:1.5;font-size:14px;\">" + c.text.substring(0, 500) + (c.text.length > 500 ? "..." : "") + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ storyId, title, url, score, author, age, commentsCount, comments: [{ author, age, text, indentLevel }] }`

---

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
