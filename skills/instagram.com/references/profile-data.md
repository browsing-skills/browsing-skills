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
    function esc(value) {
      return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // Primary: DOM extraction — more reliable than JSON (avoids embedded/cached profiles)
    // username from URL path
    data.username = window.location.pathname.replace(/\//g, '') || '';

    // fullName — h1 or h2 in header (may match username if no display name set)
    var nameEl = document.querySelector('header h1, header h2');
    if (nameEl) data.fullName = nameEl.textContent.trim();

    // stats + bio: parse header.innerText which has reliable format
    // e.g. "username\n113 posts\n168 followers\n2,031 following\nBio text\n..."
    var header = document.querySelector("header");
    if (header) {
      var headerText = header.innerText || "";
      var postsM = headerText.match(/([\d,]+)\s+posts?/i);
      var followersM = headerText.match(/([\d,.KkMm]+)\s+followers?/i);
      var followingM = headerText.match(/([\d,.KkMm]+)\s+following/i);
      if (postsM) data.postCount = parseInt(postsM[1].replace(/,/g,""), 10);
      if (followersM) data.followers = followersM[1];
      if (followingM) data.following = followingM[1];
    }

    // bio — any span in header that isn't a stat/username/button text
    if (!data.bio && header) {
      var spans = header.querySelectorAll("span");
      for (var bi = 0; bi < spans.length; bi++) {
        var s = spans[bi].textContent.trim();
        if (spans[bi].childElementCount === 0 && s.length > 10 &&
            s !== data.username && !/^\d[\d,.]*(k|m)?$/i.test(s) &&
            !/^(posts?|followers?|following|follow|message|edit\s*profile)$/i.test(s)) {
          data.bio = s; break;
        }
      }
    }

    // avatar
    var avatarImg = document.querySelector('header img[alt*="profile picture"], header img[alt*="Profile"], main header img');
    if (avatarImg) data.avatarUrl = avatarImg.src;

    // verified
    data.is_verified = document.querySelector('[aria-label="Verified"], [title="Verified"]') !== null;

    // website
    var linkEl = document.querySelector('header a[href^="http"]:not([href*="instagram.com"]), header a[rel="nofollow"]');
    if (linkEl) data.website = linkEl.href || linkEl.textContent.trim();

    // Fallback: enrich from JSON scripts if followers/postCount still missing
    if (!data.followers || !data.postCount) {
      var targetUsername = data.username.toLowerCase();
      var jsonScripts = document.querySelectorAll('script[type="application/json"]');
      for (var si = 0; si < jsonScripts.length; si++) {
        try {
          var str = jsonScripts[si].textContent;
          if (str.indexOf('"' + targetUsername + '"') === -1) continue;
          var parsed = JSON.parse(str);
          var findUser = function(obj) {
            if (!obj || typeof obj !== 'object') return null;
            if (obj.username && obj.username.toLowerCase() === targetUsername && obj.biography !== undefined) return obj;
            var keys = Object.keys(obj);
            for (var ki = 0; ki < keys.length; ki++) {
              var found = findUser(obj[keys[ki]]);
              if (found) return found;
            }
            return null;
          };
          var user = findUser(parsed);
          if (user) {
            if (!data.followers && user.edge_followed_by) data.followers = user.edge_followed_by.count;
            if (!data.following && user.edge_follow) data.following = user.edge_follow.count;
            if (!data.postCount && user.edge_owner_to_timeline_media) data.postCount = user.edge_owner_to_timeline_media.count;
            if (!data.avatarUrl) data.avatarUrl = user.profile_pic_url_hd || user.profile_pic_url || '';
            if (!data.bio && user.biography) data.bio = user.biography;
            break;
          }
        } catch (e) { /* ignore */ }
      }
    }

    if (mode === "display") {
      var h = "<div style=\"font-family:-apple-system,sans-serif;background:#fafafa;color:#262626;padding:24px;max-width:600px;margin:0 auto;border-radius:12px;border:1px solid #dbdbdb;\">";
      h += "<div style=\"display:flex;align-items:center;gap:20px;margin-bottom:20px;\">";
      if (data.avatarUrl) h += "<img src=\"" + esc(data.avatarUrl) + "\" style=\"width:80px;height:80px;border-radius:50%;border:2px solid #dbdbdb;\">";
      h += "<div>";
      h += "<div style=\"font-size:20px;font-weight:600;\">" + esc(data.username || '') + (data.is_verified ? " ✓" : "") + "</div>";
      if (data.fullName) h += "<div style=\"color:#8e8e8e;\">" + esc(data.fullName) + "</div>";
      h += "</div></div>";
      if (data.bio) h += "<div style=\"margin-bottom:16px;white-space:pre-wrap;\">" + esc(data.bio) + "</div>";
      if (data.website) h += "<div style=\"margin-bottom:16px;\"><a href=\"" + esc(data.website) + "\" style=\"color:#00376b;\">" + esc(data.website) + "</a></div>";
      h += "<div style=\"display:flex;gap:24px;\">";
      h += "<span><strong>" + esc(data.postCount || '—') + "</strong> posts</span>";
      h += "<span><strong>" + esc(data.followers || '—') + "</strong> followers</span>";
      h += "<span><strong>" + esc(data.following || '—') + "</strong> following</span>";
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
