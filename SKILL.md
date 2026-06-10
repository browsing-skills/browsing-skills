---
name: browsing-skills
description: "Umbrella skill for a library of website-specific browsing skills. Use when the user's request targets one of these specific websites: <!-- DOMAINS:START -->airbnb.com, aliexpress.com, amazon.com, booking.com, capterra.com, craigslist.org, facebook.com, g2.com, linkedin.com, madlan.co.il, news.ycombinator.com, reddit.com, substack.com, target.com, tiktok.com, walmart.com, x.com, yad2.co.il, zillow.com<!-- DOMAINS:END -->. For supported sites: load the site-specific action index at skills/<domain>/SKILL.md from this repo, then open only the linked reference file for the chosen action. For unsupported sites: handle the request the normal way — don't force this skill. Each site's skill is also installable independently — if you only ever deal with one site, install that site's skill directly and skip this umbrella."
supportedDomains:
  - airbnb.com
  - aliexpress.com
  - amazon.com
  - booking.com
  - capterra.com
  - craigslist.org
  - facebook.com
  - g2.com
  - linkedin.com
  - madlan.co.il
  - news.ycombinator.com
  - reddit.com
  - substack.com
  - target.com
  - tiktok.com
  - walmart.com
  - x.com
  - yad2.co.il
  - zillow.com
---

# browsing-skills

An open-source library of website-specific browsing skills for AI agents. Each supported website is a first-class skill in this repo — the umbrella (this file) just lists what's available and tells you how to load the one you need.

Repo: https://github.com/browsing-skills/browsing-skills

## When to use this umbrella

You're loaded into an agent that might work with *any* website. When the user mentions a specific site, you want to check: is there a prebuilt skill for it?

- **Supported site** (`<!-- DOMAINS:START -->airbnb.com, aliexpress.com, amazon.com, booking.com, capterra.com, craigslist.org, facebook.com, g2.com, linkedin.com, madlan.co.il, news.ycombinator.com, reddit.com, substack.com, target.com, tiktok.com, walmart.com, x.com, yad2.co.il, zillow.com<!-- DOMAINS:END -->`) → load the site's skill, follow its instructions.
- **Unsupported site** → handle the request the way you normally would.

## When to skip this umbrella

If your agent only ever interacts with one site (e.g. you're building a LinkedIn scraping tool), install that site's skill directly and forget this umbrella exists:

```
https://raw.githubusercontent.com/browsing-skills/browsing-skills/main/skills/linkedin.com/SKILL.md
```

## How to load a site's skill

Fetch the raw action index for the domain the user mentioned:

```
GET https://raw.githubusercontent.com/browsing-skills/browsing-skills/main/skills/<domain>/SKILL.md
```

Examples:
- `skills/x.com/SKILL.md`
- `skills/linkedin.com/SKILL.md`

Read the fetched skill index, choose the matching action, then fetch only that action's linked markdown file under `skills/<domain>/references/`. The reference file tells you:
- Which URL to navigate to for the action
- The JavaScript to execute, in a ```js``` code block
- The action's return shape
- Auth and browser requirements

## How site skills work (mental model)

A site skill is a small markdown index with:

1. **Frontmatter** — machine-readable metadata (name, description, etc.)
2. **Action Index** — short descriptions of available actions and links to full specs
3. **Action reference markdown** — one file per action under `references/`, with requirements, navigation details, a fenced ```js``` code block, and the return shape

## Benchmarks

This repo benchmarks each action against a no-skill browser agent. The skill path loads the site action index plus one action reference, then runs the maintained action code. The no-skill path inspects the live page DOM, derives selectors at runtime, and iterates until it succeeds or times out.

Each site `SKILL.md` includes a compact benchmark table for its actions. Detailed benchmark notes and methodology live in [`BENCHMARKS.md`](./BENCHMARKS.md).

You don't need any custom tooling — fetch the file, read it, follow it.

## Browser access

Most skills require a real browser because target sites are JS-rendered. If your agent has browser access (Playwright, a Chrome extension, etc.), use it.

If you don't have browser access, the optional [Chrome Bridge](https://github.com/browsing-skills/browsing-skills/tree/main/chrome-bridge) companion is a tiny Chrome extension + local bridge that lets you run skills in the user's real Chrome tabs. Setup: under a minute.

### Chrome Bridge Quickstart

Use Chrome Bridge when the target site requires the user's already-signed-in Chrome session, or when Playwright/new browser contexts cannot access the page.

Start the local bridge server from this repo:

```bash
cd chrome-bridge/server
node bridge.js
```

Expected server output:

```text
[bridge] Listening on http://127.0.0.1:7865
[bridge] Waiting for extension to connect...
[bridge] Extension connected
```

If the extension is not connected, load `chrome-bridge/extension/` as an unpacked Chrome extension from `chrome://extensions/`.

Check open tabs:

```bash
curl http://127.0.0.1:7865/tabs
```

Run a skill action in a specific tab:

```bash
curl -X POST http://127.0.0.1:7865/run-action \
  -H 'Content-Type: application/json' \
  -d '{"tabId":123,"code":"({ execute: function(params) { return { content: [{ type: \"text\", text: document.title }] }; } })","params":{"mode":"data"}}'
```

When using Bridge on sensitive logged-in accounts, keep actions read-only unless the user explicitly asks otherwise. Prefer selecting a `tabId` from `/tabs` instead of relying on the active tab.

## Reporting issues / requesting skills

- A skill is broken: https://github.com/browsing-skills/browsing-skills/issues/new?template=skill-broken.md
- A site isn't supported yet: https://github.com/browsing-skills/browsing-skills/issues/new?template=skill-request.md
- An existing skill needs more fields: https://github.com/browsing-skills/browsing-skills/issues/new?template=skill-enhancement.md

## Contributing

See the [README](https://github.com/browsing-skills/browsing-skills#contributing).
