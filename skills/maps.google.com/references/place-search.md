# Google Maps — Place Search Reference

## Requirements

**Auth:** Google Maps place search results are publicly accessible without login. No cookies required.

**Browser:** A real (non-headless) browser is required. Google Maps is a JS-rendered SPA — DOM results only appear after the sidebar renders. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

**Wait:** After navigating, wait for the feed to appear before running the action. In Playwright: `await page.waitForSelector('[role="feed"]', { timeout: 10000 })`.

## How to run this action

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ limit: 10, mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: place-search

Use when the user wants to search Google Maps for a type of place or business (e.g. "coffee shops in Tel Aviv", "dentists near me"). Returns a list of results from the sidebar.

**Navigate to:** `https://www.google.com/maps/search/<query>/` (URL-encode spaces as `+` or `%20`). Example: `https://www.google.com/maps/search/coffee+shops+in+Tel+Aviv/`

**Code:**

```js
({
  name: "maps-place-search",
  description: "Extract place search results from a Google Maps search page",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Maximum number of places to return (default 10)" },
      mode: { type: "string", enum: ["data", "display"] }
    }
  },
  execute: function(params) {
    var limit = (params && params.limit) || 10;
    var mode = (params && params.mode) || "data";
    var places = [];

    // Results live in [role="feed"] > div > div > a or similar structure
    var feed = document.querySelector('[role="feed"]');
    var cards = feed
      ? feed.querySelectorAll('a[href*="/maps/place/"]')
      : document.querySelectorAll('a[href*="/maps/place/"]');

    for (var i = 0; i < cards.length && places.length < limit; i++) {
      var card = cards[i];
      var place = {};

      // URL
      var href = card.getAttribute('href') || '';
      place.url = href.startsWith('http') ? href : 'https://www.google.com' + href;

      // Name — try aria-label on the anchor first, then first meaningful text child
      var ariaLabel = card.getAttribute('aria-label') || '';
      if (ariaLabel) {
        place.name = ariaLabel.trim();
      } else {
        var nameDiv = card.querySelector('[jsan*="name"], [class*="fontHeadlineSmall"], [class*="qBF1Pd"]');
        if (!nameDiv) nameDiv = card.querySelector('div[class] > div[class] > div[class]');
        place.name = nameDiv ? nameDiv.textContent.trim() : '';
      }

      if (!place.name) continue;

      // Rating — class MW4etd
      var ratingEl = card.querySelector('.MW4etd, [class*="MW4etd"]');
      place.rating = ratingEl ? ratingEl.textContent.trim() : null;

      // Review count — class UY7F9 (usually in parentheses)
      var reviewEl = card.querySelector('.UY7F9, [class*="UY7F9"]');
      if (reviewEl) {
        place.reviewCount = reviewEl.textContent.trim().replace(/[()]/g, '');
      } else {
        // Try aria-label pattern "X reviews"
        var reviewMatch = ariaLabel.match(/([\d,]+)\s+review/i);
        place.reviewCount = reviewMatch ? reviewMatch[1] : null;
      }

      // Category — class W4Etjb
      var catEl = card.querySelector('.W4Etjb, [class*="W4Etjb"]');
      place.category = catEl ? catEl.textContent.trim() : null;

      // Address — look for text that looks like a street address (has a number or common address words)
      var allDivs = card.querySelectorAll('div[class]');
      for (var di = 0; di < allDivs.length; di++) {
        var txt = allDivs[di].textContent.trim();
        if (!place.address && txt && txt !== place.name && txt !== place.category && txt.length > 5) {
          // Heuristic: contains a digit (street number) or common address keyword
          if (/\d/.test(txt) && txt.length < 80 && allDivs[di].children.length === 0) {
            place.address = txt;
          }
        }
      }

      // Open/closed status
      var openEl = card.querySelector('[class*="fontBodyMedium"] span, [class*="open"], [class*="closed"]');
      var openText = openEl ? openEl.textContent.trim() : '';
      if (/open|closed|hours/i.test(openText)) {
        place.openStatus = openText;
      } else {
        place.openStatus = null;
      }

      // Deduplicate by URL
      var seen = false;
      for (var si = 0; si < places.length; si++) {
        if (places[si].url === place.url) { seen = true; break; }
      }
      if (!seen) places.push(place);
    }

    var query = decodeURIComponent(window.location.pathname.replace('/maps/search/', '').replace(/\//g, '').replace(/\+/g, ' '));
    var result = { query: query, places: places, totalVisible: places.length };

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#fff;color:#202124;padding:24px;max-width:700px;margin:0 auto;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.2);\">";
      h += "<h2 style=\"margin:0 0 16px;font-size:18px;\">Google Maps: " + (result.query || '') + " (" + places.length + " results)</h2>";
      for (var pi = 0; pi < places.length; pi++) {
        var p = places[pi];
        h += "<div style=\"padding:12px 0;border-bottom:1px solid #e8eaed;\">";
        h += "<div style=\"display:flex;justify-content:space-between;align-items:center;\">";
        h += "<a href=\"" + p.url + "\" target=\"_blank\" style=\"font-weight:600;color:#1a73e8;text-decoration:none;font-size:15px;\">" + (p.name || '') + "</a>";
        if (p.rating) h += "<span style=\"background:#188038;color:#fff;padding:2px 6px;border-radius:4px;font-size:13px;\">&#9733; " + p.rating + "</span>";
        h += "</div>";
        var meta = [];
        if (p.category) meta.push(p.category);
        if (p.address) meta.push(p.address);
        if (p.openStatus) meta.push(p.openStatus);
        if (p.reviewCount) meta.push(p.reviewCount + " reviews");
        if (meta.length) h += "<div style=\"color:#5f6368;font-size:13px;margin-top:4px;\">" + meta.join(" · ") + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
})
```

**Returns:** `{ query, places: [{ name, rating, reviewCount, address, category, openStatus, url }], totalVisible }`

---

## Reporting issues

If one of these actions breaks (selectors changed, Google Maps updated their UI), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
