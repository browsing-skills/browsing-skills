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
    function esc(value) {
      return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // Extract query and location from the current URL
    var urlParams = new URLSearchParams(window.location.search);
    data.query = urlParams.get("keywords") || "";
    data.location = urlParams.get("location") || "";
    data.pageUrl = window.location.href;

    // Total results count — LinkedIn 2025 uses a <small> element with "N results"
    data.totalResults = null;
    var smalls = document.querySelectorAll("small");
    for (var sm = 0; sm < smalls.length; sm++) {
      var smTxt = smalls[sm].textContent.trim();
      if (/\d+.*result/i.test(smTxt)) {
        var tm = smTxt.match(/(\d[\d,]*)/);
        if (tm) { data.totalResults = parseInt(tm[1].replace(/,/g, ""), 10); break; }
      }
    }

    // Job cards — LinkedIn 2025 uses li[data-occludable-job-id] as the stable anchor.
    // All class names are obfuscated; innerText line parsing is the reliable approach.
    //
    // Line structure per card:
    //   [0] job title (may end with " with verification" — strip it)
    //   next non-skip lines: company, then location
    //   skip lines: "with verification", "X connections work here",
    //               "X school alum(ni) work here", "Viewed", "Promoted", "Followed"
    //   "Easy Apply" anywhere in lines → isEasyApply = true
    //   time pattern ("1 week ago", "2 days ago") → datePosted

    var isSkipLine = function(l) {
      return /connections? work(s)? here|school alum|alumni work|^Viewed$|^Promoted$|^Followed$/i.test(l) ||
             /with verification$/i.test(l);
    };
    var isDateLine = function(l) {
      return /\b(\d+\s*(hour|day|week|month)s? ago|just now)\b/i.test(l);
    };

    var cardEls = document.querySelectorAll("li[data-occludable-job-id]");
    var jobs = [];

    for (var i = 0; i < cardEls.length && jobs.length < limit; i++) {
      var card = cardEls[i];
      var jobId = card.getAttribute("data-occludable-job-id") || "";
      var lines = card.innerText ? card.innerText.split("\n").map(function(l) { return l.trim(); }).filter(Boolean) : [];
      if (lines.length === 0) continue;

      var job = {};
      job.jobId = jobId;
      job.jobUrl = jobId ? "https://www.linkedin.com/jobs/view/" + jobId + "/" : "";

      // Title: first line, strip trailing "with verification"
      job.title = lines[0].replace(/\s+with verification$/i, "").trim();

      // Company + location: walk lines, skip noise
      var nonSkip = [];
      for (var li = 1; li < lines.length; li++) {
        if (!isSkipLine(lines[li])) nonSkip.push(lines[li]);
      }
      job.company = nonSkip[0] || "";
      job.location = nonSkip[1] || "";

      // Date posted
      job.datePosted = "";
      for (var dl = 0; dl < lines.length; dl++) {
        if (isDateLine(lines[dl])) { job.datePosted = lines[dl]; break; }
      }

      // Easy Apply
      job.isEasyApply = lines.some(function(l) { return /^Easy Apply$/i.test(l); });

      jobs.push(job);
    }

    data.jobs = jobs;

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:700px;margin:0 auto;border-radius:12px;\">";
      h += "<h2 style=\"margin:0 0 4px;font-size:18px;\">Job Search Results</h2>";
      h += "<div style=\"color:#888;font-size:13px;margin-bottom:16px;\">Query: <strong>" + esc(data.query || "") + "</strong> &middot; Location: <strong>" + esc(data.location || "Any") + "</strong>";
      if (data.totalResults !== null) h += " &middot; ~" + data.totalResults + " results";
      h += "</div>";
      for (var ji = 0; ji < data.jobs.length; ji++) {
        var jb = data.jobs[ji];
        h += "<div style=\"border-top:1px solid #333;padding:12px 0;\">";
        h += "<a href=\"" + esc(jb.jobUrl || "#") + "\" style=\"color:#70b5f9;text-decoration:none;font-weight:600;font-size:15px;\">" + esc(jb.title || "Untitled") + "</a>";
        h += "<div style=\"color:#ccc;font-size:13px;margin-top:2px;\">" + esc(jb.company || "") + " &middot; " + esc(jb.location || "") + "</div>";
        h += "<div style=\"color:#888;font-size:12px;margin-top:2px;\">";
        if (jb.datePosted) h += esc(jb.datePosted);
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

**Notes:** LinkedIn 2025 uses `li[data-occludable-job-id]` as the stable job card anchor — all class names are obfuscated hashes. Extraction uses `innerText` line parsing: first line = title, then company and location parsed from subsequent non-noise lines (skipping "with verification", "X connections work here", "Promoted", etc.). Cards that haven't scrolled into view may have empty `innerText` (occluded) and are skipped. Navigate to `/jobs/search/?keywords=...&location=...` and scroll before executing to load more results.

---

## Reporting issues

If this breaks (LinkedIn changes their job card DOM), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `linkedin.com` `job-search`.
