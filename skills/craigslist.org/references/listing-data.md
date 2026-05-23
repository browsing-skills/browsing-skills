# Craigslist — Listing Data Reference

## Requirements

**Auth:** Not required. Craigslist posting pages are publicly accessible without login.

**Browser:** Recommended. Craigslist posting pages are mostly server-rendered and a `fetch` can often work, but a real browser avoids bot-detection and correctly loads image galleries. If you have browser access (Playwright, a built-in integration, etc.), prefer it. Otherwise use the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

## How to run this action

Navigate to the posting URL and wait for the page to load, then execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output. Use `mode: "markdown"` for plain Markdown.

---

## Action: listing-data

Use when the user wants the full details of a specific Craigslist posting.

**Navigate to:** `https://<city>.craigslist.org/<category>/d/<title-slug>/<id>.html` — the posting's canonical URL as found in search results or shared directly.

**Code:**

```js
({
  name: "craigslist-listing-data",
  description: "Extract full details from a Craigslist posting including title, price, date, description, attributes, location, and images",
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["data", "display", "markdown"],
        description: "Output mode. data (default) returns JSON. display returns self-contained HTML. markdown returns plain Markdown."
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
    data.postingUrl = window.location.href.split("?")[0];

    // Title
    data.title = getText('#titletextonly') ||
                 getText('span[id="titletextonly"]') ||
                 getText('h1.postingtitle') ||
                 getText('h1');

    // Price
    data.price = getText('.price') ||
                 getText('[class*="price"]');

    // Posted / updated date
    var timeEl = document.querySelector('time.timeago, p.postinginfo time, .postinginfo time');
    data.datePosted = timeEl ? (timeEl.getAttribute("datetime") || timeEl.textContent.trim()) : "";

    // Posting body / description
    var bodyEl = document.querySelector('#postingbody');
    if (bodyEl) {
      // Remove the "QR code" notice block Craigslist sometimes prepends
      var cloneBody = bodyEl.cloneNode(true);
      var printEl = cloneBody.querySelector('.print-qrcode-container, .qrcode');
      if (printEl) printEl.remove();
      data.description = cloneBody.innerText ? cloneBody.innerText.trim() : cloneBody.textContent.trim();
    } else {
      data.description = "";
    }

    // Attributes (p.attrgroup > span — each span is one key:value attribute)
    var attrSpans = document.querySelectorAll('p.attrgroup span, .attrgroup span');
    var attributes = [];
    for (var ai = 0; ai < attrSpans.length; ai++) {
      var at = attrSpans[ai].textContent.trim();
      if (at) attributes.push(at);
    }
    data.attributes = attributes;

    // Location — map link or postinginfo
    var mapEl = document.querySelector('#map');
    if (mapEl) {
      data.latitude = mapEl.getAttribute("data-latitude") || "";
      data.longitude = mapEl.getAttribute("data-longitude") || "";
      data.accuracy = mapEl.getAttribute("data-accuracy") || "";
    }
    data.locationText = getText('.mapaddress') ||
                        getText('#mapaddress') ||
                        getText('[class*="mapaddress"]');

    // Images — gallery thumbnails and full-size links
    var images = [];
    var seenSrc = {};

    // New gallery: #thumbs a or figure img
    var imgEls = document.querySelectorAll('#thumbs a, .swipe-wrap img, figure img, #imagecontainer img');
    for (var ii = 0; ii < imgEls.length && images.length < 12; ii++) {
      var src = "";
      if (imgEls[ii].tagName === "A") {
        src = imgEls[ii].href || "";
      } else {
        src = imgEls[ii].src || imgEls[ii].getAttribute("data-src") || "";
        // Convert thumbnail URL to full-size by removing size suffix
        src = src.replace(/_\d+x\d+\./, "_1200x900.");
      }
      if (src && !seenSrc[src] && src.indexOf("data:") === -1) {
        seenSrc[src] = true;
        images.push(src);
      }
    }

    // Fallback: any img inside posting body area
    if (images.length === 0) {
      var allImgs = document.querySelectorAll('.gallery img, #postingbody img');
      for (var gi = 0; gi < allImgs.length && images.length < 12; gi++) {
        var gsrc = allImgs[gi].src || "";
        if (gsrc && !seenSrc[gsrc] && gsrc.indexOf("data:") === -1) {
          seenSrc[gsrc] = true;
          images.push(gsrc);
        }
      }
    }
    data.images = images;

    // Posting ID from URL
    var urlMatch = data.postingUrl.match(/\/(\d+)\.html/);
    data.postingId = urlMatch ? urlMatch[1] : "";

    if (mode === "markdown") {
      var md = "# " + (data.title || "Craigslist Posting") + "\n\n";
      if (data.price) md += "**Price:** " + data.price + "\n\n";
      if (data.datePosted) md += "**Posted:** " + data.datePosted + "\n\n";
      if (data.locationText) md += "**Location:** " + data.locationText + "\n\n";
      if (data.attributes.length > 0) {
        md += "**Attributes:**\n";
        for (var mi = 0; mi < data.attributes.length; mi++) {
          md += "- " + data.attributes[mi] + "\n";
        }
        md += "\n";
      }
      if (data.description) md += "**Description:**\n\n" + data.description + "\n\n";
      if (data.images.length > 0) md += "**Images:** " + data.images.length + " photo(s)\n";
      md += "\n[View on Craigslist](" + data.postingUrl + ")";
      return { content: [{ type: "text", text: md }] };
    }

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#1a1a1a;color:#e0e0e0;padding:24px;max-width:720px;margin:0 auto;border-radius:12px;\">";
      if (data.images.length > 0) {
        h += "<img src=\"" + data.images[0] + "\" style=\"width:100%;border-radius:8px;margin-bottom:16px;object-fit:cover;max-height:300px;\">";
        if (data.images.length > 1) {
          h += "<div style=\"display:flex;gap:8px;margin-bottom:16px;overflow-x:auto;\">";
          for (var thi = 1; thi < data.images.length && thi < 6; thi++) {
            h += "<img src=\"" + data.images[thi] + "\" style=\"width:80px;height:60px;object-fit:cover;border-radius:4px;flex-shrink:0;\">";
          }
          h += "</div>";
        }
      }
      h += "<h2 style=\"color:#fff;margin:0 0 8px;font-size:20px;\">" + (data.title || "") + "</h2>";
      if (data.price) h += "<div style=\"color:#4caf50;font-size:22px;font-weight:700;margin-bottom:12px;\">" + data.price + "</div>";
      var meta2 = [];
      if (data.datePosted) meta2.push("Posted: " + data.datePosted);
      if (data.locationText) meta2.push(data.locationText);
      if (meta2.length) h += "<div style=\"color:#888;font-size:13px;margin-bottom:12px;\">" + meta2.join(" &mdash; ") + "</div>";
      if (data.attributes.length > 0) {
        h += "<div style=\"display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;\">";
        for (var ati = 0; ati < data.attributes.length; ati++) {
          h += "<span style=\"background:#2a2a2a;padding:4px 10px;border-radius:20px;font-size:12px;\">" + data.attributes[ati] + "</span>";
        }
        h += "</div>";
      }
      if (data.description) {
        h += "<div style=\"line-height:1.6;font-size:14px;white-space:pre-wrap;\">" + data.description.substring(0, 800) + (data.description.length > 800 ? "..." : "") + "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ postingUrl, postingId, title, price, datePosted, description, attributes, locationText, latitude, longitude, images }`

---

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
- **Comparison:** TBD
