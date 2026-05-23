# Google Maps — Place Data Reference

## Requirements

**Auth:** Google Maps place pages are publicly accessible without login. No cookies required.

**Browser:** A real (non-headless) browser is required. Google Maps is a JS-rendered SPA. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

**Wait:** After navigating to the place URL, wait for the main content panel to render: `await page.waitForSelector('h1', { timeout: 10000 })`.

## How to run this action

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: place-data

Use when the user has a specific Google Maps place URL or wants full details about a known place (hours, address, phone, website, rating). Navigate directly to the place URL.

**Navigate to:** The place's Google Maps URL, e.g. `https://www.google.com/maps/place/Eiffel+Tower/@48.8584,2.2945,17z/...` — or obtain it from a place-search result's `url` field.

**Code:**

```js
({
  name: "maps-place-data",
  description: "Extract detailed place information from a Google Maps place page",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};

    // Name — h1 is the most reliable signal on place pages
    var h1 = document.querySelector('h1');
    data.name = h1 ? h1.textContent.trim() : '';

    // Rating — 2025 Maps: .fontDisplayLarge is the most reliable; aria-label has " stars" but no number
    var ratingSpan = document.querySelector('.fontDisplayLarge, [class*="fontDisplayLarge"]');
    if (ratingSpan && /^\d+\.?\d*$/.test(ratingSpan.textContent.trim())) {
      data.rating = ratingSpan.textContent.trim();
    } else {
      var ratingEl = document.querySelector('[aria-label*="stars"], [aria-label*="star"]');
      if (ratingEl) {
        var ratingMatch = (ratingEl.getAttribute('aria-label') || '').match(/([\d.]+)\s+star/i);
        data.rating = ratingMatch ? ratingMatch[1] : (ratingEl.textContent.trim() || null);
      } else {
        data.rating = null;
      }
    }

    // Review count
    var reviewEl = document.querySelector('[aria-label*="review"], button[jsaction*="review"]');
    if (reviewEl) {
      var reviewMatch = (reviewEl.getAttribute('aria-label') || reviewEl.textContent).match(/([\d,]+)\s+review/i);
      data.reviewCount = reviewMatch ? reviewMatch[1] : reviewEl.textContent.trim();
    } else {
      data.reviewCount = null;
    }

    // Category — typically below the name
    var catEl = document.querySelector('button[jsaction*="category"]');
    if (!catEl) catEl = document.querySelector('[class*="fontBodyMedium"] button');
    data.category = catEl ? catEl.textContent.trim() : null;

    // Price level — look for $ symbols
    var priceEl = document.querySelector('[aria-label*="Price"]');
    if (priceEl) {
      data.priceLevel = priceEl.getAttribute('aria-label') || priceEl.textContent.trim();
    } else {
      data.priceLevel = null;
    }

    // Address — button with data-item-id="authority" or aria-label containing address keywords
    var addrBtn = document.querySelector('[data-item-id="authority"], button[data-tooltip="Copy address"]');
    if (addrBtn) {
      data.address = addrBtn.textContent.trim();
    } else {
      // Fallback: look for a div/span that looks like an address
      var allBtns = document.querySelectorAll('button[aria-label]');
      for (var bi = 0; bi < allBtns.length; bi++) {
        var bl = allBtns[bi].getAttribute('aria-label') || '';
        if (/address|street|avenue|road|blvd|st\.|ave\.|rd\./i.test(bl) || /^\d+\s+\w+/.test(bl)) {
          data.address = bl; break;
        }
      }
    }

    // Phone — button with tooltip "Copy phone number"
    var phoneBtn = document.querySelector('[data-tooltip="Copy phone number"], button[aria-label*="phone"], [data-item-id^="phone:"]');
    if (phoneBtn) {
      data.phone = phoneBtn.getAttribute('aria-label') || phoneBtn.textContent.trim();
      data.phone = data.phone.replace(/^Phone:\s*/i, '').trim();
    } else {
      data.phone = null;
    }

    // Website — external link button
    var websiteBtn = document.querySelector('a[data-item-id="authority"], [data-item-id*="web"], a[aria-label*="website"], [data-tooltip="Open website"]');
    if (websiteBtn) {
      data.website = websiteBtn.getAttribute('href') || websiteBtn.getAttribute('aria-label') || '';
      data.website = data.website.replace(/^Website:\s*/i, '').trim();
    } else {
      data.website = null;
    }

    // Hours — 2025 Maps: "Open · Closes X pm" or "Closed · Opens X am" appears in body text
    var hoursEl = document.querySelector('[aria-label*="Hours"], [aria-expanded][class*="hour"]');
    if (hoursEl) {
      var hoursLabel = hoursEl.getAttribute('aria-label') || '';
      data.hours = hoursLabel.replace(/^Hours:\s*/i, '').trim() || hoursEl.textContent.trim();
    }
    if (!data.hours || data.hours === "Hours") {
      var bodyText2 = document.body.innerText || "";
      var openMatch = bodyText2.match(/(Open|Closed)\s*[·•]\s*(Closes|Opens|Open all day|Closed temporar[a-z]*)[\s\S]{0,20}/);
      if (openMatch) data.hours = openMatch[0].split("\n")[0].replace(/[-]/g, "").trim();
      if (!data.hours) {
        var openEl = document.querySelector('[class*="open"], [class*="closed"], span[aria-label*="open"], span[aria-label*="closed"]');
        data.hours = openEl ? openEl.textContent.trim() : null;
      }
    }

    // Hours schedule — try to find the expanded hours table
    var hoursTable = document.querySelector('table[aria-label*="hours"], table[class*="hour"]');
    if (!hoursTable) {
      // Try rows inside a section after clicking hours — may already be visible
      var hoursRows = document.querySelectorAll('[jsaction*="hours"] tr, [aria-label*="Hours"] tr');
      if (hoursRows.length > 0) {
        var schedule = [];
        for (var hi = 0; hi < hoursRows.length; hi++) {
          var cells = hoursRows[hi].querySelectorAll('td, th');
          if (cells.length >= 2) {
            schedule.push(cells[0].textContent.trim() + ': ' + cells[1].textContent.trim());
          }
        }
        data.hoursSchedule = schedule.length > 0 ? schedule : null;
      } else {
        data.hoursSchedule = null;
      }
    } else {
      var scheduleRows = hoursTable.querySelectorAll('tr');
      var schedule2 = [];
      for (var hi2 = 0; hi2 < scheduleRows.length; hi2++) {
        var cells2 = scheduleRows[hi2].querySelectorAll('td, th');
        if (cells2.length >= 2) {
          schedule2.push(cells2[0].textContent.trim() + ': ' + cells2[1].textContent.trim());
        }
      }
      data.hoursSchedule = schedule2.length > 0 ? schedule2 : null;
    }

    data.url = window.location.href;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#fff;color:#202124;padding:24px;max-width:600px;margin:0 auto;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.2);\">";
      h += "<h1 style=\"font-size:22px;margin:0 0 8px;\">" + (data.name || '') + "</h1>";
      var meta = [];
      if (data.category) meta.push(data.category);
      if (data.priceLevel) meta.push(data.priceLevel);
      if (meta.length) h += "<div style=\"color:#5f6368;margin-bottom:12px;\">" + meta.join(' · ') + "</div>";
      if (data.rating) {
        h += "<div style=\"margin-bottom:12px;\"><span style=\"background:#188038;color:#fff;padding:3px 8px;border-radius:4px;\">&#9733; " + data.rating + "</span>";
        if (data.reviewCount) h += " <span style=\"color:#5f6368;font-size:13px;\">(" + data.reviewCount + " reviews)</span>";
        h += "</div>";
      }
      if (data.address) h += "<div style=\"margin-bottom:8px;\"><strong>Address:</strong> " + data.address + "</div>";
      if (data.phone) h += "<div style=\"margin-bottom:8px;\"><strong>Phone:</strong> " + data.phone + "</div>";
      if (data.website) h += "<div style=\"margin-bottom:8px;\"><strong>Website:</strong> <a href=\"" + data.website + "\" style=\"color:#1a73e8;\">" + data.website + "</a></div>";
      if (data.hours) h += "<div style=\"margin-bottom:8px;\"><strong>Hours:</strong> " + data.hours + "</div>";
      if (data.hoursSchedule && data.hoursSchedule.length > 0) {
        h += "<div style=\"margin-top:8px;\"><strong>Schedule:</strong><ul style=\"margin:4px 0;padding-left:20px;color:#5f6368;font-size:13px;\">";
        for (var si = 0; si < data.hoursSchedule.length; si++) {
          h += "<li>" + data.hoursSchedule[si] + "</li>";
        }
        h += "</ul></div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ name, rating, reviewCount, category, priceLevel, address, phone, website, hours, hoursSchedule, url }`

---

## Reporting issues

If one of these actions breaks (selectors changed, Google Maps updated their UI), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
