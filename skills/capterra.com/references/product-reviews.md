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

- `https://www.capterra.com/p/67095/Slack/reviews/`
- `https://www.capterra.com/p/232666/Notion/reviews/`

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

    // Find review card containers
    var reviewEls = document.querySelectorAll('[data-testid="review-card"]');
    if (reviewEls.length === 0) reviewEls = document.querySelectorAll('.review-card');
    if (reviewEls.length === 0) reviewEls = document.querySelectorAll('article[class*="review"], [class*="ReviewCard"], [class*="review-item"]');
    if (reviewEls.length === 0) {
      // Broader fallback: articles on a reviews page
      reviewEls = document.querySelectorAll('article');
    }

    var reviews = [];
    for (var i = 0; i < reviewEls.length && reviews.length < limit; i++) {
      var el = reviewEls[i];
      var elText = clean(el.innerText || el.textContent);
      // Skip if element has no meaningful review content
      if (elText.length < 50) continue;

      // Reviewer name
      var reviewer = textOf(el, '[data-testid*="reviewer-name"], [class*="reviewer-name"]') ||
                     textOf(el, '[class*="author"] [class*="name"]') ||
                     textOf(el, '[class*="author"]') || "";

      // Role / job title
      var role = textOf(el, '[data-testid*="reviewer-title"], [data-testid*="job-title"], [class*="reviewer-title"]') ||
                 textOf(el, '[class*="job-title"]') ||
                 textOf(el, '[class*="reviewer-role"]') || "";

      // Company size
      var companySize = textOf(el, '[data-testid*="company-size"], [class*="company-size"]') || "";

      // Overall rating — look for numeric value near a star display
      var ratingRaw = "";
      var ratingEl = el.querySelector('[data-testid*="overall-rating"] [data-testid*="value"], [class*="overall-rating"] [class*="value"]') ||
                     el.querySelector('[data-testid*="rating-value"]') ||
                     el.querySelector('[class*="rating-score"], [class*="ratingValue"]');
      if (ratingEl) {
        ratingRaw = clean(ratingEl.textContent);
      }
      if (!parseFloat(ratingRaw)) {
        // Fallback: count filled stars
        var stars = el.querySelectorAll('[class*="star--filled"], [class*="star-filled"], [class*="full-star"], [aria-label*=" out of"]');
        if (stars.length) {
          ratingRaw = String(stars.length);
        } else {
          var ariaRating = el.querySelector('[aria-label*=" out of 5"]');
          if (ariaRating) {
            var m = (ariaRating.getAttribute("aria-label") || "").match(/(\d+(?:\.\d+)?)\s+out of/);
            if (m) ratingRaw = m[1];
          }
        }
      }
      var rating = parseFloat(ratingRaw) || null;

      // Review title
      var title = textOf(el, '[data-testid*="review-title"], [class*="review-title"]') ||
                  textOf(el, 'h3') || textOf(el, 'h2') || "";

      // Pros
      var pros = "";
      var prosEl = el.querySelector('[data-testid*="pros"], [class*="pros-section"], [class*="review-pros"]');
      if (prosEl) {
        pros = clean(prosEl.textContent).replace(/^pros?\s*:?\s*/i, "");
      } else {
        // Look for a paragraph preceded by "Pros" label
        var allParas = el.querySelectorAll("p, div[class*='content']");
        for (var pi = 0; pi < allParas.length; pi++) {
          var prev = allParas[pi].previousElementSibling;
          if (prev && /\bpros?\b/i.test(clean(prev.textContent))) {
            pros = clean(allParas[pi].textContent);
            break;
          }
          // Or inline "Pros:" prefix
          var ptext = clean(allParas[pi].textContent);
          if (/^pros?\s*:/i.test(ptext)) {
            pros = ptext.replace(/^pros?\s*:\s*/i, "");
            break;
          }
        }
      }

      // Cons
      var cons = "";
      var consEl = el.querySelector('[data-testid*="cons"], [class*="cons-section"], [class*="review-cons"]');
      if (consEl) {
        cons = clean(consEl.textContent).replace(/^cons?\s*:?\s*/i, "");
      } else {
        var allParas2 = el.querySelectorAll("p, div[class*='content']");
        for (var ci = 0; ci < allParas2.length; ci++) {
          var prev2 = allParas2[ci].previousElementSibling;
          if (prev2 && /\bcons?\b/i.test(clean(prev2.textContent))) {
            cons = clean(allParas2[ci].textContent);
            break;
          }
          var ctext = clean(allParas2[ci].textContent);
          if (/^cons?\s*:/i.test(ctext)) {
            cons = ctext.replace(/^cons?\s*:\s*/i, "");
            break;
          }
        }
      }

      // Date
      var dateEl = el.querySelector('time') ||
                   el.querySelector('[data-testid*="review-date"], [class*="review-date"]');
      var date = dateEl ? (dateEl.getAttribute("datetime") || clean(dateEl.textContent)) : "";

      if (!reviewer && !title && !pros) continue; // skip empty placeholders

      reviews.push({
        reviewer: reviewer,
        role: role,
        companySize: companySize,
        rating: rating,
        title: title,
        pros: pros,
        cons: cons,
        date: date
      });
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
      for (var j = 0; j < reviews.length; j++) {
        var r = reviews[j];
        h += "<div style='border:1px solid #e0e0e0;border-radius:6px;padding:16px;margin-bottom:16px;'>";
        h += "<div style='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;'>";
        h += "<div><strong>" + esc(r.reviewer || "Anonymous") + "</strong>";
        if (r.role) h += " <span style='color:#888;font-size:13px;'>— " + esc(r.role) + "</span>";
        if (r.companySize) h += " <span style='color:#aaa;font-size:12px;'>(" + esc(r.companySize) + ")</span>";
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

**Returns:** `{ url, extractedAt, productName, reviewsExtracted, reviews: [{ reviewer, role, companySize, rating, title, pros, cons, date }] }`
