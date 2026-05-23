# Zillow — Listing Data Reference

## Requirements

**Auth:** Not required. Zillow individual listing pages are publicly accessible without login.

**Browser:** A real browser is required. Zillow is a JS-rendered SPA — static fetches will not return listing content. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

## How to run this action

Navigate to the listing URL and wait for the page to fully render, then execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: listing-data

Use when the user wants the full details of a specific Zillow property listing.

**Navigate to:** `https://www.zillow.com/homedetails/<address>/<zpid>_zpid/` — the listing's canonical URL as shown on Zillow.

**Code:**

```js
({
  name: "zillow-listing-data",
  description: "Extract full property details from a Zillow listing page including address, price, beds, baths, sqft, Zestimate, agent, open houses, and facts & features",
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

    var getText = function(selector) {
      var el = document.querySelector(selector);
      return el ? el.textContent.trim() : "";
    };

    var data = {};
    data.listingUrl = window.location.href.split("?")[0];

    // Main summary container
    var summaryEl = document.querySelector('[data-testid="home-details-summary-container"]');
    if (!summaryEl) summaryEl = document.body;

    data.price = getText('[data-testid="price"]') ||
                 getText('span[data-testid="home-details-price"]') ||
                 getText('.ds-summary-row .ds-value');

    // Address
    data.address = getText('h1') ||
                   getText('[data-testid="home-details-address"]') ||
                   getText('.ds-address-container');

    // Beds / baths / sqft from summary row
    var bedBathEls = document.querySelectorAll('[data-testid="bed-bath-item"]');
    var bedBathArr = [];
    for (var i = 0; i < bedBathEls.length; i++) {
      bedBathArr.push(bedBathEls[i].textContent.trim());
    }

    if (bedBathArr.length >= 1) data.beds = bedBathArr[0];
    if (bedBathArr.length >= 2) data.baths = bedBathArr[1];
    if (bedBathArr.length >= 3) data.sqft = bedBathArr[2];

    // Fallback: parse summary row spans
    if (!data.beds) {
      var spans = document.querySelectorAll('.ds-bed-bath-living-area span');
      for (var si = 0; si < spans.length; si++) {
        var st = spans[si].textContent.trim();
        if (/bd|bed/i.test(st) && !data.beds) data.beds = st;
        else if (/ba|bath/i.test(st) && !data.baths) data.baths = st;
        else if (/sqft/i.test(st) && !data.sqft) data.sqft = st;
      }
    }

    // Description
    data.description = getText('[data-testid="description-text"]') ||
                        getText('.ds-overview-section');

    // Zestimate
    data.zestimate = getText('[data-testid="zestimate-text"]') ||
                     getText('[class*="Zestimate"]');

    // Key facts (year built, property type, lot size, etc.)
    var facts = {};
    var factEls = document.querySelectorAll('[class*="fact-container"], [data-testid*="fact"]');
    for (var fi = 0; fi < factEls.length; fi++) {
      var fText = factEls[fi].textContent.trim();
      if (/year built/i.test(fText)) facts.yearBuilt = fText.replace(/.*:\s*/, "").trim();
      if (/lot size/i.test(fText)) facts.lotSize = fText.replace(/.*:\s*/, "").trim();
      if (/property type/i.test(fText)) facts.propertyType = fText.replace(/.*:\s*/, "").trim();
      if (/hoa/i.test(fText)) facts.hoaFee = fText.replace(/.*:\s*/, "").trim();
      if (/days on zillow/i.test(fText)) facts.daysOnMarket = fText.replace(/.*:\s*/, "").trim();
    }

    // Fallback: scrape summary table rows
    if (!facts.yearBuilt) {
      var tableRows = document.querySelectorAll('ul[class*="summary"] li, .ds-home-fact-list li');
      for (var tri = 0; tri < tableRows.length; tri++) {
        var rTxt = tableRows[tri].textContent.trim();
        if (/year built/i.test(rTxt) && !facts.yearBuilt) facts.yearBuilt = rTxt;
        if (/lot/i.test(rTxt) && !facts.lotSize) facts.lotSize = rTxt;
        if (/hoa/i.test(rTxt) && !facts.hoaFee) facts.hoaFee = rTxt;
      }
    }
    data.facts = facts;

    // Agent / listing agent
    data.agentName = getText('[data-testid="attribution-LISTING_AGENT"]') ||
                     getText('[class*="listing-agent"]');

    // Open house dates
    var ohEls = document.querySelectorAll('[data-testid*="open-house"], [class*="open-house"]');
    var openHouses = [];
    for (var oi = 0; oi < ohEls.length; oi++) {
      var ohTxt = ohEls[oi].textContent.trim();
      if (ohTxt) openHouses.push(ohTxt);
    }
    data.openHouses = openHouses;

    // Price history — rows in table
    var phRows = document.querySelectorAll('[data-testid="price-history"] tr, [class*="priceHistory"] tr');
    var priceHistory = [];
    for (var phi = 0; phi < phRows.length && priceHistory.length < 10; phi++) {
      var phTxt = phRows[phi].textContent.trim();
      if (phTxt) priceHistory.push(phTxt);
    }
    data.priceHistory = priceHistory;

    // Images
    var imgEls = document.querySelectorAll('picture img, [class*="media-stream"] img');
    var images = [];
    var seenSrc = {};
    for (var ii = 0; ii < imgEls.length && images.length < 6; ii++) {
      var src = imgEls[ii].src || imgEls[ii].getAttribute("data-src") || "";
      if (src && src.indexOf("zillow") > -1 && !seenSrc[src]) {
        seenSrc[src] = true;
        images.push(src);
      }
    }
    data.images = images;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#1a1a1a;color:#e0e0e0;padding:24px;max-width:720px;margin:0 auto;border-radius:12px;\">";
      if (data.images.length > 0) {
        h += "<img src=\"" + data.images[0] + "\" style=\"width:100%;border-radius:8px;margin-bottom:16px;object-fit:cover;max-height:320px;\">";
      }
      h += "<h2 style=\"color:#fff;margin:0 0 8px;font-size:20px;\">" + (data.address || "") + "</h2>";
      if (data.price) h += "<div style=\"color:#4caf50;font-size:24px;font-weight:700;margin-bottom:12px;\">" + data.price + "</div>";
      if (data.zestimate) h += "<div style=\"color:#aaa;font-size:13px;margin-bottom:12px;\">Zestimate: " + data.zestimate + "</div>";
      h += "<div style=\"display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;\">";
      if (data.beds) h += "<div style=\"background:#2a2a2a;padding:8px 14px;border-radius:8px;\"><span style=\"color:#aaa;font-size:12px;display:block;\">Beds</span><span style=\"font-weight:600;\">" + data.beds + "</span></div>";
      if (data.baths) h += "<div style=\"background:#2a2a2a;padding:8px 14px;border-radius:8px;\"><span style=\"color:#aaa;font-size:12px;display:block;\">Baths</span><span style=\"font-weight:600;\">" + data.baths + "</span></div>";
      if (data.sqft) h += "<div style=\"background:#2a2a2a;padding:8px 14px;border-radius:8px;\"><span style=\"color:#aaa;font-size:12px;display:block;\">Sqft</span><span style=\"font-weight:600;\">" + data.sqft + "</span></div>";
      h += "</div>";
      if (data.description) {
        h += "<div style=\"line-height:1.6;font-size:14px;margin-bottom:16px;\">" + data.description.substring(0, 600) + (data.description.length > 600 ? "..." : "") + "</div>";
      }
      if (Object.keys(data.facts).length > 0) {
        h += "<div style=\"background:#222;padding:12px;border-radius:8px;margin-bottom:12px;\">";
        h += "<div style=\"font-weight:600;margin-bottom:8px;\">Key Facts</div>";
        for (var fk in data.facts) {
          h += "<div style=\"color:#aaa;font-size:13px;margin-bottom:3px;\">" + fk + ": <span style=\"color:#e0e0e0;\">" + data.facts[fk] + "</span></div>";
        }
        h += "</div>";
      }
      if (data.agentName) h += "<div style=\"border-top:1px solid #333;padding-top:12px;color:#aaa;font-size:13px;\">Listed by: <span style=\"color:#e0e0e0;font-weight:600;\">" + data.agentName + "</span></div>";
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ listingUrl, address, price, beds, baths, sqft, zestimate, description, facts: { yearBuilt, lotSize, propertyType, hoaFee, daysOnMarket }, agentName, openHouses, priceHistory, images }`

---

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
- **Comparison:** TBD
