# Madlan — Property Search Reference

## Requirements

**Auth:** Not required. Madlan listing search pages are publicly accessible without login.

**Browser:** A real browser is required. Madlan is a JS-rendered React SPA — static fetches will not return listing cards. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

**RTL / Hebrew:** The page renders in Hebrew with RTL layout. Prices appear in ₪ (shekel). Field labels are in Hebrew — see the Hebrew matching notes in the code.

## How to run this action

Navigate to the target URL, wait for listing cards to render, then execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data", limit: 20 });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained RTL HTML output instead of JSON.

---

## Action: property-search

Use when the user wants to search Madlan for properties for sale in a city and extract visible listing cards.

**Navigate to:** `https://www.madlan.co.il/for-sale/<city>` — replace `<city>` with the Hebrew or transliterated city name as it appears in Madlan URLs (e.g. `tel-aviv`, `jerusalem`, `haifa`, `ramat-gan`).

**Code:**

```js
({
  name: "madlan-property-search",
  description: "Extract visible property listing cards from a Madlan for-sale search page",
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["data", "display"],
        description: "Output mode. data (default) returns JSON. display returns self-contained RTL HTML."
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

    // Strategy 1: article or li cards with data-testid attributes
    var cards = document.querySelectorAll('article[data-testid], li[data-testid*="listing"], li[data-testid*="result"]');

    // Strategy 2: generic article/li cards
    if (cards.length === 0) {
      cards = document.querySelectorAll('article, li[class*="listing"], li[class*="result"], li[class*="card"]');
    }

    // Strategy 3: any anchor containing ₪ in its parent container
    if (cards.length === 0) {
      var priceEls = document.querySelectorAll('*');
      var cardSet = [];
      for (var pi = 0; pi < priceEls.length; pi++) {
        var el = priceEls[pi];
        if (el.childElementCount === 0 && el.textContent.indexOf("₪") > -1) {
          // walk up to a reasonable card boundary
          var parent = el.parentElement;
          for (var depth = 0; depth < 5 && parent; depth++) {
            if (parent.tagName === "ARTICLE" || parent.tagName === "LI" || parent.tagName === "DIV" && parent.offsetHeight > 80) {
              if (cardSet.indexOf(parent) === -1) cardSet.push(parent);
              break;
            }
            parent = parent.parentElement;
          }
        }
      }
      cards = cardSet;
    }

    var seen = {};

    for (var i = 0; i < cards.length && listings.length < limit; i++) {
      var card = cards[i];
      var cardText = card.innerText || card.textContent || "";

      // Skip navigation, header, footer cards
      if (card.closest("nav, header, footer")) continue;
      if (cardText.trim().length < 20) continue;

      // Listing URL
      var linkEl = card.querySelector('a[href*="/item/"], a[href*="/listing/"], a[href*="/for-sale/"]');
      if (!linkEl) linkEl = card.querySelector("a[href]");
      var listingUrl = linkEl ? (linkEl.href || "") : "";
      if (listingUrl && seen[listingUrl]) continue;
      if (listingUrl) seen[listingUrl] = true;

      // Address / neighborhood — try data-testid first
      var addrEl = card.querySelector('[data-testid*="address"], [data-testid*="street"], [data-testid*="neighborhood"]');
      var address = addrEl ? addrEl.textContent.trim() : "";

      // Price — look for ₪
      var priceEl = card.querySelector('[data-testid*="price"]');
      var price = priceEl ? priceEl.textContent.trim() : "";
      if (!price) {
        var allEls = card.querySelectorAll("*");
        for (var ai = 0; ai < allEls.length; ai++) {
          if (allEls[ai].childElementCount === 0 && allEls[ai].textContent.indexOf("₪") > -1) {
            price = allEls[ai].textContent.trim();
            break;
          }
        }
      }

      // Rooms (חדרים), floor (קומה), size (מ"ר / מ״ר)
      var rooms = "";
      var floor = "";
      var sizeSqm = "";

      var lines = cardText.split(/\n/).map(function(l) { return l.trim(); }).filter(Boolean);
      for (var li2 = 0; li2 < lines.length; li2++) {
        var line = lines[li2];
        if (/חדר/.test(line) && !rooms) rooms = line;
        if (/קומה/.test(line) && !floor) floor = line;
        if (/מ[""״]ר|מ"ר|מ״ר|sqm/i.test(line) && !sizeSqm) sizeSqm = line;
      }

      // Fallback: try address from first non-price, non-numeric line
      if (!address) {
        for (var li3 = 0; li3 < lines.length; li3++) {
          var candidate = lines[li3];
          if (candidate.indexOf("₪") === -1 && !/^\d+$/.test(candidate) && candidate.length > 3) {
            address = candidate;
            break;
          }
        }
      }

      if (!price && !address) continue;

      listings.push({
        address: address,
        price: price,
        rooms: rooms,
        floor: floor,
        sizeSqm: sizeSqm,
        listingUrl: listingUrl
      });
    }

    data.listings = listings;
    data.totalResults = listings.length;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#1a1a1a;color:#e0e0e0;padding:24px;max-width:760px;margin:0 auto;border-radius:12px;direction:rtl;\">";
      h += "<h2 style=\"color:#fff;margin:0 0 16px;\">תוצאות מדלן (" + data.totalResults + " מודעות)</h2>";
      for (var k = 0; k < listings.length; k++) {
        var l = listings[k];
        h += "<div style=\"padding:14px 0;border-bottom:1px solid #333;\">";
        if (l.listingUrl) {
          h += "<div style=\"font-weight:600;font-size:15px;margin-bottom:4px;\"><a href=\"" + l.listingUrl + "\" style=\"color:#4da6ff;text-decoration:none;\">" + (l.address || l.listingUrl) + "</a></div>";
        } else {
          h += "<div style=\"font-weight:600;font-size:15px;margin-bottom:4px;\">" + (l.address || "") + "</div>";
        }
        if (l.price) h += "<div style=\"color:#4caf50;font-weight:700;font-size:16px;margin-bottom:4px;\">" + l.price + "</div>";
        var stats = [l.rooms, l.floor, l.sizeSqm].filter(Boolean).join(" &bull; ");
        if (stats) h += "<div style=\"color:#aaa;font-size:13px;\">" + stats + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ listings: [{ address, price, rooms, floor, sizeSqm, listingUrl }], totalResults, pageUrl }`

---

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
- **Comparison:** TBD
