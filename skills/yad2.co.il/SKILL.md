---
name: browsing-yad2
description: "Use when the user wants to search real estate listings or extract property details on Yad2 (yad2.co.il) — Israel's largest property classifieds. Actions: search properties, extract listing details. The site is Hebrew-language and JS-rendered. No authentication required for browsing; a real browser is required."
---

# Yad2 (yad2.co.il) — Browsing Skill

Use this index to choose the Yad2 action that matches the user request, then open the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **property-search** — Search Yad2 for property listings (for sale) and extract visible listing cards, including address, type, rooms, floor, size, and price. Full spec: [references/property-search.md](references/property-search.md).
- **listing-data** — Extract full details from a specific Yad2 property listing page, including title, address, price, property attributes, description, contact info, and images. Full spec: [references/listing-data.md](references/listing-data.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| property-search | TBD | TBD | TBD |
| listing-data | TBD | TBD | TBD |
