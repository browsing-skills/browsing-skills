---
name: browsing-linkedin
description: "Use when the user wants to interact with LinkedIn — extract data from a specific post (content, author, reactions, comments), or download the user's saved posts as structured data or markdown. Works on linkedin.com post pages and the saved-posts feed. No login required for public posts; for private content the user must provide an li_at session cookie."
---

# LinkedIn — Browsing Skill

Use this index to choose the LinkedIn action that matches the user request, then open the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **post-data** — Extract a LinkedIn post's content, author, reactions, comments, reposts, and canonical metadata. Full spec: [references/post-data.md](references/post-data.md).
- **saved-posts** — Extract all saved posts from the user's LinkedIn saved-posts feed. Auto-scrolls to load the full list, expands truncated bodies, auto-tags posts by topic (AI/ML, Career, Dev, etc.), and supports regex filtering. Returns JSON, HTML cards, or a markdown digest. Full spec: [references/saved-posts.md](references/saved-posts.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| post-data | TBD | TBD | Planned. |
| saved-posts | TBD | TBD | Planned. |

