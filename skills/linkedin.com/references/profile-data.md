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

    // Name — single h1 on profile pages
    var h1 = document.querySelector("h1");
    if (h1) data.name = h1.textContent.trim();

    // Headline — tagline below the name
    var headlineEl = document.querySelector(".text-body-medium.break-words");
    if (headlineEl) data.headline = headlineEl.textContent.trim();

    // Location
    var locationEl = document.querySelector(".text-body-small.inline.t-black--light.break-words");
    if (locationEl) data.location = locationEl.textContent.trim();

    // Profile URL (canonical, no query string)
    data.profileUrl = window.location.href.split("?")[0];

    // Avatar
    var avatarEl = document.querySelector("img.pv-top-card-profile-picture__image, .profile-photo-edit__preview img, img.profile-photo-edit__preview");
    if (avatarEl) data.avatarUrl = avatarEl.src || "";

    // Connections / followers — look for text near the top card
    var connectionEls = document.querySelectorAll(".pv-top-card--list-bullet li, .pvs-header__subtitle span, [class*='connection'] span, [class*='follower'] span");
    for (var ci = 0; ci < connectionEls.length; ci++) {
      var ctxt = connectionEls[ci].textContent.trim().toLowerCase();
      if (ctxt.indexOf("connection") !== -1 || ctxt.indexOf("follower") !== -1) {
        data.connectionsCount = connectionEls[ci].textContent.trim();
        break;
      }
    }

    // About section — visually-hidden span inside #about sibling container
    var aboutSection = document.getElementById("about");
    if (aboutSection) {
      var aboutContainer = aboutSection.nextElementSibling;
      while (aboutContainer) {
        var hiddenEl = aboutContainer.querySelector(".visually-hidden");
        if (hiddenEl) {
          var hiddenText = hiddenEl.textContent.trim();
          if (hiddenText.length > 0) {
            data.about = hiddenText;
            break;
          }
        }
        // Also try plain text content of the div
        var plainText = aboutContainer.textContent.trim();
        if (plainText.length > 20) {
          data.about = plainText;
          break;
        }
        aboutContainer = aboutContainer.nextElementSibling;
      }
    }

    // Helper: extract items from a section by its anchor id
    function extractSectionItems(sectionId, limit) {
      var anchor = document.getElementById(sectionId);
      if (!anchor) return [];
      var items = [];
      var container = anchor.nextElementSibling;
      while (container) {
        var listItems = container.querySelectorAll(".pvs-list__item--line-separated, .artdeco-list__item");
        if (listItems.length > 0) {
          for (var li = 0; li < Math.min(listItems.length, limit || 3); li++) {
            var item = listItems[li];
            var titleEl = item.querySelector(".mr1.t-bold span[aria-hidden], .mr1.t-bold span");
            var subtitleEl = item.querySelector(".t-14.t-normal span[aria-hidden], .t-14.t-normal span");
            var metaEl = item.querySelector(".t-14.t-black--light span[aria-hidden], .t-14.t-black--light span");
            items.push({
              title: titleEl ? titleEl.textContent.trim() : "",
              company: subtitleEl ? subtitleEl.textContent.trim() : "",
              duration: metaEl ? metaEl.textContent.trim() : ""
            });
          }
          break;
        }
        container = container.nextElementSibling;
      }
      return items;
    }

    // Experience
    data.experience = extractSectionItems("experience", 3);

    // Education
    var eduItems = extractSectionItems("education", 3);
    data.education = eduItems.map(function(item) {
      return { school: item.title, degree: item.company, duration: item.duration };
    });

    // Skills — top visible skill pills/items
    var skillsAnchor = document.getElementById("skills");
    var skills = [];
    if (skillsAnchor) {
      var skillsContainer = skillsAnchor.nextElementSibling;
      while (skillsContainer) {
        var skillItems = skillsContainer.querySelectorAll(".pvs-list__item--line-separated, .artdeco-list__item");
        if (skillItems.length > 0) {
          for (var si = 0; si < Math.min(skillItems.length, 10); si++) {
            var skillTitleEl = skillItems[si].querySelector(".mr1.t-bold span[aria-hidden], .mr1.t-bold span");
            if (skillTitleEl) skills.push(skillTitleEl.textContent.trim());
          }
          break;
        }
        skillsContainer = skillsContainer.nextElementSibling;
      }
    }
    data.skills = skills;

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
          h += "<li style=\"margin-bottom:6px;font-size:13px;\">" + (data.experience[ei].title || "") + " at " + (data.experience[ei].company || "") + (data.experience[ei].duration ? " · " + data.experience[ei].duration : "") + "</li>";
        }
        h += "</ul></div>";
      }
      if (data.skills && data.skills.length) {
        h += "<div style=\"margin-top:12px;\"><strong>Skills:</strong> <span style=\"color:#aaa;font-size:13px;\">" + data.skills.join(", ") + "</span></div>";
      }
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ name, headline, location, profileUrl, avatarUrl, connectionsCount, about, experience, education, skills }`

**Notes:** Primary extraction anchors on stable element types (`h1`, section ids `#about`, `#experience`, `#education`, `#skills`) with class-based fallbacks. LinkedIn uses obfuscated class names that can change; the id anchors are more stable. Requires `li_at` cookie and a real browser. Without auth, most fields will be empty or missing.

---

## Reporting issues

If this breaks (LinkedIn changes their DOM or section ids), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD.
- **Without skill:** TBD.
- **Comparison:** Planned benchmark for `linkedin.com` `profile-data`.
