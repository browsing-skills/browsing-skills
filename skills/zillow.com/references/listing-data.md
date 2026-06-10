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

    // 2025 Zillow listing pages: innerText parsing is most reliable
    var bodyLines = (document.body.innerText || "").split("\n").map(function(l){ return l.trim(); }).filter(Boolean);

    // Helper: find value before a label line
    var findBeforeLabel = function(label) {
      for (var i = 1; i < bodyLines.length; i++) {
        if (bodyLines[i] === label || bodyLines[i].indexOf(label) === 0) {
          return bodyLines[i - 1].replace(label, "").trim();
        }
      }
      return "";
    };

    // Price — first line matching $X,XXX,XXX format
    data.price = "";
    for (var pri = 0; pri < bodyLines.length; pri++) {
      if (/^\$[\d,]+$/.test(bodyLines[pri])) { data.price = bodyLines[pri]; break; }
    }
    if (!data.price) data.price = getText('[data-testid="price"]') || getText('span[data-testid="home-details-price"]');

    // Address — h1 is still reliable on Zillow listing pages
    data.address = getText('h1') || getText('[data-testid="home-details-address"]');

    // Beds / baths / sqft — value before label (e.g. "3\nbeds\n2\nbaths\n1,730\nsqft")
    data.beds = findBeforeLabel("beds") || findBeforeLabel("bd");
    data.baths = findBeforeLabel("baths") || findBeforeLabel("ba");
    data.sqft = findBeforeLabel("sqft");

    // DOM fallback for beds/baths/sqft
    if (!data.beds) {
      var bedBathEls = document.querySelectorAll('[data-testid="bed-bath-item"]');
      var bedBathArr = [];
      for (var i = 0; i < bedBathEls.length; i++) { bedBathArr.push(bedBathEls[i].textContent.trim()); }
      if (bedBathArr.length >= 1) data.beds = bedBathArr[0];
      if (bedBathArr.length >= 2) data.baths = bedBathArr[1];
      if (bedBathArr.length >= 3) data.sqft = bedBathArr[2];
    }

    // Description — prefer data-testid; fallback to largest non-legal paragraph
    data.description = getText('[data-testid="description-text"]') || getText('.ds-overview-section');
    if (!data.description) {
      var pEls = document.querySelectorAll('p');
      var bestDesc = "";
      for (var pi = 0; pi < pEls.length; pi++) {
        var pt = pEls[pi].textContent.trim();
        if (pt.length > bestDesc.length && !/copyright|mls|listing data|idxbroker|multiple listing/i.test(pt)) {
          bestDesc = pt;
        }
      }
      // If still empty, find the paragraph after "What's special" in body text
      if (!bestDesc) {
        var wsIdx = document.body.innerText.indexOf("What's special");
        if (wsIdx > -1) {
          var afterSpecial = document.body.innerText.substring(wsIdx).split("\n\n");
          for (var wsi = 1; wsi < afterSpecial.length; wsi++) {
            var ws = afterSpecial[wsi].trim();
            if (ws.length > 100 && !/^[A-Z\s]+$/.test(ws)) { bestDesc = ws; break; }
          }
        }
      }
      data.description = bestDesc;
    }

    // Zestimate
    data.zestimate = getText('[data-testid="zestimate-text"]') ||
                     getText('[class*="Zestimate"]');

    // Key facts — 2025 Zillow listing pages: parse from body text lines
    var facts = {};
    for (var bli = 0; bli < bodyLines.length; bli++) {
      var bl = bodyLines[bli];
      if (/^built in \d{4}/i.test(bl)) facts.yearBuilt = bl.match(/\d{4}/)[0];
      if (/^(single family|condo|townhouse|multi-family|land|manufactured)/i.test(bl) && !facts.propertyType) facts.propertyType = bl;
      if (/^\d[,\d]*\s+sqft lot/i.test(bl) && !facts.lotSize) facts.lotSize = bl;
      if (/^hoa/i.test(bl) && !facts.hoaFee) facts.hoaFee = bl;
    }
    // DOM fallback
    var factEls = document.querySelectorAll('[class*="fact-container"], [data-testid*="fact"]');
    for (var fi = 0; fi < factEls.length; fi++) {
      var fText = factEls[fi].textContent.trim();
      if (/year built/i.test(fText) && !facts.yearBuilt) facts.yearBuilt = fText.replace(/.*:\s*/, "").trim();
      if (/lot size/i.test(fText) && !facts.lotSize) facts.lotSize = fText.replace(/.*:\s*/, "").trim();
      if (/property type/i.test(fText) && !facts.propertyType) facts.propertyType = fText.replace(/.*:\s*/, "").trim();
      if (/hoa/i.test(fText) && !facts.hoaFee) facts.hoaFee = fText.replace(/.*:\s*/, "").trim();
    }
    data.facts = facts;

    // Top-level convenience fields from facts
    data.propertyType = facts.propertyType || null;
    data.listingStatus = null;
    for (var sli = 0; sli < bodyLines.length; sli++) {
      if (/^(for sale|for rent|pending|sold|off market)/i.test(bodyLines[sli])) {
        data.listingStatus = bodyLines[sli]; break;
      }
    }

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
