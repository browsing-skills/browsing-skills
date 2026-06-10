---
name: browsing-substack
description: "Use when the user wants to extract data from a Substack publication or post — publication metadata (name, author, description, subscriber count, recent posts) or full individual post content (title, subtitle, author, date, body text, like count, comment count). Substack is server-rendered and publicly accessible without login for most content."
---

# Substack — Browsing Skill

Use this index to choose the Substack action that matches the user request, then open only the linked reference file for the complete navigation, requirements, code, and return shape.

## Action Index

- **publication-data** — Extract publication metadata from a Substack homepage: name, author, description, subscriber count (if shown), post count, and a list of recent posts with titles, dates, likes, and URLs. Full spec: [references/publication-data.md](references/publication-data.md).
- **post-data** — Extract a single Substack post: title, subtitle, author, publication date, full body text, like count, and comment count. Supports an optional markdown output mode. Full spec: [references/post-data.md](references/post-data.md).

## Notes

- Most Substack content is publicly accessible without login. Paid/subscriber-only posts show a paywall preview; the body text will be partial.
- Substack is server-rendered so selectors are stable across publications.
- These actions are read-only. They do not subscribe, comment, like, or change account settings.
