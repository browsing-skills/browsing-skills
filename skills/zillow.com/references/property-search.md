# Zillow — Property Search Reference

## Requirements

**Auth:** Not required. Zillow listing search pages are publicly accessible without login.

**Browser:** A real browser is required. Zillow is a JS-rendered SPA — static fetches will not return listing cards. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

## How to run this action

Navigate to the target URL, wait for listing cards to render, then execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data", limit: 20 });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: property-search

Use when the user wants to search Zillow for properties in a city and extract visible listing cards.

**Navigate to:** `https://www.zillow.com/homes/<city>_rb/` — replace `<city>` with the city name, underscored and URL-safe (e.g. `San-Francisco_rb`, `Austin_rb`, `Chicago_rb`).

**Code:**

```js
({
  name: "zillow-property-search",
  description: "Extract visible property listing cards from a Zillow homes search page",
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

    var cards = document.querySelectorAll('article[data-test="property-card"]');
    var listings = [];

    for (var i = 0; i < cards.length && listings.length < limit; i++) {
      var card = cards[i];

      var addrEl = card.querySelector('[data-test="property-card-addr"]');
      var address = addrEl ? addrEl.textContent.trim() : "";

      var priceEl = card.querySelector('[data-test="property-card-price"]');
      var price = priceEl ? priceEl.textContent.trim() : "";

      // beds/baths/sqft live in a ul > li list
      var beds = "";
      var baths = "";
      var sqft = "";
      var liEls = card.querySelectorAll("ul li");
      for (var j = 0; j < liEls.length; j++) {
        var txt = liEls[j].textContent.trim();
        if (/bd|bed/i.test(txt)) beds = txt;
        else if (/ba|bath/i.test(txt)) baths = txt;
        else if (/sqft|sq\s*ft/i.test(txt)) sqft = txt;
      }

      // Some cards expose individual data-test attributes for beds
      if (!beds) {
        var bedsEl = card.querySelector('[data-test="property-card-beds"]');
        beds = bedsEl ? bedsEl.textContent.trim() : "";
      }

      var linkEl = card.querySelector('a[data-test="property-card-link"]');
      if (!linkEl) linkEl = card.querySelector('a[href*="/homedetails/"]');
      var listingUrl = linkEl ? linkEl.href : "";

      var imgEl = card.querySelector("img");
      var thumbnail = imgEl ? (imgEl.src || imgEl.getAttribute("data-src") || "") : "";

      var domEl = card.querySelector('[class*="days"]');
      var daysOnMarket = domEl ? domEl.textContent.trim() : "";

      var typeEl = card.querySelector('[class*="StyledPropertyCardHomeType"]');
      if (!typeEl) typeEl = card.querySelector('[class*="property-type"]');
      var propertyType = typeEl ? typeEl.textContent.trim() : "";

      if (!address && !price) continue;

      listings.push({
        address: address,
        price: price,
        beds: beds,
        baths: baths,
        sqft: sqft,
        propertyType: propertyType,
        daysOnMarket: daysOnMarket,
        thumbnail: thumbnail,
        listingUrl: listingUrl
      });
    }

    data.listings = listings;
    data.totalResults = listings.length;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#1a1a1a;color:#e0e0e0;padding:24px;max-width:800px;margin:0 auto;border-radius:12px;\">";
      h += "<h2 style=\"color:#fff;margin:0 0 16px;\">Zillow Results (" + data.totalResults + " listings)</h2>";
      for (var k = 0; k < listings.length; k++) {
        var l = listings[k];
        h += "<div style=\"display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #333;align-items:flex-start;\">";
        if (l.thumbnail) h += "<img src=\"" + l.thumbnail + "\" style=\"width:120px;height:80px;object-fit:cover;border-radius:6px;flex-shrink:0;\">";
        h += "<div style=\"flex:1;\">";
        h += "<div style=\"font-weight:600;font-size:15px;margin-bottom:4px;\"><a href=\"" + l.listingUrl + "\" style=\"color:#4da6ff;text-decoration:none;\">" + (l.address || l.listingUrl) + "</a></div>";
        h += "<div style=\"color:#4caf50;font-weight:700;font-size:16px;margin-bottom:4px;\">" + (l.price || "") + "</div>";
        var stats = [l.beds, l.baths, l.sqft].filter(Boolean).join(" &bull; ");
        if (stats) h += "<div style=\"color:#aaa;font-size:13px;margin-bottom:2px;\">" + stats + "</div>";
        if (l.propertyType) h += "<div style=\"color:#888;font-size:12px;\">" + l.propertyType + "</div>";
        if (l.daysOnMarket) h += "<div style=\"color:#888;font-size:12px;\">" + l.daysOnMarket + "</div>";
        h += "</div></div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ listings: [{ address, price, beds, baths, sqft, propertyType, daysOnMarket, thumbnail, listingUrl }], totalResults, pageUrl }`

---

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
- **Comparison:** TBD
