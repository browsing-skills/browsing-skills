---
name: browsing-g2
description: "Use when the user wants to extract software product data from G2 (g2.com) — product overview with ratings, review counts, rating breakdowns, and G2 score, or a list of individual user reviews with pros, cons, reviewer role, and dates. G2 has no public API; data must be scraped from product review pages. Use a real browser because G2 is a JavaScript-rendered app."
---

# G2 — Browsing Skill

Use this index to choose the G2 action that matches the user request, then open only the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **product-overview** — Extract aggregate product data from a G2 product reviews page: product name, overall star rating, total review count, rating breakdown by star level, category, G2 score, and top pros/cons from review highlights. Full spec: [references/product-overview.md](references/product-overview.md).
- **product-reviews** — Extract a list of individual user reviews from a G2 product reviews page, including reviewer name, role, company size, star rating, review title, pros, cons, and published date. Full spec: [references/product-reviews.md](references/product-reviews.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| product-overview | TBD | TBD | Planned. |
| product-reviews | TBD | TBD | Planned. |

## Notes

- G2 has no public API. All data is extracted from rendered HTML on `https://www.g2.com/products/<slug>/reviews`.
- Both actions target the same URL. Run product-overview for aggregate data and product-reviews for individual review content.
- G2 may require a real browser or Chrome Bridge because the page is JavaScript-rendered. Cookie consent dialogs may need dismissal before extraction.
- These actions are read-only. They do not submit reviews, vote, or modify any account data.
