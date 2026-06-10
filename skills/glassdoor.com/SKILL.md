---
name: browsing-glassdoor
description: "Use when the user wants to extract company data from Glassdoor — company overview details (rating, CEO approval, size, industry) or employee reviews with ratings, pros, cons, and reviewer roles. Requires a logged-in Glassdoor session because the site blocks unauthenticated access. Use Chrome Bridge with the user's existing browser session."
---

# Glassdoor — Browsing Skill

Use this index to choose the Glassdoor action that matches the user request, then open only the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **company-overview** — Extract company profile data: overall rating, number of reviews, CEO name and approval percentage, recommend-to-friend percentage, industry, size, founded year, headquarters, and website. Full spec: [references/company-overview.md](references/company-overview.md).
- **company-reviews** — Extract a list of employee reviews from a company reviews page, including per-review star rating, title, date, pros, cons, reviewer role, and helpful count. Full spec: [references/company-reviews.md](references/company-reviews.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| company-overview | TBD | TBD | Planned. |
| company-reviews | TBD | TBD | Planned. |

## Notes

- Both actions require a logged-in Glassdoor session. Use Chrome Bridge so the user's existing browser login is available.
- Glassdoor obfuscates many CSS class names. The code uses `data-test` attributes and `innerText` line parsing as stable fallbacks.
- These actions are read-only. They do not submit reviews, vote, or change account settings.
