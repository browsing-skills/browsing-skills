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

    var extractField = function(label) {
      var spans = document.querySelectorAll(".property-detail_details__iHCfm");
      for (var i = 0; i < spans.length; i++) {
        if (spans[i].textContent.indexOf(label) !== -1) {
          var valEl = spans[i].querySelector('[data-testid="building-text"]') || spans[i].querySelector(".property-detail_itemValue__V0z6l");
          return valEl ? valEl.textContent.trim() : "";
        }
      }
      return "";
    };

    var data = {};

    data.listingUrl = window.location.href.split("?")[0];
    data.title = getText('[data-testid="heading"]');
    data.address = getText('[data-testid="address"]');
    data.price = getText('[data-testid="price"]');

    data.rooms = extractField("חדרים");
    data.floor = extractField("קומה");
    data.area = extractField('מטר רבוע') || extractField('מ"ר') || extractField("מועד");

    data.description = getText(".description_description__9t6rz");

    data.contactName = getText(".agency-ad-contact-info_name__qDEFO") || getText(".ad-contact-info_name___wj34");
    data.phone = getText(".phone-number-link_phoneNumberText__ayXOk");

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

**Returns:** `{ listingUrl, title, address, price, rooms, floor, area, description, contactName, phone, images }`

---

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
- **Comparison:** TBD
