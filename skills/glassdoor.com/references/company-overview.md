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
    var ratingRaw = textOf('[data-test="rating"]') ||
                    textOf('[class*="ratingTriangle"] span') ||
                    textOf('[class*="ratingNum"]') ||
                    textOf('[class*="rating__"] span') || "";
    var rating = parseFloat(ratingRaw) || null;

    // Number of reviews
    var reviewsRaw = textOf('[data-test="reviewCount"]') ||
                     textOf('[class*="reviewCount"]') ||
                     textOf('[href*="Reviews"]') || "";
    var reviewCount = numFrom(reviewsRaw.replace(/reviews?/i, ""));

    // CEO name and approval
    var ceoName = textOf('[data-test="ceo-name"]') ||
                  textOf('[class*="ceoName"]') ||
                  textOf('[class*="CEO"] [class*="name"]') || "";
    var ceoApprovalRaw = textOf('[data-test="CEOPercentage"]') ||
                         textOf('[class*="ceoApproval"]') ||
                         textOf('[class*="CEOApproval"]') || "";
    var ceoApproval = pctFrom(ceoApprovalRaw);

    // Recommend to friend
    var recommendRaw = textOf('[data-test="recommend"]') ||
                       textOf('[class*="recommend"]') || "";
    var recommendPct = pctFrom(recommendRaw);

    // Employer info fields — Glassdoor lists these in a definition-list-style section
    function findInfoValue(label) {
      var els = document.querySelectorAll('[data-test="employer-website"], [data-test="employer-size"], [data-test="employer-founded"], [data-test="employer-industry"], [data-test="employer-revenue"], [data-test="employer-headquarters"], [data-test="employer-type"]');
      // Generic: look through all dt/dd pairs for matching label text
      var dts = document.querySelectorAll("dt, [class*='infoLabel'], [class*='InfoLabel']");
      for (var i = 0; i < dts.length; i++) {
        if (clean(dts[i].innerText || dts[i].textContent).toLowerCase().indexOf(label.toLowerCase()) !== -1) {
          var next = dts[i].nextElementSibling;
          if (next) return clean(next.innerText || next.textContent);
        }
      }
      return "";
    }

    var website = attrOf('[data-test="employer-website"] a', "href") ||
                  textOf('[data-test="employer-website"]') ||
                  findInfoValue("website");
    var size = textOf('[data-test="employer-size"]') || findInfoValue("size");
    var founded = textOf('[data-test="employer-founded"]') || findInfoValue("founded");
    var industry = textOf('[data-test="employer-industry"]') || findInfoValue("industry");
    var headquarters = textOf('[data-test="employer-headquarters"]') || findInfoValue("headquarters");
    var revenue = textOf('[data-test="employer-revenue"]') || findInfoValue("revenue");
    var type = textOf('[data-test="employer-type"]') || findInfoValue("type");

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

**Returns:** `{ name, rating, reviewCount, ceoName, ceoApprovalPct, recommendPct, website, size, founded, industry, headquarters, revenue, type }`
