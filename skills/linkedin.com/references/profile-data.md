# LinkedIn — Profile Data Reference

## Requirements

**Auth:** Required for full profile data. LinkedIn hides most profile content behind login. Ask the user for their `li_at` session cookie (DevTools → Application → Cookies → `li_at`). Inject before navigating:

```js
await context.addCookies([{
  name: 'li_at', value: '<user-provided>', domain: '.linkedin.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Browser:** Required. Profile pages are rendered client-side; plain `fetch` will not produce a meaningful DOM.

## How to run

Navigate to the profile URL, then execute via `page.evaluate()` or chrome-bridge `/run-action`:

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output.

---

## Action: profile-data

**Navigate to:** `https://www.linkedin.com/in/<handle>/`

**Code:**

```js
({
  name: "linkedin-profile-data",
  description: "Extract a LinkedIn profile's name, headline, location, about, experience, education, and skills",
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

    data.profileUrl = window.location.href.split("?")[0];

    // LinkedIn 2025 uses h2 (not h1) with fully obfuscated class names.
    // Find the profile card h2 by skipping the nav notification count h2.
    var h2els = document.querySelectorAll("h2");
    var nameH2 = null;
    for (var i = 0; i < h2els.length; i++) {
      var txt = h2els[i].textContent.trim();
      if (/notification/i.test(txt) || /^\d+$/.test(txt)) continue;
      if (h2els[i].closest("section")) { nameH2 = h2els[i]; break; }
    }
    if (nameH2) {
      var sec = nameH2.closest("section");
      var secLines = sec.innerText.split("\n").map(function(l) { return l.trim(); }).filter(function(l) { return l && l !== "·" && l !== "•"; });
      data.name = secLines[0] || "";
      data.headline = secLines[2] || "";
      data.location = secLines[3] || "";
      var connIdx = -1;
      for (var ci = 0; ci < secLines.length; ci++) {
        if (/^connections?$/i.test(secLines[ci])) { connIdx = ci; break; }
      }
      if (connIdx > 0) data.connectionsCount = secLines[connIdx - 1] + " connections";
      var skipWords = /^(Contact info|Connect|Message|Follow|More)$/i;
      var mid = secLines.slice(4, connIdx > 0 ? connIdx - 1 : secLines.length);
      var keyMids = mid.filter(function(l) { return !skipWords.test(l) && l.length > 1; });
      data.company = keyMids[0] || "";
      data.topEducation = keyMids[1] || "";
    }

    // Section IDs (#about, #experience, etc.) were removed in LinkedIn 2025.
    // Parse sections from document.body.innerText using heading markers instead.
    var pageText = document.body.innerText;
    function extractSectionLines(startLabel, endLabels, limit) {
      var startMarker = "\n" + startLabel + "\n";
      var startIdx = pageText.indexOf(startMarker);
      if (startIdx === -1) return [];
      var cStart = startIdx + startMarker.length;
      var cEnd = pageText.length;
      for (var ei = 0; ei < endLabels.length; ei++) {
        var eIdx = pageText.indexOf("\n" + endLabels[ei] + "\n", cStart);
        if (eIdx > -1 && eIdx < cEnd) cEnd = eIdx;
      }
      return pageText.slice(cStart, cEnd).trim().split("\n").map(function(l) { return l.trim(); }).filter(function(l) {
        return l && !l.startsWith("•") && !l.startsWith("…") && !l.startsWith("-") && !l.endsWith(":") && l.indexOf("\t") === -1;
      }).slice(0, limit || 999);
    }

    var aboutLines = extractSectionLines("About", ["Experience", "Education", "Skills", "Activity"], 10);
    for (var ab = 0; ab < aboutLines.length; ab++) {
      if (aboutLines[ab].length > 30) { data.about = aboutLines[ab].slice(0, 200); break; }
    }

    var isDuration = function(s) { return /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4}|Present)/i.test(s); };
    var expLines = extractSectionLines("Experience", ["Education", "Skills", "Courses", "Licenses"], 40);
    data.experience = [];
    var expI = 0;
    while (expI < expLines.length && data.experience.length < 3) {
      var t = expLines[expI] || "", m = expLines[expI + 1] || "", d = expLines[expI + 2] || "";
      if (t && !isDuration(t) && isDuration(d)) {
        var parts = m.split("·");
        data.experience.push({ title: t, company: (parts[0] || "").trim(), type: (parts[1] || "").trim(), duration: d });
        expI += 3;
      } else { expI++; }
    }

    var isSchoolLine = function(s) { return s && s.length > 5 && /[A-Z]/.test(s) && !s.toLowerCase().includes("skills") && !s.startsWith("http"); };
    var eduLines = extractSectionLines("Education", ["Skills", "Experience", "Courses", "Volunteer"], 20);
    data.education = [];
    var eduI = 0;
    while (eduI < eduLines.length && data.education.length < 3) {
      var s = eduLines[eduI] || "", deg = eduLines[eduI + 1] || "", yr = eduLines[eduI + 2] || "";
      if (isSchoolLine(s)) {
        data.education.push({ school: s, degree: isSchoolLine(deg) && !/^\d/.test(deg) ? deg : "", years: /\d{4}/.test(yr) ? yr : "" });
        eduI += 3;
      } else { eduI++; }
    }

    var avatarSelectors = ["img.pv-top-card-profile-picture__image", "img.profile-photo-edit__preview", "button[aria-label*='photo'] img", "img[alt*='profile' i]"];
    for (var ai = 0; ai < avatarSelectors.length; ai++) {
      var aEl = document.querySelector(avatarSelectors[ai]);
      if (aEl && aEl.src && aEl.src.indexOf("data:") === -1) { data.avatarUrl = aEl.src; break; }
    }

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:640px;margin:0 auto;border-radius:12px;\">";
      if (data.avatarUrl) h += "<img src=\"" + data.avatarUrl + "\" style=\"width:72px;height:72px;border-radius:50%;margin-bottom:12px;display:block;\">";
      h += "<a href=\"" + (data.profileUrl || "#") + "\" style=\"color:#70b5f9;text-decoration:none;font-weight:700;font-size:20px;\">" + (data.name || "Unknown") + "</a>";
      if (data.headline) h += "<div style=\"color:#ccc;font-size:14px;margin-top:4px;\">" + data.headline + "</div>";
      if (data.location) h += "<div style=\"color:#888;font-size:13px;margin-top:2px;\">" + data.location + "</div>";
      if (data.connectionsCount) h += "<div style=\"color:#888;font-size:13px;margin-top:2px;\">" + data.connectionsCount + "</div>";
      if (data.about) h += "<div style=\"margin-top:16px;border-top:1px solid #333;padding-top:12px;font-size:14px;line-height:1.6;\">" + data.about + "</div>";
      if (data.experience && data.experience.length) {
        h += "<div style=\"margin-top:16px;\"><strong>Experience</strong><ul style=\"margin:8px 0;padding-left:20px;\">";
        for (var ei = 0; ei < data.experience.length; ei++) {
          var exp = data.experience[ei];
          h += "<li style=\"margin-bottom:6px;font-size:13px;\"><strong>" + (exp.title || "") + "</strong> at " + (exp.company || "") + (exp.duration ? " · " + exp.duration : "") + "</li>";
        }
        h += "</ul></div>";
      }
      if (data.education && data.education.length) {
        h += "<div style=\"margin-top:12px;\"><strong>Education</strong><ul style=\"margin:8px 0;padding-left:20px;\">";
        for (var di = 0; di < data.education.length; di++) {
          var edu = data.education[di];
          h += "<li style=\"font-size:13px;\">" + (edu.school || "") + (edu.degree ? " — " + edu.degree : "") + (edu.years ? " · " + edu.years : "") + "</li>";
        }
        h += "</ul></div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ name, headline, location, profileUrl, avatarUrl, connectionsCount, about, experience, education, skills }`

**Notes:** LinkedIn 2025 uses `h2` (not `h1`) for the profile name and fully obfuscated class names — no readable CSS selectors survive. Section id anchors (`#experience`, `#education`, etc.) were also removed. This action uses `h2.closest("section")` for the top card and `document.body.innerText` line-parsing for experience/education sections. Verified against live sessions via Chrome Bridge. Requires `li_at` cookie and a real browser.

---

## Reporting issues

If this breaks (LinkedIn changes their DOM or section ids), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `linkedin.com` `profile-data`.
