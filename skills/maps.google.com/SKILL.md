---
name: browsing-maps-google
description: "Use when the user wants to interact with Google Maps — search for places by query and extract the sidebar list of results (names, ratings, addresses, categories), or extract detailed data from a specific place page (name, address, phone, hours, rating, website). Works on maps.google.com and google.com/maps. No login required for public data; a real browser is needed for full DOM rendering."
---

# Google Maps — Browsing Skill

Use this index to choose the Google Maps action that matches the user request, then open the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **place-search** — Search Google Maps for a query and extract the list of place results from the sidebar: names, ratings, review counts, addresses, categories, and open/closed status. Full spec: [references/place-search.md](references/place-search.md).
- **place-data** — Extract detailed information from a specific Google Maps place page: name, address, phone, website, hours, rating, review count, price level, and category. Full spec: [references/place-data.md](references/place-data.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| place-search | TBD | TBD | Planned. |
| place-data | TBD | TBD | Planned. |
