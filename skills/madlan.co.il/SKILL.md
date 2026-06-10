---
name: browsing-madlan
description: "Use when the user wants to search real estate listings or extract property details on Madlan (madlan.co.il) — Israel's leading property portal. Actions: search properties by city, extract full listing details. The site is Hebrew-language, RTL, and JS-rendered. No authentication required for browsing; a real browser is required."
---

# Madlan (madlan.co.il) — Browsing Skill

Use this index to choose the Madlan action that matches the user request, then open the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **property-search** — Search Madlan for property listings for sale in a city and extract visible listing cards, including address/neighborhood, price, rooms, floor, size (sqm), and listing URL. Full spec: [references/property-search.md](references/property-search.md).
- **listing-data** — Extract full details from a specific Madlan property listing page, including address, price, rooms, floor, total floors, size, property type, description, amenities, and agent name. Full spec: [references/listing-data.md](references/listing-data.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| property-search | TBD | TBD | TBD |
| listing-data | TBD | TBD | TBD |
