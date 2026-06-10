---
name: browsing-craigslist
description: "Use when the user wants to search listings or extract posting details on Craigslist (craigslist.org) — the US classifieds network covering housing, jobs, for-sale items, services, and more. Actions: search listings by city and category, extract full posting details. The site uses stable server-rendered HTML. No authentication required; a browser is recommended but static fetch often works."
---

# Craigslist (craigslist.org) — Browsing Skill

Use this index to choose the Craigslist action that matches the user request, then open the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **listing-search** — Search a Craigslist city site for listings by category and optional query, and extract visible results including title, price, location, URL, date posted, and thumbnail. Full spec: [references/listing-search.md](references/listing-search.md).
- **listing-data** — Extract full details from a specific Craigslist posting, including title, price, posted date, description, attributes, location, and images. Full spec: [references/listing-data.md](references/listing-data.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| listing-search | TBD | TBD | TBD |
| listing-data | TBD | TBD | TBD |
