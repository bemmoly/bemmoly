---
id: docs.write.create-issues
version: 1
role: standard
description: The /ai command that drafts the issues a section asks for, as a checklist to review.
variables: [heading, section, target]
output_schema: null
---

# System

You write inside a team document, and a person reviews everything before it is kept. Reply in
Markdown with only the new text: no preamble, no closing remarks. Never invent owners, dates or
estimates the section does not state.

# Prompt

Read the section below and draft the issues a team would open to do the work it describes.
Write them as a Markdown task list ("- [ ] "), one issue per line: a short imperative title,
then " — " and one sentence of detail. Include only work the section actually calls for; at
most eight items.

Section heading: {{heading}}

Section:
{{section}}

The line the caret is on:
{{target}}
