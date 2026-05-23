---
name: browsing-capterra
description: "Use when the user wants to extract software product data from Capterra (capterra.com) — product overview with ratings, category breakdowns, pricing, and description, or a list of individual user reviews with pros, cons, reviewer role, and dates. Capterra has no public API; data must be scraped from product pages. Use a real browser because Capterra is a JavaScript-rendered app."
---

# Capterra — Browsing Skill

Use this index to choose the Capterra action that matches the user request, then open only the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **product-overview** — Extract aggregate product data from a Capterra product page: product name, overall rating (out of 5), total reviews, rating breakdown by category (ease of use, customer service, features, value), short description, and pricing info if shown. Full spec: [references/product-overview.md](references/product-overview.md).
- **product-reviews** — Extract a list of individual user reviews from a Capterra product reviews page, including reviewer name, role, company size, overall rating, review title, pros, cons, and published date. Full spec: [references/product-reviews.md](references/product-reviews.md).

## Notes

- Capterra has no public API. All data is extracted from rendered HTML on product and review pages.
- Product overview pages follow `https://www.capterra.com/p/<id>/<slug>/`; review pages append `/reviews/` to that path.
- Capterra embeds JSON-LD structured data (`application/ld+json`) which is the most reliable source for aggregate ratings when available.
- These actions are read-only. They do not submit reviews, vote, or modify any account data.
