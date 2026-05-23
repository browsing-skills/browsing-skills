# Madlan — Listing Data Reference

## Requirements

**Auth:** Not required. Madlan individual listing pages are publicly accessible without login.

**Browser:** A real browser is required. Madlan is a JS-rendered React SPA — static fetches will not return listing content. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

**RTL / Hebrew:** The page renders in Hebrew with RTL layout. Field labels to match: חדרים (rooms), קומה (floor), מ"ר / מ״ר (sqm), מחיר (price), תיאור (description).

## How to run this action

Navigate to the listing URL and wait for the page to fully render, then execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained RTL HTML output instead of JSON.

---

## Action: listing-data

Use when the user wants the full details of a specific Madlan property listing.

**Navigate to:** The listing's canonical URL on madlan.co.il (e.g. `https://www.madlan.co.il/listing/<id>`).

**Code:**

```js
({
  name: "madlan-listing-data",
  description: "Extract full property details from a Madlan listing page including address, price, rooms, floor, size, property type, description, amenities, and agent name",
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

    var getTestId = function(tid) {
      var el = document.querySelector('[data-testid="' + tid + '"]');
      return el ? el.textContent.trim() : "";
    };

    var data = {};
    data.listingUrl = window.location.href.split("?")[0];

    // Full page text for Hebrew field parsing
    var bodyText = document.body.innerText || document.body.textContent || "";
    var lines = bodyText.split(/\n/).map(function(l) { return l.trim(); }).filter(Boolean);

    // Madlan 2025 listing page: value appears BEFORE its label (e.g. "4\nחדרים\n501\nמ״ר")
    var findBeforeLabel = function(label) {
      for (var i = 1; i < lines.length; i++) {
        if (lines[i].indexOf(label) > -1) {
          // same-line value (unlikely but check)
          var same = lines[i].replace(label, "").replace(/[:：]/, "").trim();
          if (same) return same;
          return lines[i - 1].trim();
        }
      }
      return "";
    };

    // Price — first line containing ₪ in page text; also try DOM class selectors
    data.price = "";
    for (var pi2 = 0; pi2 < lines.length; pi2++) {
      if (lines[pi2].indexOf("₪") > -1) { data.price = lines[pi2]; break; }
    }
    if (!data.price) {
      var priceEls = document.querySelectorAll('[class*="price"], [class*="Price"]');
      for (var pi = 0; pi < priceEls.length; pi++) {
        var pt = priceEls[pi].textContent.trim();
        if (pt.indexOf("₪") > -1 && priceEls[pi].childElementCount === 0) { data.price = pt; break; }
      }
    }

    // Address — look for line that contains a comma and Hebrew city names
    data.address = "";
    for (var ai2 = 0; ai2 < lines.length; ai2++) {
      var al = lines[ai2];
      if (al.indexOf(",") > -1 && al.length > 10 && al.indexOf("₪") === -1 && /[֐-׿]/.test(al)) {
        data.address = al; break;
      }
    }
    if (!data.address) data.address = getText("h1") || "";

    data.rooms = findBeforeLabel("חדרים") || findBeforeLabel("חדר");
    data.floor = findBeforeLabel("קומה");
    data.totalFloors = findBeforeLabel("קומות");
    data.sizeSqm = findBeforeLabel("מ״ר") || findBeforeLabel('מ"ר') || findBeforeLabel("מ״ר") || findBeforeLabel("שטח");
    data.propertyType = getTestId("property-type") || findBeforeLabel("סוג הנכס") || findBeforeLabel("סוג נכס") || findBeforeLabel("למכירה") || "";

    // Description — try data-testid, then class, then largest text block
    data.description = getTestId("description") || getTestId("listing-description") || getText('[class*="description"], [class*="Description"]');
    if (!data.description) {
      var candidates = document.querySelectorAll("p");
      var longest = "";
      for (var ci = 0; ci < candidates.length; ci++) {
        var ct = candidates[ci].textContent.trim();
        if (ct.length > longest.length) longest = ct;
      }
      data.description = longest;
    }

    // Amenities — list items in a features/amenities section
    var amenities = [];
    var amenEls = document.querySelectorAll('[data-testid*="amenity"], [data-testid*="feature"], [class*="amenities"] li, [class*="features"] li');
    for (var ai = 0; ai < amenEls.length; ai++) {
      var at = amenEls[ai].textContent.trim();
      if (at && amenities.indexOf(at) === -1) amenities.push(at);
    }
    // Fallback: known Hebrew amenity keywords in lines
    if (amenities.length === 0) {
      var amenityKeywords = ["מעלית", "חניה", "מרפסת", "מחסן", "גינה", "בריכה", "ממ\"ד", "ממ״ד", "סאונה", "נגיש", "ריהוט"];
      for (var li2 = 0; li2 < lines.length; li2++) {
        for (var ki = 0; ki < amenityKeywords.length; ki++) {
          if (lines[li2].indexOf(amenityKeywords[ki]) > -1 && amenities.indexOf(lines[li2]) === -1) {
            amenities.push(lines[li2]);
          }
        }
      }
    }
    data.amenities = amenities;

    // Agent name
    data.agentName = getTestId("agent-name") || getTestId("contact-name") || getText('[class*="agent"] [class*="name"], [class*="contact"] [class*="name"]');

    // Images
    var imgEls = document.querySelectorAll('img[src*="madlan"], img[src*="media"], img[class*="gallery"]');
    var images = [];
    var seenSrc = {};
    for (var ii = 0; ii < imgEls.length && images.length < 6; ii++) {
      var src = imgEls[ii].src || imgEls[ii].getAttribute("data-src") || "";
      if (src && !seenSrc[src] && src.indexOf("data:") === -1) {
        seenSrc[src] = true;
        images.push(src);
      }
    }
    data.images = images;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#1a1a1a;color:#e0e0e0;padding:24px;max-width:720px;margin:0 auto;border-radius:12px;direction:rtl;\">";
      if (data.images.length > 0) {
        h += "<img src=\"" + data.images[0] + "\" style=\"width:100%;border-radius:8px;margin-bottom:16px;object-fit:cover;max-height:300px;\">";
      }
      h += "<h2 style=\"color:#fff;margin:0 0 8px;font-size:20px;\">" + (data.address || "") + "</h2>";
      if (data.price) h += "<div style=\"color:#4caf50;font-size:22px;font-weight:700;margin-bottom:12px;\">" + data.price + "</div>";
      h += "<div style=\"display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;\">";
      if (data.rooms) h += "<div style=\"background:#2a2a2a;padding:8px 14px;border-radius:8px;\"><span style=\"color:#aaa;font-size:12px;display:block;\">חדרים</span><span style=\"font-weight:600;\">" + data.rooms + "</span></div>";
      if (data.floor) h += "<div style=\"background:#2a2a2a;padding:8px 14px;border-radius:8px;\"><span style=\"color:#aaa;font-size:12px;display:block;\">קומה</span><span style=\"font-weight:600;\">" + data.floor + (data.totalFloors ? "/" + data.totalFloors : "") + "</span></div>";
      if (data.sizeSqm) h += "<div style=\"background:#2a2a2a;padding:8px 14px;border-radius:8px;\"><span style=\"color:#aaa;font-size:12px;display:block;\">שטח</span><span style=\"font-weight:600;\">" + data.sizeSqm + " מ\"ר</span></div>";
      if (data.propertyType) h += "<div style=\"background:#2a2a2a;padding:8px 14px;border-radius:8px;\"><span style=\"color:#aaa;font-size:12px;display:block;\">סוג נכס</span><span style=\"font-weight:600;\">" + data.propertyType + "</span></div>";
      h += "</div>";
      if (data.description) {
        h += "<div style=\"line-height:1.7;font-size:14px;margin-bottom:16px;white-space:pre-wrap;\">" + data.description.substring(0, 600) + (data.description.length > 600 ? "..." : "") + "</div>";
      }
      if (data.amenities.length > 0) {
        h += "<div style=\"margin-bottom:12px;\"><div style=\"font-weight:600;margin-bottom:6px;\">מאפיינים</div>";
        h += "<div style=\"display:flex;flex-wrap:wrap;gap:8px;\">";
        for (var ami = 0; ami < data.amenities.length; ami++) {
          h += "<span style=\"background:#2a2a2a;padding:4px 10px;border-radius:20px;font-size:13px;\">" + data.amenities[ami] + "</span>";
        }
        h += "</div></div>";
      }
      if (data.agentName) h += "<div style=\"border-top:1px solid #333;padding-top:12px;color:#aaa;font-size:13px;\">סוכן: <span style=\"color:#e0e0e0;font-weight:600;\">" + data.agentName + "</span></div>";
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ listingUrl, address, price, rooms, floor, totalFloors, sizeSqm, propertyType, description, amenities, agentName, images }`

---

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
- **Comparison:** TBD
