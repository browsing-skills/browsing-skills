# G2 — Product Overview Reference

## Requirements

**Auth:** Not required for public product pages. Some review details may be gated; the overview aggregate data is generally visible without login.

**Browser:** Use a real browser or Chrome Bridge. G2 is a JavaScript-rendered app and may block plain HTTP fetches or require cookie consent dismissal.

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

## Action: g2-product-overview

Use when the user wants aggregate rating data, review counts, or the G2 score for a software product.

**Navigate to:** `https://www.g2.com/products/<slug>/reviews`

Examples:

- `https://www.g2.com/products/slack/reviews`
- `https://www.g2.com/products/salesforce-crm/reviews`

**Code:**

```js
({
  name: "g2-product-overview",
  description: "Extract G2 product overview: name, overall rating, review count, star breakdown, category, G2 score, and top pros/cons",
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
      if (/k$/i.test(v)) return Math.round(parseFloat(v) * 1000);
      if (/m$/i.test(v)) return Math.round(parseFloat(v) * 1000000);
      var n = parseFloat(v.replace(/[^0-9.]/g, ""));
      return isNaN(n) ? null : n;
    }

    // Product name — h1 on G2 is "X Reviews & Product Details", strip the suffix
    var productName = textOf('h1[itemprop="name"]') ||
                      textOf('.product-head__title h1') ||
                      textOf('.product-head__title') ||
                      textOf('h1') ||
                      document.title.replace(/Reviews.*$/i, "").trim();
    productName = productName.replace(/\s*Reviews\s*(&|and)\s*Product Details\s*$/i, "").trim();

    // Overall rating — schema markup is most reliable
    var ratingEl = document.querySelector('[itemprop="ratingValue"]');
    var ratingRaw = ratingEl ? clean(ratingEl.getAttribute("content") || ratingEl.textContent) :
                   textOf('.fw-semibold.l2') ||
                   textOf('[class*="rating"][class*="avg"]') || "";
    var overallRating = parseFloat(ratingRaw) || null;

    // Review count — schema content attr (textContent is often empty)
    var countEl = document.querySelector('[itemprop="reviewCount"]');
    var reviewCountRaw = countEl ? (countEl.getAttribute("content") || clean(countEl.textContent)) :
                         textOf('[class*="ratings-count"]') ||
                         textOf('[class*="review-count"]') || "";
    var reviewCount = numFrom(reviewCountRaw.replace(/reviews?/i, "")) || numFrom(reviewCountRaw);

    // Category — find 2nd-to-last breadcrumb link before the product name
    var category = "";
    var allLinks = document.querySelectorAll("a");
    var catCandidates = [];
    for (var li = 0; li < allLinks.length; li++) {
      var href = allLinks[li].getAttribute("href") || "";
      var txt = clean(allLinks[li].textContent);
      if (href.indexOf("/categories/") > -1 && txt && txt.length > 3) catCandidates.push(txt);
    }
    if (catCandidates.length > 0) category = catCandidates[catCandidates.length - 1];
    if (!category) category = textOf('[class*="category"] a') || textOf('[class*="product-category"]');

    // G2 score
    var g2ScoreRaw = textOf('[class*="g2-score"] [class*="score"]') ||
                     textOf('[class*="g2score"]') ||
                     textOf('[data-g2-score]') || "";
    var g2Score = parseFloat(g2ScoreRaw) || null;

    // Star breakdown (5★ down to 1★)
    var starBreakdown = {};
    var starRows = document.querySelectorAll('[class*="star-distribution"] [class*="row"], [class*="rating-breakdown"] [class*="row"], .rating-bars [class*="bar"]');
    if (starRows.length === 0) {
      starRows = document.querySelectorAll('[itemprop="reviewCount"]');
    }
    // Fallback: look for percentage bars labeled by star count
    var pctEls = document.querySelectorAll('[class*="stacked-bar"], [class*="rating-bar"]');
    for (var i = 0; i < pctEls.length; i++) {
      var rowText = clean(pctEls[i].innerText || pctEls[i].textContent);
      var starMatch = rowText.match(/^(\d)\s*(?:star|★)/i);
      if (starMatch) {
        var pctMatch = rowText.match(/(\d+)\s*%/);
        var countMatch = rowText.match(/\((\d[\d,]*)\)/);
        if (starMatch[1]) {
          starBreakdown[starMatch[1] + "_star"] = {
            pct: pctMatch ? parseInt(pctMatch[1], 10) : null,
            count: countMatch ? numFrom(countMatch[1]) : null
          };
        }
      }
    }

    // Pros and cons — extract from review text following G2's "What do you like best" / "What do you dislike" questions
    var pros = [];
    var cons = [];
    var bodyText = document.body.innerText || "";
    var likePattern = /What do you like best about [^?\n]+\?/gi;
    var dislikePattern = /What do you dislike about [^?\n]+\?/gi;
    var extractSnippets = function(text, pattern, limit) {
      var results = [];
      var match;
      var re = new RegExp(pattern.source, pattern.flags);
      while ((match = re.exec(text)) !== null && results.length < limit) {
        var after = text.substring(match.index + match[0].length).trim();
        var snippet = after.split(/\n\n|What do you/)[0].trim();
        if (snippet && snippet.length > 20 && snippet.length < 400) results.push(snippet);
      }
      return results;
    };
    pros = extractSnippets(bodyText, likePattern, 3);
    cons = extractSnippets(bodyText, dislikePattern, 3);

    var data = {
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      productName: productName,
      overallRating: overallRating,
      reviewCount: reviewCount,
      category: category,
      g2Score: g2Score,
      starBreakdown: starBreakdown,
      topPros: pros,
      topCons: cons
    };

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:750px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 8px;'>" + esc(data.productName) + "</h2>";
      if (data.category) h += "<div style='color:#888;font-size:13px;margin-bottom:12px;'>" + esc(data.category) + "</div>";
      if (data.overallRating) h += "<div style='font-size:32px;font-weight:700;color:#ff492c;margin-bottom:4px;'>" + data.overallRating + " <span style='font-size:16px;font-weight:400;color:#666;'>/ 5</span></div>";
      if (data.reviewCount) h += "<div style='color:#666;font-size:14px;margin-bottom:8px;'>" + data.reviewCount.toLocaleString() + " reviews</div>";
      if (data.g2Score) h += "<div style='color:#666;font-size:14px;margin-bottom:16px;'>G2 Score: <strong>" + data.g2Score + "</strong></div>";
      if (data.topPros.length) {
        h += "<h3 style='margin:12px 0 6px;font-size:15px;color:#2d7a4f;'>Top Pros</h3><ul style='margin:0;padding-left:20px;'>";
        for (var pp = 0; pp < data.topPros.length; pp++) h += "<li style='margin-bottom:4px;font-size:13px;'>" + esc(data.topPros[pp]) + "</li>";
        h += "</ul>";
      }
      if (data.topCons.length) {
        h += "<h3 style='margin:12px 0 6px;font-size:15px;color:#c0392b;'>Top Cons</h3><ul style='margin:0;padding-left:20px;'>";
        for (var cp = 0; cp < data.topCons.length; cp++) h += "<li style='margin-bottom:4px;font-size:13px;'>" + esc(data.topCons[cp]) + "</li>";
        h += "</ul>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ url, extractedAt, productName, overallRating, reviewCount, category, g2Score, starBreakdown, topPros, topCons }`
