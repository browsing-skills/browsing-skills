---
name: browsing-instagram
description: "Use when the user wants to interact with Instagram — extract a user's profile data (bio, followers, following, post count, avatar) or scrape visible posts from a user's grid (URLs, thumbnails, captions). Works on instagram.com profile pages. Requires a logged-in session (sessionid cookie) and a real browser — Instagram is a JS-rendered SPA."
---

# Instagram — Browsing Skill

Use this index to choose the Instagram action that matches the user request, then open the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **profile-data** — Extract an Instagram user's profile: username, full name, bio, followers, following, post count, avatar URL, verification status, and website link. Full spec: [references/profile-data.md](references/profile-data.md).
- **user-posts** — Extract visible posts from an Instagram user's profile grid: post URLs, thumbnail images, alt-text caption snippets, and like/comment counts when visible. Full spec: [references/user-posts.md](references/user-posts.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| profile-data | TBD | TBD | Planned. |
| user-posts | TBD | TBD | Planned. |
