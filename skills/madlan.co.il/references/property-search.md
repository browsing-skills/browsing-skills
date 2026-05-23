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

    // Madlan 2025: listing cards are <a href="/listings/<id>"> anchors
    // Each anchor's textContent: price | rooms/sqm | address
    var cardLinks = document.querySelectorAll('a[href*="/listings/"]');

    var seen = {};

    for (var i = 0; i < cardLinks.length && listings.length < limit; i++) {
      var card = cardLinks[i];
      var listingUrl = card.href || "";
      if (!listingUrl || seen[listingUrl]) continue;
      seen[listingUrl] = true;

      var cardText = card.innerText || card.textContent || "";
      if (!cardText || cardText.indexOf("₪") === -1) continue;

      var lines = cardText.split(/\n/).map(function(l) { return l.trim(); }).filter(Boolean);

      // Price: line with ₪
      var price = "";
      var rooms = "";
      var floor = "";
      var sizeSqm = "";
      var address = "";

      for (var li2 = 0; li2 < lines.length; li2++) {
        var line = lines[li2];
        if (!price && line.indexOf("₪") > -1) { price = line; continue; }
        if (/חדר|\d+\s*חד/.test(line) && !rooms) { rooms = line; continue; }
        if (/מ[""״]ר|מ"ר|מ״ר/i.test(line) && !sizeSqm) { sizeSqm = line; continue; }
        if (/קומה/.test(line) && !floor) { floor = line; continue; }
      }

      // Address: last meaningful line that's not price/rooms/sqm
      for (var li3 = lines.length - 1; li3 >= 0; li3--) {
        var l3 = lines[li3];
        if (l3 !== price && l3 !== rooms && l3 !== sizeSqm && l3 !== floor && l3.length > 5 && l3.indexOf("₪") === -1) {
          address = l3; break;
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
