# Capterra — Product Reviews Reference

## Requirements

**Auth:** Not required. Capterra review pages are publicly accessible. The first page of reviews loads without login.

**Browser:** Use a real browser or Chrome Bridge. Capterra is a JavaScript-rendered app. Paginate or scroll to load more reviews beyond the first page.

## How to run this action

Navigate first, wait for reviews to render, then execute the code via `page.evaluate()` or Chrome Bridge `/run-action`:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ limit: 10, mode: "data" });
}, scriptCode);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: capterra-product-reviews

Use when the user wants individual review content from a Capterra product page.

**Navigate to:** `https://www.capterra.com/p/<id>/<slug>/reviews/`

Examples:

- `https://www.capterra.com/p/147657/monday-com/reviews/`
- `https://www.capterra.com/p/186596/Notion/reviews/`

**Code:**

```js
({
  name: "capterra-product-reviews",
  description: "Extract individual user reviews from a Capterra product reviews page, including reviewer name, role, company size, overall rating, title, pros, cons, and date",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] },
      limit: { type: "number" }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var limit = (params && params.limit) ? params.limit : 10;

    function clean(s) { return (s || "").replace(/\s+/g, " ").trim(); }
    function esc(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function textOf(el, selector) {
      if (!el) return "";
      var found = selector ? el.querySelector(selector) : el;
      return found ? clean(found.innerText || found.textContent) : "";
    }

    // Capterra 2025: no review-card containers — use innerText line parsing.
    // Review structure in body text:
    //   [Name]\n[Role]\n[Industry]\nUsed the software for: X\n"[Title]"\n[Date]\n[Rating]\n[overall]\nPros\n[pros]\nCons\n[cons]\nReview Source
    var bodyLines = (document.body.innerText || "").split("\n").map(clean).filter(Boolean);

    // Skip to the full-review section (after "Showing X-Y of Z Reviews")
    var mainStart = 0;
    for (var si = 0; si < bodyLines.length; si++) {
      if (/^Showing \d+-\d+ of [\d,]+ Reviews?/i.test(bodyLines[si])) {
        mainStart = si + 1;
        break;
      }
    }

    var reviews = [];
    var ri = mainStart;
    while (ri < bodyLines.length && reviews.length < limit) {
      if (!/^Used the software for:/i.test(bodyLines[ri])) { ri++; continue; }

      // Reviewer metadata (3 lines before "Used the software for:")
      var reviewer = ri >= 3 ? bodyLines[ri - 3] : "";
      var role     = ri >= 2 ? bodyLines[ri - 2] : "";
      var companyInfo = ri >= 1 ? bodyLines[ri - 1] : "";
      var usageDuration = bodyLines[ri].replace(/^Used the software for:\s*/i, "");

      var j = ri + 1;

      // Title: line starting with a quote char
      var title = "";
      if (j < bodyLines.length && /^["""«“]/.test(bodyLines[j])) {
        title = bodyLines[j].replace(/^["""«“]|["""»”]$/g, "").trim();
        j++;
      }

      // Date (handles both abbreviated "May 12, 2026" and full "March 27, 2026")
      var date = "";
      if (j < bodyLines.length && /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b.+\d{4}/.test(bodyLines[j])) {
        date = bodyLines[j]; j++;
      }

      // Rating
      var rating = null;
      if (j < bodyLines.length && /^\d+\.\d+$/.test(bodyLines[j])) {
        rating = parseFloat(bodyLines[j]); j++;
      }

      // Overall comment + Pros/Cons
      var overallLines = [], prosLines = [], consLines = [];
      var section = "overall";
      while (j < bodyLines.length) {
        var l = bodyLines[j];
        if (/^Used the software for:/i.test(l)) break;
        if (l === "Review Source" || l === "View less" || l === "Show more") { j++; break; }
        if (l === "Pros") { section = "pros"; j++; continue; }
        if (l === "Cons") { section = "cons"; j++; continue; }
        if (l === "Switched from" || l === "Reasons for switching" || l === "Reasons for Switching") {
          section = "skip"; j++; continue;
        }
        if (section === "overall") overallLines.push(l);
        else if (section === "pros") prosLines.push(l);
        else if (section === "cons") consLines.push(l);
        j++;
      }

      var overall = overallLines.join(" ");
      var pros = prosLines.join(" ");
      var cons = consLines.join(" ");

      if (reviewer || title || pros) {
        reviews.push({
          reviewer: reviewer,
          role: role,
          companyInfo: companyInfo,
          usageDuration: usageDuration,
          rating: rating,
          title: title,
          overall: overall,
          pros: pros,
          cons: cons,
          date: date
        });
      }

      ri = j;
    }

    var productName = clean(
      (document.querySelector('h1') || { textContent: "" }).textContent ||
      document.title.replace(/Reviews.*$/i, "").replace(/\|.*$/, "").trim()
    );

    var data = {
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      productName: productName,
      reviewsExtracted: reviews.length,
      reviews: reviews
    };

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:850px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 16px;'>Capterra Reviews: " + esc(data.productName) + "</h2>";
      for (var di = 0; di < reviews.length; di++) {
        var r = reviews[di];
        h += "<div style='border:1px solid #e0e0e0;border-radius:6px;padding:16px;margin-bottom:16px;'>";
        h += "<div style='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;'>";
        h += "<div><strong>" + esc(r.reviewer || "Anonymous") + "</strong>";
        if (r.role) h += " <span style='color:#888;font-size:13px;'>— " + esc(r.role) + "</span>";
        if (r.companyInfo) h += " <span style='color:#aaa;font-size:12px;'>(" + esc(r.companyInfo) + ")</span>";
        h += "</div>";
        if (r.rating) h += "<div style='color:#e67e22;font-weight:700;font-size:16px;'>" + r.rating + " ★</div>";
        h += "</div>";
        if (r.title) h += "<div style='font-weight:600;margin-bottom:8px;'>" + esc(r.title) + "</div>";
        if (r.pros) h += "<div style='margin-bottom:6px;font-size:13px;'><span style='color:#2d7a4f;font-weight:600;'>Pros:</span> " + esc(r.pros.slice(0, 300)) + "</div>";
        if (r.cons) h += "<div style='margin-bottom:6px;font-size:13px;'><span style='color:#c0392b;font-weight:600;'>Cons:</span> " + esc(r.cons.slice(0, 300)) + "</div>";
        if (r.date) h += "<div style='color:#aaa;font-size:12px;margin-top:8px;'>" + esc(r.date) + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, extractedAt, productName, reviewsExtracted, reviews: [{ reviewer, role, companyInfo, usageDuration, rating, title, overall, pros, cons, date }] }`
