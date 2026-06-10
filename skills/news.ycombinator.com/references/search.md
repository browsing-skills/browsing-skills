# Hacker News — Search Reference

## Requirements

**Auth:** Not required. The Algolia HN search API is public and CORS-open.

**Browser:** Not required. The action calls the Algolia HN search API via `fetch()` — no page DOM inspection needed. Navigate to any HN page (or any page that allows fetch) as a launch point.

## How to run this action

Navigate to `https://news.ycombinator.com/` (or any HN page), then execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ query: "AI agents", limit: 10, mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: search

Use when the user wants to search Hacker News for stories by keyword, topic, or phrase. Uses the Algolia HN search API — no DOM scraping required.

**Navigate to:** `https://news.ycombinator.com/` (any HN page works; the action uses `fetch` to call the Algolia API directly).

**Code:**

```js
({
  name: "hn-search",
  description: "Search Hacker News stories via the Algolia HN search API",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query string"
      },
      limit: {
        type: "number",
        description: "Max results to return (default 10, max 50)"
      },
      mode: {
        type: "string",
        enum: ["data", "display"],
        description: "Output mode. data (default) returns JSON. display returns self-contained HTML."
      }
    },
    required: ["query"]
  },
  execute: async function(params) {
    var query = (params && params.query) || "";
    var limit = (params && params.limit) || 10;
    var mode = (params && params.mode) || "data";

    var apiUrl = "https://hn.algolia.com/api/v1/search?query=" + encodeURIComponent(query) + "&tags=story&hitsPerPage=" + limit;
    var response = await fetch(apiUrl);
    var json = await response.json();

    var stories = [];
    for (var i = 0; i < json.hits.length; i++) {
      var hit = json.hits[i];
      stories.push({
        objectID: hit.objectID,
        title: hit.title || "",
        url: hit.url || ("https://news.ycombinator.com/item?id=" + hit.objectID),
        author: hit.author || "",
        points: hit.points || 0,
        commentsCount: hit.num_comments || 0,
        createdAt: hit.created_at || "",
        hnUrl: "https://news.ycombinator.com/item?id=" + hit.objectID
      });
    }

    var data = { query: query, totalFound: json.nbHits, stories: stories };

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a1a;color:#e0e0e0;padding:24px;max-width:800px;margin:0 auto;border-radius:12px;\">";
      h += "<h2 style=\"color:#ff6600;margin:0 0 4px;\">HN Search: " + query + "</h2>";
      h += "<div style=\"color:#888;font-size:13px;margin-bottom:16px;\">" + json.nbHits + " total results</div>";
      for (var m = 0; m < stories.length; m++) {
        var s = stories[m];
        h += "<div style=\"padding:12px 0;border-bottom:1px solid #2a2a2a;\">";
        h += "<div><a href=\"" + s.url + "\" style=\"color:#e0e0e0;text-decoration:none;font-weight:500;\">" + s.title + "</a></div>";
        h += "<div style=\"color:#888;font-size:12px;margin-top:4px;\">";
        h += s.points + " points by " + s.author + " | " + s.commentsCount + " comments";
        h += " | <a href=\"" + s.hnUrl + "\" style=\"color:#888;\">discuss</a>";
        h += "</div></div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ query, totalFound, stories: [{ objectID, title, url, author, points, commentsCount, createdAt, hnUrl }] }`

---

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
