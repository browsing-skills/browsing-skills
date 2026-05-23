# G2 — Product Reviews Reference

## Requirements

**Auth:** Not required for public product pages. The first page of reviews is generally visible without login; G2 may prompt for login to view more pages.

**Browser:** Use a real browser or Chrome Bridge. G2 is a JavaScript-rendered app. Scroll or paginate to load more reviews if needed.

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

## Action: g2-product-reviews

Use when the user wants individual review content from a G2 product page.

**Navigate to:** `https://www.g2.com/products/<slug>/reviews`

Examples:

- `https://www.g2.com/products/slack/reviews`
- `https://www.g2.com/products/salesforce-crm/reviews`

**Code:**

```js
({
  name: "g2-product-reviews",
  description: "Extract individual user reviews from a G2 product reviews page, including reviewer name, role, company size, rating, title, pros, cons, and date",
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
    function numFrom(v) {
      v = clean(String(v || "")).replace(/,/g, "");
      if (!v) return null;
      var n = parseFloat(v.replace(/[^0-9.]/g, ""));
      return isNaN(n) ? null : n;
    }

    // Find all review containers — G2 uses itemprop="review" or paper classes
    var reviewEls = document.querySelectorAll('[itemprop="review"]');
    if (reviewEls.length === 0) {
      reviewEls = document.querySelectorAll('.paper.paper--white.paper--box');
    }
    if (reviewEls.length === 0) {
      reviewEls = document.querySelectorAll('[class*="review"][class*="paper"], [class*="ReviewCard"]');
    }

    var reviews = [];
    for (var i = 0; i < reviewEls.length && reviews.length < limit; i++) {
      var el = reviewEls[i];

      // Reviewer name
      var reviewer = textOf(el, '[itemprop="author"] [itemprop="name"]') ||
                     textOf(el, '[itemprop="author"]') ||
                     textOf(el, '[class*="reviewer-info"] [class*="name"]') ||
                     textOf(el, '.mt-4th strong') || "";

      // Role / title
      var role = textOf(el, '[class*="reviewer-role"]') ||
                 textOf(el, '[class*="reviewer-title"]') ||
                 textOf(el, '[itemprop="jobTitle"]') ||
                 textOf(el, '[class*="market-segment"]') || "";

      // Company size
      var companySize = textOf(el, '[class*="company-size"]') ||
                        textOf(el, '[class*="companySize"]') || "";

      // Star rating
      var ratingEl = el.querySelector('[itemprop="reviewRating"] [itemprop="ratingValue"]') ||
                     el.querySelector('[itemprop="ratingValue"]') ||
                     el.querySelector('[class*="stars"] [class*="rating"], [class*="score"]');
      var ratingRaw = ratingEl ? (ratingEl.getAttribute("content") || clean(ratingEl.textContent)) : "";
      // Fallback: count filled star elements
      if (!parseFloat(ratingRaw)) {
        var filledStars = el.querySelectorAll('[class*="star--filled"], [class*="star-full"], [class*="stars-filled"]');
        if (filledStars.length) ratingRaw = String(filledStars.length);
      }
      var rating = parseFloat(ratingRaw) || null;

      // Review title
      var title = textOf(el, '[itemprop="name"]') ||
                  textOf(el, '[class*="review-title"]') ||
                  textOf(el, 'h3') || "";

      // Pros — "What do you like best?" section
      var pros = "";
      var bodySections = el.querySelectorAll('[itemprop="reviewBody"], .pjax-review-display__text, [class*="review-body"]');
      if (bodySections.length >= 2) {
        pros = clean(bodySections[0].textContent);
      } else {
        var prosEl = el.querySelector('[class*="liked-best"], [class*="pros"]');
        if (!prosEl) {
          // Search for heading containing "like best"
          var allP = el.querySelectorAll("p, div");
          for (var pi = 0; pi < allP.length; pi++) {
            var heading = allP[pi].previousElementSibling;
            if (heading && /like\s+best/i.test(clean(heading.textContent))) {
              prosEl = allP[pi];
              break;
            }
          }
        }
        if (prosEl) pros = clean(prosEl.textContent);
      }

      // Cons — "What do you dislike?" section
      var cons = "";
      if (bodySections.length >= 2) {
        cons = clean(bodySections[1].textContent);
      } else {
        var consEl = el.querySelector('[class*="disliked"], [class*="cons"]');
        if (!consEl) {
          var allP2 = el.querySelectorAll("p, div");
          for (var ci = 0; ci < allP2.length; ci++) {
            var heading2 = allP2[ci].previousElementSibling;
            if (heading2 && /dislike/i.test(clean(heading2.textContent))) {
              consEl = allP2[ci];
              break;
            }
          }
        }
        if (consEl) cons = clean(consEl.textContent);
      }

      // Date
      var dateEl = el.querySelector('[itemprop="datePublished"]') ||
                   el.querySelector('time') ||
                   el.querySelector('[class*="review-date"], [class*="reviewDate"]');
      var date = dateEl ? (dateEl.getAttribute("content") || dateEl.getAttribute("datetime") || clean(dateEl.textContent)) : "";

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

    var productName = clean(document.querySelector('h1[itemprop="name"]') ?
      document.querySelector('h1[itemprop="name"]').textContent :
      (document.querySelector('.product-head__title h1') ?
        document.querySelector('.product-head__title h1').textContent :
        document.title.replace(/Reviews.*$/i, "").trim()));

    var data = {
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      productName: productName,
      reviewsExtracted: reviews.length,
      reviews: reviews
    };

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:850px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 16px;'>G2 Reviews: " + esc(data.productName) + "</h2>";
      for (var j = 0; j < reviews.length; j++) {
        var r = reviews[j];
        h += "<div style='border:1px solid #e0e0e0;border-radius:6px;padding:16px;margin-bottom:16px;'>";
        h += "<div style='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;'>";
        h += "<div><strong>" + esc(r.reviewer || "Anonymous") + "</strong>";
        if (r.role) h += " <span style='color:#888;font-size:13px;'>— " + esc(r.role) + "</span>";
        if (r.companySize) h += " <span style='color:#aaa;font-size:12px;'>(" + esc(r.companySize) + ")</span>";
        h += "</div>";
        if (r.rating) h += "<div style='color:#ff492c;font-weight:700;font-size:16px;'>" + r.rating + " ★</div>";
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
