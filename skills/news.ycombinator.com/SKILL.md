---
name: browsing-hackernews
description: "Use when the user wants to interact with Hacker News (news.ycombinator.com) — read top stories from the frontpage, extract a post's data and comments, or search stories via the Algolia HN search API. No authentication required. HN uses server-rendered HTML, so extraction works reliably without a browser (though a browser still works fine)."
---

# Hacker News — Browsing Skill

Use this index to choose the HN action that matches the user request, then open the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **frontpage** — Extract top stories from the HN frontpage (rank, title, URL, score, author, comment count). Supports pagination. Full spec: [references/frontpage.md](references/frontpage.md).
- **post-data** — Extract a specific post's details (title, URL, score, author, age) and its top-level comments. Full spec: [references/post-data.md](references/post-data.md).
- **search** — Search Hacker News stories via the Algolia HN API. No browser navigation required — calls the API via fetch. Full spec: [references/search.md](references/search.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| frontpage | TBD | TBD | TBD |
| post-data | TBD | TBD | TBD |
| search | TBD | TBD | TBD |
