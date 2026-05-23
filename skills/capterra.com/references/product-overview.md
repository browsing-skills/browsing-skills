# Capterra — Product Overview Reference

## Requirements

**Auth:** Not required for public product pages. Capterra product overviews are publicly accessible.

**Browser:** Use a real browser or Chrome Bridge. Capterra is a JavaScript-rendered app. JSON-LD structured data is embedded in the page and is the most reliable extraction path when available.

## How to run this action

Navigate first, wait for the page to fully render, then execute the code via `page.evaluate()` or Chrome Bridge `/run-action`:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: capterra-product-overview

Use when the user wants aggregate rating data, category breakdowns, pricing, or descriptions for a software product on Capterra.

**Navigate to:** `https://www.capterra.com/p/<id>/<slug>/`

Examples:

- `https://www.capterra.com/p/67095/Slack/`
- `https://www.capterra.com/p/232666/Notion/`

**Code:**

```js
({
  name: "capterra-product-overview",
  description: "Extract Capterra product overview: name, overall rating, review count, category breakdowns (ease of use, customer service, features, value), description, and pricing",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";

    function clean(s) { return (s || "").replace(/\s+/g, " ").trim(); }
    function esc(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function textOf(selector) {
      var el = document.querySelector(selector);
      return el ? clean(el.innerText || el.textContent) : "";
    }
    function numFrom(v) {
      v = clean(String(v || "")).replace(/,/g, "");
      if (!v) return null;
      var n = parseFloat(v.replace(/[^0-9.]/g, ""));
      return isNaN(n) ? null : n;
    }

    // Try JSON-LD structured data first (most reliable)
    var jsonLd = null;
    var jsonLdEls = document.querySelectorAll('script[type="application/ld+json"]');
    for (var si = 0; si < jsonLdEls.length; si++) {
      try {
        var parsed = JSON.parse(jsonLdEls[si].textContent);
        var candidates = Array.isArray(parsed) ? parsed : [parsed];
        for (var ci = 0; ci < candidates.length; ci++) {
          if (candidates[ci] && (candidates[ci]["@type"] === "SoftwareApplication" || candidates[ci].aggregateRating)) {
            jsonLd = candidates[ci];
            break;
          }
        }
        if (jsonLd) break;
      } catch (e) { /* ignore parse errors */ }
    }

    var productName = "";
    var overallRating = null;
    var reviewCount = null;
    var description = "";

    if (jsonLd) {
      productName = clean(jsonLd.name || "");
      description = clean(jsonLd.description || "");
      if (jsonLd.aggregateRating) {
        overallRating = parseFloat(jsonLd.aggregateRating.ratingValue) || null;
        reviewCount = numFrom(String(jsonLd.aggregateRating.reviewCount || jsonLd.aggregateRating.ratingCount || ""));
      }
    }

    // HTML fallbacks
    if (!productName) {
      productName = textOf('h1') ||
                    textOf('[data-testid*="product-name"]') ||
                    document.title.replace(/Reviews.*$/i, "").replace(/\|.*$/, "").trim();
    }
    if (!overallRating) {
      var ratingRaw = textOf('[data-testid*="overall-rating"]') ||
                      textOf('.overall-rating') ||
                      textOf('[class*="overall"][class*="rating"]') || "";
      overallRating = parseFloat(ratingRaw) || null;
    }
    if (!reviewCount) {
      var countRaw = textOf('[data-testid*="review-count"]') ||
                     textOf('[class*="review-count"]') || "";
      reviewCount = numFrom(countRaw.replace(/reviews?/i, ""));
    }
    if (!description) {
      description = textOf('[data-testid*="description"]') ||
                    textOf('[class*="product-description"]') ||
                    textOf('[class*="description"] p') || "";
    }

    // Category breakdowns: ease of use, customer service, features, value
    var breakdowns = {};
    var breakdownLabels = ["ease of use", "customer service", "features", "value for money", "value", "functionality"];
    var ratingItems = document.querySelectorAll('[data-testid*="rating-item"], [class*="rating-breakdown"] [class*="item"], [class*="category-rating"], [class*="sub-rating"]');
    for (var ri = 0; ri < ratingItems.length; ri++) {
      var itemText = clean(ratingItems[ri].innerText || ratingItems[ri].textContent);
      for (var li = 0; li < breakdownLabels.length; li++) {
        if (itemText.toLowerCase().indexOf(breakdownLabels[li]) !== -1) {
          var scoreMatch = itemText.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*5)?/);
          if (scoreMatch) {
            var key = breakdownLabels[li].replace(/\s+/g, "_");
            breakdowns[key] = parseFloat(scoreMatch[1]);
          }
          break;
        }
      }
    }

    // Pricing
    var pricing = textOf('[data-testid*="pricing"]') ||
                  textOf('[class*="pricing-info"]') ||
                  textOf('[class*="price"]') || "";

    var data = {
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      productName: productName,
      overallRating: overallRating,
      reviewCount: reviewCount,
      description: description ? description.slice(0, 500) : "",
      categoryRatings: breakdowns,
      pricing: pricing
    };

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:750px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 8px;'>" + esc(data.productName) + "</h2>";
      if (data.overallRating) h += "<div style='font-size:32px;font-weight:700;color:#e67e22;margin-bottom:4px;'>" + data.overallRating + " <span style='font-size:16px;font-weight:400;color:#666;'>/ 5</span></div>";
      if (data.reviewCount) h += "<div style='color:#666;font-size:14px;margin-bottom:12px;'>" + data.reviewCount.toLocaleString() + " reviews</div>";
      if (data.description) h += "<p style='font-size:14px;color:#333;margin-bottom:16px;'>" + esc(data.description) + "</p>";
      var cats = Object.keys(data.categoryRatings);
      if (cats.length) {
        h += "<h3 style='font-size:15px;margin:0 0 8px;'>Category Ratings</h3>";
        h += "<table style='border-collapse:collapse;width:100%;margin-bottom:16px;'>";
        for (var ki = 0; ki < cats.length; ki++) {
          h += "<tr><td style='padding:6px 12px 6px 0;color:#666;font-size:13px;text-transform:capitalize;'>" + esc(cats[ki].replace(/_/g, " ")) + "</td>";
          h += "<td style='padding:6px 0;font-weight:600;font-size:14px;'>" + data.categoryRatings[cats[ki]] + "</td></tr>";
        }
        h += "</table>";
      }
      if (data.pricing) h += "<div style='font-size:13px;color:#555;'>Pricing: " + esc(data.pricing) + "</div>";
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, extractedAt, productName, overallRating, reviewCount, description, categoryRatings, pricing }`
