# Yad2 — Listing Data Reference

## Requirements

**Auth:** Not required. Yad2 individual listing pages are publicly accessible without login.

**Browser:** A real browser is required. Yad2 is a JS-rendered SPA — static fetches will not return listing content. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

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

Use when the user wants the full details of a specific Yad2 property listing.

**Navigate to:** `https://www.yad2.co.il/item/<id>` (the listing's canonical URL).

**Code:**

```js
({
  name: "yad2-listing-data",
  description: "Extract full property details from a Yad2 listing page including title, address, price, attributes, description, contact info, and images",
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

    var getText = function(selector) {
      var el = document.querySelector(selector);
      return el ? el.textContent.trim() : "";
    };

    // Yad2 2025: all key fields exposed via stable data-testid attributes
    var getTestId = function(tid) {
      var el = document.querySelector('[data-testid="' + tid + '"]');
      return el ? el.textContent.trim() : "";
    };

    var data = {};

    data.listingUrl  = window.location.href.split("?")[0];
    data.title       = getTestId("heading");        // neighbourhood / street
    data.address     = getTestId("address");        // property type + city
    data.fullAddress = getTestId("address-line");   // full street address
    data.price       = getTestId("price");
    data.description = getTestId("property-description");

    // Structured property details
    data.buildingDetails = getTestId("building-details"); // e.g. "5חדריםקומה3/10145מ״ר"
    data.dealType        = getTestId("deal-type-value");
    data.condition       = getTestId("property-condition-value");
    data.areaSqm         = getTestId("square-meter-build-value");
    data.rooms           = getTestId("rooms-value");
    data.floor           = getTestId("floor-value");
    data.area            = data.areaSqm;
    if (!data.rooms && data.buildingDetails) {
      var roomsMatch = data.buildingDetails.match(/([\d.]+)\s*חדרים/);
      if (roomsMatch) data.rooms = roomsMatch[1];
    }
    if (!data.floor && data.buildingDetails) {
      var floorMatch = data.buildingDetails.match(/קומה\s*([^\s/]+(?:\/[^\s]+)?)/);
      if (floorMatch) data.floor = floorMatch[1];
    }
    data.totalFloors     = getTestId("building-top-floor-value");
    data.parking         = getTestId("parking-value");
    data.pricePerSqm     = getTestId("price-per-squaremeter-value");
    data.entranceDate    = getTestId("entrance-date-value");
    data.publishedDate   = getTestId("report-ad-label").replace(/^פורסם ב\s*/, "").trim();

    // Amenities list from the "מה יש בנכס" grid
    var amenGrid = document.querySelector('[data-testid="in-property-grid"]');
    data.amenities = amenGrid ? amenGrid.innerText.trim().split(/\n+/).map(function(l){return l.trim();}).filter(Boolean) : [];

    // Contact
    data.contactName = getTestId("agency-ad-contact-info-name");
    data.phone       = getText('[data-testid="phone-number-link-anchor"]');

    var imgEls = document.querySelectorAll('img[src*="yad2"]');
    var images = [];
    var seenSrc = {};
    for (var i = 0; i < imgEls.length && images.length < 5; i++) {
      var src = imgEls[i].src;
      if (src && !seenSrc[src]) {
        seenSrc[src] = true;
        images.push(src);
      }
    }
    data.images = images;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#1a1a1a;color:#e0e0e0;padding:24px;max-width:700px;margin:0 auto;border-radius:12px;direction:rtl;\">";
      if (data.images.length > 0) {
        h += "<img src=\"" + data.images[0] + "\" style=\"width:100%;border-radius:8px;margin-bottom:16px;object-fit:cover;max-height:300px;\">";
      }
      h += "<h2 style=\"color:#fff;margin:0 0 8px;font-size:20px;\">" + (data.title || data.address || "") + "</h2>";
      if (data.address && data.address !== data.title) {
        h += "<div style=\"color:#aaa;font-size:14px;margin-bottom:12px;\">" + data.address + "</div>";
      }
      if (data.price) {
        h += "<div style=\"color:#4caf50;font-size:22px;font-weight:700;margin-bottom:16px;\">" + data.price + "</div>";
      }
      h += "<div style=\"display:flex;gap:20px;margin-bottom:16px;flex-wrap:wrap;\">";
      if (data.rooms) h += "<div style=\"background:#2a2a2a;padding:8px 14px;border-radius:8px;\"><span style=\"color:#aaa;font-size:12px;display:block;\">חדרים</span><span style=\"font-weight:600;\">" + data.rooms + "</span></div>";
      if (data.floor) h += "<div style=\"background:#2a2a2a;padding:8px 14px;border-radius:8px;\"><span style=\"color:#aaa;font-size:12px;display:block;\">קומה</span><span style=\"font-weight:600;\">" + data.floor + "</span></div>";
      if (data.area) h += "<div style=\"background:#2a2a2a;padding:8px 14px;border-radius:8px;\"><span style=\"color:#aaa;font-size:12px;display:block;\">שטח</span><span style=\"font-weight:600;\">" + data.area + " מ\"ר</span></div>";
      h += "</div>";
      if (data.description) {
        h += "<div style=\"line-height:1.6;margin-bottom:16px;white-space:pre-wrap;font-size:14px;\">" + data.description.substring(0, 600) + (data.description.length > 600 ? "..." : "") + "</div>";
      }
      if (data.contactName || data.phone) {
        h += "<div style=\"border-top:1px solid #333;padding-top:12px;\">";
        if (data.contactName) h += "<div style=\"font-weight:600;margin-bottom:4px;\">" + data.contactName + "</div>";
        if (data.phone) h += "<div style=\"color:#4da6ff;\">" + data.phone + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ listingUrl, title, address, fullAddress, price, rooms, floor, area, areaSqm, buildingDetails, dealType, condition, totalFloors, parking, pricePerSqm, entranceDate, publishedDate, amenities, description, contactName, phone, images }`

---

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
- **Comparison:** TBD
