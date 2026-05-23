# Glassdoor — Company Reviews Reference

## Requirements

**Auth:** Glassdoor requires a logged-in session. Use Chrome Bridge with the user's existing Chrome browser so the session cookies are available. Without login the site shows a sign-up wall and no review content is accessible.

**Browser:** Chrome Bridge or a real browser with the user's Glassdoor session active.

## How to run this action

Navigate first, wait until reviews are rendered, then execute the code via `page.evaluate()` or Chrome Bridge `/run-action`.

---

## Action: company-reviews

Use when the user wants a list of employee reviews for a Glassdoor company page.

**Navigate to:** `https://www.glassdoor.com/Reviews/<slug>-reviews-<id>.htm`

Example: `https://www.glassdoor.com/Reviews/Google-Reviews-E9079.htm`. The slug and numeric employer ID appear in Glassdoor company URLs.

**Code:**

```js
({
  name: "glassdoor-company-reviews",
  description: "Extract Glassdoor employee reviews: rating, title, date, pros, cons, reviewer role, helpful count",
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
    function numFrom(v) {
      var n = parseInt(String(v || "").replace(/[^0-9]/g, ""), 10);
      return isNaN(n) ? null : n;
    }
    function textOf(root, selector) {
      var el = root.querySelector(selector);
      return el ? clean(el.innerText || el.textContent) : "";
    }

    function parseReview(el) {
      // 2025 Glassdoor uses <article> with no class — parse innerText directly.
      // Format: rating\n"New"\ndate\ntitle\nrole\nstatus\n...\nPros\n\npros text\nCons\n\ncons text
      var lines = (el.innerText || el.textContent || "").split("\n").map(clean).filter(Boolean);

      var rating = null;
      var date = "";
      var title = "";
      var role = "";
      var pros = "";
      var cons = "";
      var helpful = null;

      // First non-empty line matching a decimal number is the rating
      var headerCount = 0; // count of header lines consumed
      for (var hi = 0; hi < Math.min(lines.length, 6); hi++) {
        var hl = lines[hi];
        if (rating === null && /^\d+\.\d+$/.test(hl)) { rating = parseFloat(hl); headerCount = hi + 1; continue; }
        if (rating !== null && !date && /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(hl)) { date = hl; headerCount = hi + 1; continue; }
        if (rating !== null && date && !title && hl.length > 5 && !/^(New|Updated|Featured)$/i.test(hl)) { title = hl; headerCount = hi + 1; break; }
      }

      // Next meaningful line after title = role
      if (headerCount < lines.length) {
        var candidate = lines[headerCount];
        if (candidate && !/^(Recommend|CEO|Business|Current|Former|Anonymous|full[- ]time|part[- ]time)/i.test(candidate)) {
          role = candidate;
        }
      }

      // Pros and cons from line parsing
      var prosMode = false;
      var consMode = false;
      var prosLines = [];
      var consLines = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (/^pros$/i.test(line)) { prosMode = true; consMode = false; continue; }
        if (/^cons$/i.test(line)) { consMode = true; prosMode = false; continue; }
        if (/^(advice|overall|helpful|\d+ found)/i.test(line)) { prosMode = false; consMode = false; }
        if (prosMode) prosLines.push(line);
        if (consMode) consLines.push(line);
      }
      pros = prosLines.join(" ").replace(/\s*Show more\s*$/i, "").trim();
      cons = consLines.join(" ").replace(/\s*Show more\s*$/i, "").trim();

      // Helpful count from last lines
      for (var hi2 = lines.length - 1; hi2 >= 0; hi2--) {
        var hm = lines[hi2].match(/^(\d+)\s+found helpful/i);
        if (hm) { helpful = parseInt(hm[1], 10); break; }
      }

      return { rating: rating, title: title, date: date, role: role, pros: pros, cons: cons, helpful: helpful };
    }

    // 2025 Glassdoor reviews page: each review is an <article> element
    var reviewEls = document.querySelectorAll('article');
    if (reviewEls.length === 0) {
      reviewEls = document.querySelectorAll('[id^="empReview_"], [class*="empReview"], [data-test="review-container"]');
    }

    var companyName = clean((document.querySelector('h1') || {}).innerText || document.title.replace(/\s*Reviews.*$/i, "").trim()).replace(/\s+reviews$/i, "").trim();
    var data = {
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      company: companyName,
      reviews: []
    };

    for (var i = 0; i < reviewEls.length && data.reviews.length < limit; i++) {
      var rev = parseReview(reviewEls[i]);
      if (!rev.title && !rev.pros && !rev.cons) continue;
      data.reviews.push(rev);
    }
    data.count = data.reviews.length;

    if (mode === "display") {
      var h = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:850px;margin:0 auto;padding:20px;'>";
      h += "<h2 style='margin:0 0 16px;'>" + esc(data.company) + " — Reviews</h2>";
      for (var j = 0; j < data.reviews.length; j++) {
        var r = data.reviews[j];
        h += "<div style='border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:16px;'>";
        h += "<div style='display:flex;align-items:center;gap:12px;margin-bottom:8px;'>";
        if (r.rating) h += "<span style='background:#0caa41;color:#fff;font-weight:700;border-radius:4px;padding:2px 8px;font-size:16px;'>" + r.rating + "</span>";
        h += "<strong>" + esc(r.title) + "</strong>";
        h += "</div>";
        if (r.role || r.date) h += "<div style='color:#666;font-size:12px;margin-bottom:10px;'>" + esc(r.role) + (r.role && r.date ? " &bull; " : "") + esc(r.date) + "</div>";
        if (r.pros) h += "<div style='margin-bottom:8px;'><span style='color:#0caa41;font-weight:600;'>Pros</span><br>" + esc(r.pros) + "</div>";
        if (r.cons) h += "<div><span style='color:#e8390e;font-weight:600;'>Cons</span><br>" + esc(r.cons) + "</div>";
        if (r.helpful !== null) h += "<div style='color:#999;font-size:12px;margin-top:8px;'>Helpful: " + r.helpful + "</div>";
        h += "</div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ company, reviews: [{ rating, title, date, role, pros, cons, helpful }], count }`
