# LinkedIn — Company Data Reference

## Requirements

**Auth:** Recommended for full data. Some company details are hidden behind login. Ask the user for their `li_at` session cookie (DevTools → Application → Cookies → `li_at`). Inject before navigating:

```js
await context.addCookies([{
  name: 'li_at', value: '<user-provided>', domain: '.linkedin.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Browser:** Required. Company pages are rendered client-side.

## How to run

Navigate to the company page, then execute via `page.evaluate()` or chrome-bridge `/run-action`:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output.

---

## Action: company-data

**Navigate to:** `https://www.linkedin.com/company/<slug>/`

**Code:**

```js
({
  name: "linkedin-company-data",
  description: "Extract a LinkedIn company page including name, tagline, about, website, industry, size, headquarters, founded date, specialties, follower count, and employee count",
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["data", "display"],
        description: "Output mode. data (default) returns JSON. display returns self-contained HTML."
      }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};
    function esc(value) {
      return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // Profile URL (canonical, no query string)
    data.profileUrl = window.location.href.split("?")[0];

    // Name — single h1
    var h1 = document.querySelector("h1");
    if (h1) data.name = h1.textContent.trim();

    // Tagline / subtitle below name
    var taglineEl = document.querySelector(".org-top-card-summary__tagline, .top-card__subline-item, .top-card-layout__card .top-card__subline-item");
    if (!taglineEl) taglineEl = document.querySelector(".org-top-card-summary-info-list__info-item:first-child");
    if (taglineEl) data.tagline = taglineEl.textContent.trim();

    // Logo
    var logoEl = document.querySelector("img.org-top-card-primary-content__logo, img.evi-image.lazy-image.org-top-card-primary-content__logo, .org-top-card-primary-content__logo img");
    if (logoEl) data.logoUrl = logoEl.src || "";

    // Followers and employees — scan prominent text near page top
    var summaryItems = document.querySelectorAll(".org-top-card-summary-info-list__info-item, [class*='top-card'] span, [class*='followers'] span, [class*='employee'] span");
    for (var si = 0; si < summaryItems.length; si++) {
      var stxt = summaryItems[si].textContent.trim().toLowerCase();
      if (!data.followerCount && stxt.indexOf("follower") !== -1) {
        data.followerCount = summaryItems[si].textContent.trim();
      }
      if (!data.employeeCount && (stxt.indexOf("employee") !== -1 || stxt.indexOf("associated member") !== -1)) {
        data.employeeCount = summaryItems[si].textContent.trim();
      }
    }

    // About section — look for #about anchor or a section with "About" heading
    var aboutAnchor = document.getElementById("about");
    if (aboutAnchor) {
      var aboutContainer = aboutAnchor.nextElementSibling;
      while (aboutContainer) {
        var aboutText = aboutContainer.querySelector(".org-about-module__description, p, .break-words");
        if (aboutText) {
          data.about = aboutText.textContent.trim();
          break;
        }
        var plainText = aboutContainer.textContent.trim();
        if (plainText.length > 20) {
          data.about = plainText.substring(0, 1000);
          break;
        }
        aboutContainer = aboutContainer.nextElementSibling;
      }
    }

    // About panel — labeled data items (Website, Industry, Company size, etc.)
    // These appear in a definition-list-style panel on the company About tab or sidebar
    function extractLabeledItem(label) {
      // Try dt/dd pairs
      var dts = document.querySelectorAll("dt");
      for (var di = 0; di < dts.length; di++) {
        if (dts[di].textContent.trim().toLowerCase().indexOf(label.toLowerCase()) !== -1) {
          var dd = dts[di].nextElementSibling;
          if (dd) return dd.textContent.trim();
        }
      }
      // Try pairs where a label span is followed by a value span within the same container
      var labels = document.querySelectorAll(".org-about-company-module__company-type-text, [class*='label'], [class*='description-item']");
      for (var li = 0; li < labels.length; li++) {
        if (labels[li].textContent.trim().toLowerCase().indexOf(label.toLowerCase()) !== -1) {
          var sibling = labels[li].nextElementSibling;
          if (sibling) return sibling.textContent.trim();
          var parent = labels[li].parentElement;
          if (parent) {
            var spans = parent.querySelectorAll("span");
            for (var spi = 0; spi < spans.length; spi++) {
              if (spans[spi].textContent.trim().toLowerCase().indexOf(label.toLowerCase()) === -1) {
                return spans[spi].textContent.trim();
              }
            }
          }
        }
      }
      return null;
    }

    // Also try the structured about module selectors
    var websiteEl = document.querySelector(".org-about-company-module__website a, [data-test-id='about-module__website'] a");
    if (websiteEl) {
      data.website = websiteEl.href || websiteEl.textContent.trim();
    } else {
      data.website = extractLabeledItem("Website") || null;
    }

    data.industry = extractLabeledItem("Industry");
    data.companySize = extractLabeledItem("Company size");
    data.headquarters = extractLabeledItem("Headquarters");
    data.founded = extractLabeledItem("Founded");
    data.specialties = extractLabeledItem("Specialties");

    // Fallback: scrape the entire about module for labeled pairs
    var aboutModule = document.querySelector(".org-about-company-module, [class*='about-module'], .org-about-module");
    if (aboutModule) {
      var moduleText = aboutModule.textContent;
      if (!data.website) {
        var webMatch = moduleText.match(/Website\s+(https?:\/\/[^\s]+)/i);
        if (webMatch) data.website = webMatch[1];
      }
      if (!data.industry) {
        var indMatch = moduleText.match(/Industry\s+([^\n]+)/i);
        if (indMatch) data.industry = indMatch[1].trim();
      }
      if (!data.companySize) {
        var sizeMatch = moduleText.match(/Company size\s+([^\n]+)/i);
        if (sizeMatch) data.companySize = sizeMatch[1].trim();
      }
      if (!data.headquarters) {
        var hqMatch = moduleText.match(/Headquarters\s+([^\n]+)/i);
        if (hqMatch) data.headquarters = hqMatch[1].trim();
      }
      if (!data.founded) {
        var foundedMatch = moduleText.match(/Founded\s+([^\n]+)/i);
        if (foundedMatch) data.founded = foundedMatch[1].trim();
      }
      if (!data.specialties) {
        var specMatch = moduleText.match(/Specialties\s+([^\n]+)/i);
        if (specMatch) data.specialties = specMatch[1].trim();
      }
    }

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:640px;margin:0 auto;border-radius:12px;\">";
      if (data.logoUrl) h += "<img src=\"" + esc(data.logoUrl) + "\" style=\"width:64px;height:64px;border-radius:8px;margin-bottom:12px;display:block;object-fit:contain;background:#1a1a1a;\">";
      h += "<a href=\"" + esc(data.profileUrl || "#") + "\" style=\"color:#70b5f9;text-decoration:none;font-weight:700;font-size:20px;\">" + esc(data.name || "Unknown") + "</a>";
      if (data.tagline) h += "<div style=\"color:#ccc;font-size:14px;margin-top:4px;\">" + esc(data.tagline) + "</div>";
      if (data.followerCount) h += "<div style=\"color:#888;font-size:13px;margin-top:2px;\">" + esc(data.followerCount) + "</div>";
      if (data.employeeCount) h += "<div style=\"color:#888;font-size:13px;\">" + esc(data.employeeCount) + "</div>";
      if (data.about) h += "<div style=\"margin-top:16px;border-top:1px solid #333;padding-top:12px;font-size:14px;line-height:1.6;\">" + esc(data.about) + "</div>";
      h += "<div style=\"margin-top:16px;border-top:1px solid #333;padding-top:12px;\">";
      var details = [
        ["Website", data.website ? "<a href=\"" + esc(data.website) + "\" style=\"color:#70b5f9;\">" + esc(data.website) + "</a>" : null],
        ["Industry", data.industry],
        ["Company size", data.companySize],
        ["Headquarters", data.headquarters],
        ["Founded", data.founded],
        ["Specialties", data.specialties]
      ];
      for (var di = 0; di < details.length; di++) {
        if (details[di][1]) {
          h += "<div style=\"margin-bottom:6px;font-size:13px;\"><span style=\"color:#888;\">" + esc(details[di][0]) + ":</span> " + (details[di][0] === "Website" ? details[di][1] : esc(details[di][1])) + "</div>";
        }
      }
      h += "</div></div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ name, tagline, profileUrl, logoUrl, followerCount, employeeCount, about, website, industry, companySize, headquarters, founded, specialties }`

**Notes:** Labeled data items (website, industry, size, headquarters, founded, specialties) are extracted using two strategies: structured selector matches and a regex pass over the about module text. Navigate to the `/about` sub-page (e.g. `https://www.linkedin.com/company/<slug>/about/`) for the most complete about-panel data — the main company page sometimes omits the full panel until the user scrolls.

---

## Reporting issues

If this breaks (LinkedIn changes their company page DOM), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `linkedin.com` `company-data`.
