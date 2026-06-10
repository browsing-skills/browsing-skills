# Glassdoor — Company Overview Reference

## Requirements

**Auth:** Glassdoor requires a logged-in session. Use Chrome Bridge with the user's existing Chrome browser so the session cookies are available. Without login the site shows a sign-up wall and no data is accessible.

**Browser:** Chrome Bridge or a real browser with the user's Glassdoor session active.

## How to run this action

Navigate first, wait for the page to fully render, then execute the code via `page.evaluate()` or Chrome Bridge `/run-action`.

---

## Action: company-overview

Use when the user wants Glassdoor profile data for a company: rating, CEO, size, industry, etc.

**Navigate to:** `https://www.glassdoor.com/Overview/Working-at-<slug>.htm`

The `<slug>` is the company-specific path segment used by Glassdoor, e.g. `Google-EI_IE9079` for Google. It appears in Glassdoor company URLs.

**Code:**

```js
({
  name: "glassdoor-company-overview",
  description: "Extract Glassdoor company overview: rating, reviews count, CEO approval, recommend %, industry, size, founded, headquarters, website",
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
    function attrOf(selector, attr) {
      var el = document.querySelector(selector);
      return el ? (el.getAttribute(attr) || "") : "";
    }
    function numFrom(v) {
      v = clean(v).replace(/,/g, "");
      if (!v) return null;
      if (/k$/i.test(v)) return Math.round(parseFloat(v) * 1000);
      if (/m$/i.test(v)) return Math.round(parseFloat(v) * 1000000);
      var n = parseInt(v.replace(/[^0-9]/g, ""), 10);
      return isNaN(n) ? null : n;
    }
    function pctFrom(v) {
      var m = String(v || "").match(/(\d+(?:\.\d+)?)\s*%/);
      return m ? parseFloat(m[1]) : null;
    }

    // Company name
    var name = textOf("h1") || textOf('[class*="employerName"]') || document.title.replace(/\s*Reviews.*$/i, "").trim();

    // Overall rating — try data-test first, then rating triangle, then any rating-looking element
    // Rating — try specific selectors then fall back to text parsing
    var ratingRaw = textOf('[data-test="rating"]') ||
                    textOf('[class*="ratingTriangle"] span') ||
                    textOf('[class*="ratingNum"]') ||
                    textOf('[class*="rating__"] span') || "";
    var rating = parseFloat(ratingRaw) || null;

    // Number of reviews — text parsing: "based on N ratings/reviews"
    var reviewsRaw = textOf('[data-test="reviewCount"]') ||
                     textOf('[class*="reviewCount"]') || "";
    var reviewCount = reviewsRaw ? numFrom(reviewsRaw.replace(/reviews?/i, "")) : null;

    // CEO name and approval — already found via dt/dd fallback (ceoName set above)
    var ceoName = textOf('[data-test="ceo-name"]') ||
                  textOf('[class*="ceoName"]') || "";
    var ceoApprovalRaw = textOf('[data-test="CEOPercentage"]') ||
                         textOf('[class*="ceoApproval"]') || "";
    var ceoApproval = pctFrom(ceoApprovalRaw);

    var recommendRaw = textOf('[data-test="recommend"]') ||
                       textOf('[class*="recommend"]') || "";
    var recommendPct = pctFrom(recommendRaw);

    // Glassdoor 2025: info displayed as "value\nlabel" pairs in body text
    // Parse body.innerText to extract all key fields
    var bodyText = document.body.innerText || "";
    function extractBeforeLabel(label) {
      var re = new RegExp("([^\\n]+)\\n" + label + "(?:\\n|$)", "i");
      var m = bodyText.match(re);
      return m ? m[1].trim() : "";
    }
    function extractAfterLabel(label) {
      var re = new RegExp(label + "[:\\s]*([^\\n]+)", "i");
      var m = bodyText.match(re);
      return m ? m[1].trim() : "";
    }

    // Rating: "4.4\nbased on 48,224 ratings"
    if (!rating) {
      var ratingMatch = bodyText.match(/(\d+\.\d+)\nbased on ([\d,]+)\s*(?:ratings?|reviews?)/i);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]);
        if (!reviewCount) reviewCount = numFrom(ratingMatch[2]);
      }
    }
    if (!reviewCount) {
      var rcMatch = bodyText.match(/based on ([\d,]+)\s*(?:ratings?|reviews?)/i);
      if (rcMatch) reviewCount = numFrom(rcMatch[1]);
    }

    // CEO: "Sundar Pichai\n82% approve of CEO"
    if (!ceoName) {
      var ceoMatch = bodyText.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)+)\n(\d+)%\s*approve of CEO/i);
      if (ceoMatch) { ceoName = ceoMatch[1]; ceoApproval = parseInt(ceoMatch[2], 10); }
    }

    // Recommend: "87% would recommend to a friend"
    if (recommendPct === null) {
      var recMatch = bodyText.match(/(\d+)%\s*would recommend/i);
      if (recMatch) recommendPct = parseInt(recMatch[1], 10);
    }

    // Info fields via "value\nLabel" pattern
    var website = attrOf('[data-test="employer-website"] a', "href") || extractBeforeLabel("Website");
    if (website === "View site") website = "";
    var industry = textOf('[data-test="employer-industry"]') || extractBeforeLabel("Industry");
    var size = textOf('[data-test="employer-size"]') || extractBeforeLabel("Employees");
    var founded = textOf('[data-test="employer-founded"]') || extractBeforeLabel("Founded");
    var headquarters = textOf('[data-test="employer-headquarters"]') || extractBeforeLabel("Headquarters");
    var revenue = textOf('[data-test="employer-revenue"]') || extractBeforeLabel("Revenue");
    var type = textOf('[data-test="employer-type"]') || extractBeforeLabel("Company");

    var data = {
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      name: name,
      rating: rating,
      reviewCount: reviewCount,
      ceoName: ceoName,
      ceoApprovalPct: ceoApproval,
      recommendPct: recommendPct,
      website: website,
      size: size,
      founded: founded,
      industry: industry,
      headquarters: headquarters,
      revenue: revenue,
      type: type
    };

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:700px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 8px;'>" + esc(data.name) + "</h2>";
      if (data.rating) h += "<div style='font-size:28px;font-weight:700;color:#0caa41;margin-bottom:4px;'>" + data.rating + " <span style='font-size:16px;font-weight:400;color:#666;'>/ 5</span></div>";
      if (data.reviewCount) h += "<div style='color:#666;font-size:14px;margin-bottom:16px;'>" + data.reviewCount.toLocaleString() + " reviews</div>";
      var rows = [
        ["CEO", data.ceoName + (data.ceoApprovalPct !== null ? " (" + data.ceoApprovalPct + "% approval)" : "")],
        ["Recommend to Friend", data.recommendPct !== null ? data.recommendPct + "%" : ""],
        ["Industry", data.industry],
        ["Company Size", data.size],
        ["Founded", data.founded],
        ["Headquarters", data.headquarters],
        ["Revenue", data.revenue],
        ["Type", data.type],
        ["Website", data.website]
      ];
      h += "<table style='border-collapse:collapse;width:100%;'>";
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i][1]) continue;
        h += "<tr><td style='padding:8px 12px 8px 0;color:#666;font-size:13px;white-space:nowrap;vertical-align:top;'>" + esc(rows[i][0]) + "</td>";
        h += "<td style='padding:8px 0;font-size:14px;'>" + esc(rows[i][1]) + "</td></tr>";
      }
      h += "</table></div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, extractedAt, name, rating, reviewCount, ceoName, ceoApprovalPct, recommendPct, website, size, founded, industry, headquarters, revenue, type }`
