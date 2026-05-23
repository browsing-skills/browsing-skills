---
name: browsing-zillow
description: "Use when the user wants to search real estate listings or extract property details on Zillow (zillow.com) — the largest US property marketplace. Actions: search properties by city, extract full listing details. The site is JS-rendered. No authentication required for browsing; a real browser is required."
---

# Zillow (zillow.com) — Browsing Skill

Use this index to choose the Zillow action that matches the user request, then open the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **property-search** — Search Zillow for property listings in a city and extract visible listing cards, including address, price, beds, baths, sqft, listing URL, thumbnail, days on market, and property type. Full spec: [references/property-search.md](references/property-search.md).
- **listing-data** — Extract full details from a specific Zillow property listing page, including address, price, beds, baths, sqft, lot size, year built, property type, description, Zestimate, HOA fees, days on market, agent name, open house dates, and facts & features. Full spec: [references/listing-data.md](references/listing-data.md).

## Benchmarks

Benchmarks compare the maintained skill action against a no-skill browser agent that inspects the live page DOM and derives selectors at runtime. Full notes live in [BENCHMARKS.md](../../BENCHMARKS.md).

| Action | With Skill | Without Skill | Notes |
|---|---:|---:|---|
| property-search | TBD | TBD | TBD |
| listing-data | TBD | TBD | TBD |
