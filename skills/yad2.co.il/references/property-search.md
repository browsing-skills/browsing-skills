# Yad2 — Property Search Reference

## Requirements

**Auth:** Not required. Yad2 listing search pages are publicly accessible without login.

**Browser:** A real browser is required. Yad2 is a JS-rendered SPA — static fetches will not return listing cards. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

## How to run this action

Navigate to the target URL, wait for listing cards to render, then execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: property-search

Use when the user wants to search Yad2 for properties for sale and extract visible listing cards.

**Navigate to:** `https://www.yad2.co.il/realestate/forsale` (append `?city=<cityCode>` to filter by city, e.g. `?city=5000` for Tel Aviv).

**Code:**

```js
({
  name: "yad2-property-search",
  description: "Extract visible property listing cards from a Yad2 for-sale search page",
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["data", "display"],
        description: "Output mode. data (default) returns JSON. display returns self-contained RTL HTML."
      }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};
    data.pageUrl = window.location.href;

    var anchors = document.querySelectorAll('a[href*="/item/"]');
    var seen = {};
    var listings = [];

    for (var i = 0; i < anchors.length; i++) {
      var anchor = anchors[i];
      var href = anchor.getAttribute("href") || "";
      var fullUrl = href.indexOf("http") === 0 ? href : "https://www.yad2.co.il" + href;

      if (seen[fullUrl]) continue;
      seen[fullUrl] = true;

      var card = anchor;

      var headingEl = card.querySelector(".item-data-content_heading__tphH4");
      var address = headingEl ? headingEl.textContent.trim() : "";

      var infoLines = card.querySelectorAll(".item-data-content_itemInfoLine__AeoPP");
      var typeAndCity = infoLines.length > 0 ? infoLines[0].textContent.trim() : "";
      var details = infoLines.length > 1 ? infoLines[1].textContent.trim() : "";

      var priceEl = card.querySelector('[data-testid="price"]');
      var price = priceEl ? priceEl.textContent.trim() : "";

      if (!address && !price) continue;

      listings.push({
        listingUrl: fullUrl,
        address: address,
        typeAndCity: typeAndCity,
        details: details,
        price: price
      });
    }

    data.listings = listings;
    data.totalResults = listings.length;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#1a1a1a;color:#e0e0e0;padding:24px;max-width:760px;margin:0 auto;border-radius:12px;direction:rtl;\">";
      h += "<h2 style=\"color:#fff;margin:0 0 16px;\">תוצאות חיפוש (" + data.totalResults + " מודעות)</h2>";
      for (var j = 0; j < listings.length; j++) {
        var l = listings[j];
        h += "<div style=\"padding:14px 0;border-bottom:1px solid #333;\">";
        h += "<div style=\"font-weight:600;font-size:15px;margin-bottom:4px;\"><a href=\"" + l.listingUrl + "\" style=\"color:#4da6ff;text-decoration:none;\">" + (l.address || l.listingUrl) + "</a></div>";
        if (l.typeAndCity) h += "<div style=\"color:#aaa;font-size:13px;margin-bottom:2px;\">" + l.typeAndCity + "</div>";
        if (l.details) h += "<div style=\"color:#aaa;font-size:13px;margin-bottom:4px;\">" + l.details + "</div>";
        if (l.price) h += "<div style=\"color:#4caf50;font-weight:600;font-size:15px;\">" + l.price + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ listings: [{ listingUrl, address, typeAndCity, details, price }], totalResults, pageUrl }`

---

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
- **Comparison:** TBD
