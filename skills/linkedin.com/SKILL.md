---
name: browsing-linkedin
description: "Use when the user wants to interact with LinkedIn — extract post data (content, author, reactions, comments), scrape a member profile (name, headline, experience, education, skills), search for jobs (title, company, location, Easy Apply flag), or extract a company page (about, industry, size, followers, specialties). Works on linkedin.com. Public posts work without login; profile, job search, and company extraction work best with an li_at session cookie."
---

# LinkedIn — Browsing Skill

Use this index to choose the LinkedIn action that matches the user request, then open the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **post-data** — Extract a LinkedIn post's content, author, reactions, comments, reposts, and canonical metadata. Full spec: [references/post-data.md](references/post-data.md).
- **profile-data** — Extract a LinkedIn profile's name, headline, location, about, experience, education, and skills. Requires `li_at` cookie and a real browser. Full spec: [references/profile-data.md](references/profile-data.md).
- **job-search** — Search LinkedIn jobs and extract listings (title, company, location, date, URL, Easy Apply flag). `li_at` cookie recommended. Full spec: [references/job-search.md](references/job-search.md).
- **company-data** — Extract a LinkedIn company page (name, about, website, industry, size, followers, specialties). `li_at` cookie recommended. Full spec: [references/company-data.md](references/company-data.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| post-data | TBD | TBD | Planned. |
| profile-data | TBD | TBD | Planned. |
| job-search | TBD | TBD | Planned. |
| company-data | TBD | TBD | Planned. |

