# LinkedIn — Job Search Reference

## Requirements

**Auth:** Recommended but not strictly required. Public job search works without login but returns fewer results and may redirect to a sign-in wall. Inject the `li_at` cookie for reliable results:

```js
await context.addCookies([{
  name: 'li_at', value: '<user-provided>', domain: '.linkedin.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Browser:** Required. Job search results are rendered client-side.

## How to run

Build the URL, navigate, wait for results to load, then execute via `page.evaluate()` or chrome-bridge `/run-action`:

```js
var query = encodeURIComponent("software engineer");
var location = encodeURIComponent("New York");
var url = "https://www.linkedin.com/jobs/search/?keywords=" + query + "&location=" + location;
// navigate to url, then:
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output.

---

## Action: job-search

**Navigate to:** `https://www.linkedin.com/jobs/search/?keywords=<query>&location=<location>` (URL-encode both parameters)

**Code:**

```js
({
  name: "linkedin-job-search",
  description: "Search LinkedIn jobs and extract listings including title, company, location, date posted, job URL, and Easy Apply flag",
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["data", "display"],
        description: "Output mode. data (default) returns JSON. display returns self-contained HTML."
      },
      limit: {
        type: "number",
        description: "Maximum number of job listings to return. Default 25."
      }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var limit = (params && params.limit) || 25;
    var data = {};

    // Extract query and location from the current URL
    var urlParams = new URLSearchParams(window.location.search);
    data.query = urlParams.get("keywords") || "";
    data.location = urlParams.get("location") || "";
    data.pageUrl = window.location.href;

    // Total results count — look for the results heading
    var resultsEl = document.querySelector(".jobs-search-results-list__subtitle, .results-context-header__job-count, [class*='results-context'] span");
    if (resultsEl) {
      var totalText = resultsEl.textContent.trim().replace(/,/g, "");
      var totalMatch = totalText.match(/[\d]+/);
      data.totalResults = totalMatch ? parseInt(totalMatch[0], 10) : null;
    } else {
      data.totalResults = null;
    }

    // Job cards — two common list selectors for logged-in vs public views
    var cardEls = document.querySelectorAll(".jobs-search__results-list li, .scaffold-layout__list-container li, .jobs-search-results__list li");
    var jobs = [];

    for (var i = 0; i < Math.min(cardEls.length, limit); i++) {
      var card = cardEls[i];
      var job = {};

      // Title
      var titleEl = card.querySelector("h3.base-search-card__title, a.base-card__full-link, h3.job-card-list__title, .job-card-container__link");
      if (titleEl) {
        job.title = titleEl.textContent.trim();
      }

      // Job URL
      var linkEl = card.querySelector("a.base-card__full-link, a.job-card-list__title, a.job-card-container__link");
      if (linkEl && linkEl.href) {
        job.jobUrl = linkEl.href.split("?")[0];
      }

      // Company
      var companyEl = card.querySelector("h4.base-search-card__subtitle a, h4.base-search-card__subtitle, .job-card-container__company-name, .artdeco-entity-lockup__subtitle");
      if (companyEl) {
        job.company = companyEl.textContent.trim();
      }

      // Location
      var locationEl = card.querySelector(".job-search-card__location, .base-search-card__metadata, .job-card-container__metadata-item");
      if (locationEl) {
        job.location = locationEl.textContent.trim();
      }

      // Date posted — prefer datetime attribute from <time>
      var timeEl = card.querySelector(".job-search-card__listdate, time[datetime], time");
      if (timeEl) {
        job.datePosted = timeEl.getAttribute("datetime") || timeEl.textContent.trim();
      }

      // Easy Apply flag
      var cardText = card.textContent || "";
      var easyApplyBtn = card.querySelector(".jobs-apply-button--top-card, [aria-label*='Easy Apply'], [class*='easy-apply']");
      job.isEasyApply = !!(easyApplyBtn || cardText.toLowerCase().indexOf("easy apply") !== -1);

      // Only push cards that have at least a title or URL
      if (job.title || job.jobUrl) {
        jobs.push(job);
      }
    }

    data.jobs = jobs;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:700px;margin:0 auto;border-radius:12px;\">";
      h += "<h2 style=\"margin:0 0 4px;font-size:18px;\">Job Search Results</h2>";
      h += "<div style=\"color:#888;font-size:13px;margin-bottom:16px;\">Query: <strong>" + (data.query || "") + "</strong> &middot; Location: <strong>" + (data.location || "Any") + "</strong>";
      if (data.totalResults !== null) h += " &middot; ~" + data.totalResults + " results";
      h += "</div>";
      for (var ji = 0; ji < data.jobs.length; ji++) {
        var jb = data.jobs[ji];
        h += "<div style=\"border-top:1px solid #333;padding:12px 0;\">";
        h += "<a href=\"" + (jb.jobUrl || "#") + "\" style=\"color:#70b5f9;text-decoration:none;font-weight:600;font-size:15px;\">" + (jb.title || "Untitled") + "</a>";
        h += "<div style=\"color:#ccc;font-size:13px;margin-top:2px;\">" + (jb.company || "") + " &middot; " + (jb.location || "") + "</div>";
        h += "<div style=\"color:#888;font-size:12px;margin-top:2px;\">";
        if (jb.datePosted) h += jb.datePosted;
        if (jb.isEasyApply) h += " <span style=\"color:#4caf50;margin-left:8px;\">Easy Apply</span>";
        h += "</div></div>";
      }
      if (data.jobs.length === 0) h += "<div style=\"color:#888;\">No job listings found. Try adjusting keywords or location.</div>";
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ query, location, pageUrl, totalResults, jobs: [{ title, company, location, datePosted, jobUrl, isEasyApply }] }`

**Notes:** LinkedIn uses two different list structures depending on whether the user is authenticated. Both selectors are tried. Job URLs are stripped of tracking parameters. Easy Apply detection checks for both a dedicated button element and the presence of the "Easy Apply" text in the card. Scroll the page before executing to load more results.

---

## Reporting issues

If this breaks (LinkedIn changes their job card DOM), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `linkedin.com` `job-search`.
