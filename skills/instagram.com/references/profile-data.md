# Instagram — Profile Data Reference

## Requirements

**Auth:** Instagram requires a logged-in session to view profile data. Ask the user for their `sessionid` cookie from instagram.com (DevTools → Application → Cookies → `sessionid`). Inject before navigating:

```js
await context.addCookies([{
  name: 'sessionid', value: '<user-provided>', domain: '.instagram.com',
  path: '/', httpOnly: true, secure: true
}]);
```

**Browser:** A real (non-headless) browser is required. If you have browser access (Playwright, a built-in integration, etc.), use it. Otherwise ask the user to install the [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion.

## How to run this action

Navigate to the profile URL, wait for the page to finish loading, then execute the action's code via `page.evaluate()` (or the chrome-bridge `/run-action` endpoint):

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

Use when the user wants info about a specific Instagram user (bio, follower counts, etc.). Requires the user's Instagram username.

**Navigate to:** `https://www.instagram.com/<username>/` (include the trailing slash).

**Code:**

```js
({
  name: "instagram-profile-data",
  description: "Extract profile data from an Instagram user page",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["data", "display"] }
    }
  },
  execute: function(params) {
    var mode = (params && params.mode) || "data";
    var data = {};

    // Attempt 1: parse profile JSON embedded in <script type="application/json">
    var jsonScripts = document.querySelectorAll('script[type="application/json"]');
    for (var si = 0; si < jsonScripts.length; si++) {
      try {
        var parsed = JSON.parse(jsonScripts[si].textContent);
        // Walk the object tree looking for user data
        var str = JSON.stringify(parsed);
        if (str.indexOf('"username"') !== -1 && str.indexOf('"biography"') !== -1) {
          // Try to find user node
          var findUser = function(obj) {
            if (!obj || typeof obj !== 'object') return null;
            if (obj.username && obj.biography !== undefined) return obj;
            var keys = Object.keys(obj);
            for (var ki = 0; ki < keys.length; ki++) {
              var found = findUser(obj[keys[ki]]);
              if (found) return found;
            }
            return null;
          };
          var user = findUser(parsed);
          if (user) {
            data.username = user.username || '';
            data.fullName = user.full_name || '';
            data.bio = user.biography || '';
            data.is_verified = user.is_verified || false;
            data.website = user.external_url || '';
            if (user.edge_followed_by) data.followers = user.edge_followed_by.count;
            if (user.edge_follow) data.following = user.edge_follow.count;
            if (user.edge_owner_to_timeline_media) data.postCount = user.edge_owner_to_timeline_media.count;
            var pic = user.profile_pic_url_hd || user.profile_pic_url || '';
            data.avatarUrl = pic;
            break;
          }
        }
      } catch (e) { /* ignore */ }
    }

    // Attempt 2: Fallback — scrape visible DOM elements
    if (!data.username) {
      data.username = window.location.pathname.replace(/\//g, '') || '';
    }

    if (!data.fullName) {
      var h1 = document.querySelector('header h1, header h2, main h1, main h2');
      if (h1) data.fullName = h1.textContent.trim();
    }

    if (!data.bio) {
      var bioEl = document.querySelector('header div[class] > span, header section > div span, main header span[class]');
      if (bioEl) data.bio = bioEl.textContent.trim();
    }

    if (data.followers === undefined || data.followers === null) {
      // Look for elements with aria-label containing "followers"
      var allEls = document.querySelectorAll('a[href*="followers"], button, span');
      for (var ei = 0; ei < allEls.length; ei++) {
        var al = allEls[ei].getAttribute('aria-label') || allEls[ei].textContent || '';
        var followersMatch = al.match(/([\d,]+)\s+[Ff]ollowers/);
        if (followersMatch) { data.followers = followersMatch[1]; break; }
      }
    }

    if (data.following === undefined || data.following === null) {
      var allEls2 = document.querySelectorAll('a[href*="following"], button, span');
      for (var ei2 = 0; ei2 < allEls2.length; ei2++) {
        var al2 = allEls2[ei2].getAttribute('aria-label') || allEls2[ei2].textContent || '';
        var followingMatch = al2.match(/([\d,]+)\s+[Ff]ollowing/);
        if (followingMatch) { data.following = followingMatch[1]; break; }
      }
    }

    if (!data.avatarUrl) {
      var avatarImg = document.querySelector('header img[alt*="profile picture"], header img[alt*="Profile"], main header img');
      if (avatarImg) data.avatarUrl = avatarImg.src;
    }

    if (!data.is_verified) {
      data.is_verified = document.querySelector('[aria-label="Verified"], [title="Verified"]') !== null;
    }

    if (!data.website) {
      var linkEl = document.querySelector('header a[href^="http"]:not([href*="instagram.com"]), header a[rel="nofollow"]');
      if (linkEl) data.website = linkEl.href || linkEl.textContent.trim();
    }

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#fafafa;color:#262626;padding:24px;max-width:600px;margin:0 auto;border-radius:12px;border:1px solid #dbdbdb;\">";
      h += "<div style=\"display:flex;align-items:center;gap:20px;margin-bottom:20px;\">";
      if (data.avatarUrl) h += "<img src=\"" + data.avatarUrl + "\" style=\"width:80px;height:80px;border-radius:50%;border:2px solid #dbdbdb;\">";
      h += "<div>";
      h += "<div style=\"font-size:20px;font-weight:600;\">" + (data.username || '') + (data.is_verified ? " ✓" : "") + "</div>";
      if (data.fullName) h += "<div style=\"color:#8e8e8e;\">" + data.fullName + "</div>";
      h += "</div></div>";
      if (data.bio) h += "<div style=\"margin-bottom:16px;white-space:pre-wrap;\">" + data.bio + "</div>";
      if (data.website) h += "<div style=\"margin-bottom:16px;\"><a href=\"" + data.website + "\" style=\"color:#00376b;\">" + data.website + "</a></div>";
      h += "<div style=\"display:flex;gap:24px;\">";
      h += "<span><strong>" + (data.postCount || '—') + "</strong> posts</span>";
      h += "<span><strong>" + (data.followers || '—') + "</strong> followers</span>";
      h += "<span><strong>" + (data.following || '—') + "</strong> following</span>";
      h += "</div></div>";
      return { content: [{ type: "text", text: h }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
})
```

**Returns:** `{ username, fullName, bio, followers, following, postCount, avatarUrl, is_verified, website }`

---

## Reporting issues

If one of these actions breaks (selectors changed, Instagram updated their UI), file an issue: https://github.com/browsing-skills/browsing-skills/issues/new/choose

## Benchmark

- **With skill:** TBD
- **Without skill:** TBD
