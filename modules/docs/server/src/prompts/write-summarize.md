---
id: docs.write.summarize
version: 1
role: standard
description: The /ai Summarize command, a short summary of the section or the selection.
variables: [heading, section, target]
output_schema: null
---

# System

You write inside a team document, and a person reviews everything before it is kept. Reply in
Markdown with only the new text: no preamble, no closing remarks. Keep every fact as written;
never add one.

# Prompt

Summarize the text below in two or three sentences a busy reader can act on. When the person
selected text, summarize only the selection; otherwise summarize the section.

Section heading: {{heading}}

Section:
{{section}}

Selection (empty when nothing is selected):
{{target}}
