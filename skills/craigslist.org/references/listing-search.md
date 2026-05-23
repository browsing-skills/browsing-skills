# Craigslist — Listing Search Reference

## Requirements

**Auth:** Not required. Craigslist search results pages are publicly accessible without login.

**Browser:** Recommended but not strictly required. Craigslist uses server-rendered HTML, so a static fetch can often retrieve the page. However, a real browser avoids bot-detection issues and handles any JavaScript-dependent pagination. If you have browser access (Playwright, a built-in integration, etc.), prefer it. Otherwise the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) or a plain `fetch` may work.

## How to run this action

Navigate to the target search URL, wait for the results to appear, then execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data", limit: 20 });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: listing-search

Use when the user wants to search Craigslist for listings in a specific city, category, and optional query string.

**Navigate to:** `https://<city>.craigslist.org/search/<category>?query=<q>`

- `<city>` — subdomain for the city (e.g. `sfbay`, `newyork`, `chicago`, `losangeles`, `seattle`)
- `<category>` — category code (e.g. `apa` for apartments, `sss` for for-sale, `jjj` for jobs, `foa` for free stuff, `cta` for cars). Full list at https://www.craigslist.org/about/categories
- `query` — optional keyword search string (URL-encoded)

Example: `https://sfbay.craigslist.org/search/apa?query=2+bedroom`

**Code:**

```js
({
  name: "craigslist-listing-search",
  description: "Extract visible listing results from a Craigslist search page",
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
        description: "Maximum number of listings to return (default 20)."
      }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var limit = (params && params.limit) || 20;

    var data = {};
    data.pageUrl = window.location.href;

    var listings = [];

    // Craigslist 2024/2025 redesigned results: li.cl-search-result
    var rows = document.querySelectorAll('li.cl-search-result');

    // Fallback: classic layout result-row
    if (rows.length === 0) {
      rows = document.querySelectorAll('#search-results li.result-row, li.result-row');
    }

    for (var i = 0; i < rows.length && listings.length < limit; i++) {
      var row = rows[i];

      // Title + URL — new layout
      var titleEl = row.querySelector('a.posting-title') || row.querySelector('.result-title') || row.querySelector('a[href*=".html"]');
      var title = titleEl ? titleEl.textContent.trim() : "";
      var url = titleEl ? (titleEl.href || "") : "";

      // Price
      var priceEl = row.querySelector('.priceinfo') || row.querySelector('.result-price') || row.querySelector('[class*="price"]');
      var price = priceEl ? priceEl.textContent.trim() : "";

      // Location / hood
      var hoodEl = row.querySelector('.meta .separator ~ *') || row.querySelector('.result-hood') || row.querySelector('[class*="hood"]');
      var location = hoodEl ? hoodEl.textContent.trim().replace(/^\(|\)$/g, "") : "";

      // Date posted
      var dateEl = row.querySelector('time') || row.querySelector('.result-date');
      var datePosted = "";
      if (dateEl) {
        datePosted = dateEl.getAttribute("datetime") || dateEl.textContent.trim();
      }

      // Thumbnail
      var imgEl = row.querySelector('img');
      var thumbnail = imgEl ? (imgEl.src || imgEl.getAttribute("data-src") || "") : "";

      // New layout: extract location from meta line if hood not found
      if (!location) {
        var metaEl = row.querySelector(".meta");
        if (metaEl) {
          var metaText = metaEl.textContent.trim();
          // meta format: "date · location" or just location
          var parts = metaText.split(/·|•/).map(function(p) { return p.trim(); });
          if (parts.length >= 2) location = parts[1];
          else location = parts[0];
        }
      }

      if (!title && !url) continue;

      listings.push({
        title: title,
        price: price,
        location: location,
        datePosted: datePosted,
        thumbnail: thumbnail,
        url: url
      });
    }

    data.listings = listings;
    data.totalResults = listings.length;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#1a1a1a;color:#e0e0e0;padding:24px;max-width:800px;margin:0 auto;border-radius:12px;\">";
      h += "<h2 style=\"color:#fff;margin:0 0 16px;\">Craigslist Results (" + data.totalResults + " listings)</h2>";
      for (var k = 0; k < listings.length; k++) {
        var l = listings[k];
        h += "<div style=\"display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #333;align-items:flex-start;\">";
        if (l.thumbnail) {
          h += "<img src=\"" + l.thumbnail + "\" style=\"width:80px;height:60px;object-fit:cover;border-radius:4px;flex-shrink:0;\">";
        }
        h += "<div style=\"flex:1;\">";
        h += "<div style=\"font-weight:600;font-size:14px;margin-bottom:3px;\"><a href=\"" + l.url + "\" style=\"color:#4da6ff;text-decoration:none;\">" + (l.title || l.url) + "</a></div>";
        if (l.price) h += "<div style=\"color:#4caf50;font-weight:700;font-size:15px;margin-bottom:3px;\">" + l.price + "</div>";
        var meta = [l.location, l.datePosted].filter(Boolean).join(" &mdash; ");
        if (meta) h += "<div style=\"color:#888;font-size:12px;\">" + meta + "</div>";
        h += "</div></div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ listings: [{ title, price, location, datePosted, thumbnail, url }], totalResults, pageUrl }`

---

## Common Category Codes

| Code | Category |
|---|---|
| `apa` | Apartments / housing for rent |
| `roo` | Rooms & shares |
| `rea` | Real estate for sale |
| `sss` | For sale (general) |
| `cta` | Cars & trucks |
| `jjj` | Jobs |
| `foa` | Free stuff |
| `ggg` | Gigs |
| `sva` | Services |

---

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
- **Comparison:** TBD
