---
name: browsing-x
description: "Use when the user wants to interact with X (formerly Twitter) — search for posts, extract a specific post's data (content + engagement + author), extract a user's profile (bio, followers, etc.), extract posts from a user's profile timeline, or extract posts from the home feed (For You or Following tab). Works on x.com and twitter.com. Requires a logged-in session (auth_token cookie) and a real browser — X is a JS-rendered SPA."
---

# X (Twitter) — Browsing Skill

Use this index to choose the X action that matches the user request, then open the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **search** — Search X for a query and extract visible post results. Full spec: [references/search.md](references/search.md).
- **post-data** — Extract a specific post's content, author details, engagement metrics, timestamp, and media. Full spec: [references/post-data.md](references/post-data.md).
- **profile-data** — Extract an X user profile, including bio, follower counts, avatar, website, and account metadata. Full spec: [references/profile-data.md](references/profile-data.md).
- **user-timeline** — Extract visible posts from a user's profile timeline. Full spec: [references/user-timeline.md](references/user-timeline.md).
- **following-feed** — Extract visible posts from the X home feed (For You or Following tab). Full spec: [references/following-feed.md](references/following-feed.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| search | 1,699 / ~6.4s | 3,907 / ~15.8s | Skill valid; no-skill malformed partial result. |
| post-data | 1,987 / ~4.3s | 14,333 / ~35.1s | Skill complete; no-skill partial result. |
| profile-data | 1,865 / ~12.3s | 324 / failed | Skill complete; no-skill one-shot eval failed. |
| user-timeline | TBD | TBD | Not yet benchmarked. |
| following-feed | TBD | TBD | Not yet benchmarked. |

