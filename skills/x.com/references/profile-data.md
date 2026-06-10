# X (Twitter) — Profile Data Reference

## Requirements

**Auth:** X requires login to view most content. Ask the user for their `auth_token` cookie from x.com (DevTools → Application → Cookies → `auth_token`). Inject before navigating:

```js
await context.addCookies([{
  name: 'auth_token', value: '<user-provided>', domain: '.x.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Browser:** A real (non-headless) browser is required. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

## How to run this action

Once you're on the right URL, execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

```js
const result = await page.evaluate(async (code) => {
  const tool = eval(code);
  return await tool.execute({ mode: "data" });
}, scriptCode);

const data = JSON.parse(result.content[0].text);
```

Use `mode: "display"` for self-contained HTML output instead of JSON.

---

## Action: profile-data

Use when the user wants info about a specific X user (bio, followers, etc.). Requires the user's handle.

**Navigate to:** `https://x.com/<handle>` (no trailing path).

**Code:**

```js
({
  name: "x-profile-data",
  description: "Extract profile data from an X user page",
  inputSchema: { type: "object", properties: { mode: { type: "string", enum: ["data", "display"] } } },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};
    function esc(value) {
      return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    var nameEl = document.querySelector("[data-testid=UserName]");
    if (nameEl) {
      var nameSpan = nameEl.querySelector("span");
      data.displayName = nameSpan ? nameSpan.textContent.trim() : "";
      var spans = nameEl.querySelectorAll("span");
      for (var i = 0; i < spans.length; i++) { if (spans[i].textContent.startsWith("@")) { data.handle = spans[i].textContent.trim(); break; } }
    }
    data.verified = document.querySelector("[data-testid=UserName] [data-testid=icon-verified]") !== null;
    data.url = window.location.href.split("?")[0];
    var bio = document.querySelector("[data-testid=UserDescription]");
    data.bio = bio ? bio.textContent.trim() : "";
    var joinDate = document.querySelector("[data-testid=UserJoinDate]");
    data.joinDate = joinDate ? joinDate.textContent.trim().replace("Joined ", "") : "";
    var followLinks = document.querySelectorAll("a[href*=\"/verified_followers\"], a[href*=\"/following\"], a[href*=\"/followers\"]");
    for (var j = 0; j < followLinks.length; j++) {
      var href = followLinks[j].getAttribute("href");
      var text = followLinks[j].textContent.trim();
      if (href.includes("following")) data.following = text.replace(" Following", "");
      if (href.includes("followers") || href.includes("verified_followers")) data.followers = text.replace(" Followers", "");
    }
    var primaryCol = document.querySelector("[data-testid=primaryColumn]");
    if (primaryCol) {
      var avatarImgs = primaryCol.querySelectorAll("img[src*=profile_images]");
      if (avatarImgs.length > 0) data.avatarUrl = avatarImgs[0].src.replace(/_bigger|_normal|_x96|_200x200|_400x400/g, "");
    }
    var websiteEl = document.querySelector("[data-testid=UserUrl]");
    if (websiteEl) { var websiteLink = websiteEl.querySelector("a[href]"); data.website = websiteLink ? websiteLink.textContent.trim() : ""; }
    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:24px;max-width:600px;margin:0 auto;border-radius:12px;\">";
      h += "<div style=\"display:flex;align-items:center;gap:16px;margin-bottom:16px;\">";
      if (data.avatarUrl) h += "<img src=\"" + esc(data.avatarUrl) + "\" style=\"width:64px;height:64px;border-radius:50%;\">";
      h += "<div><div style=\"font-weight:600;font-size:20px;\">" + esc(data.displayName||"") + (data.verified?" \u2713":"") + "</div>";
      h += "<div style=\"color:#888;\">" + esc(data.handle||"") + "</div></div></div>";
      if (data.bio) h += "<div style=\"margin-bottom:16px;\">" + esc(data.bio) + "</div>";
      h += "<div style=\"display:flex;gap:20px;margin-bottom:12px;\"><span><strong>" + esc(data.following||"0") + "</strong> Following</span><span><strong>" + esc(data.followers||"0") + "</strong> Followers</span></div>";
      h += "</div>";
      return { content: [{ type: "text", text: h }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})

```

**Returns:** `{ displayName, handle, verified, url, bio, joinDate, following, followers, avatarUrl, website }`

---

## Reporting issues

If one of these actions breaks (selectors changed, X updated their UI), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** 1,865 tokens, ~12.3s total.
- **Without skill:** 324 tokens, failed extraction.
- **Comparison:** Skill extracted OpenAI profile name, handle, verification, bio, join date, following/followers, and URL. No-skill one-shot extractor failed with an uncaught browser eval error before returning structured data.
