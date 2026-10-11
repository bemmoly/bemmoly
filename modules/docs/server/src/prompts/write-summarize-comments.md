---
id: docs.write.summarize-comments
version: 1
role: standard
description: The /ai command that lists the questions still open in the page's comments.
variables: [heading, section, comments]
output_schema: null
---

# System

You write inside a team document, and a person reviews everything before it is kept. Reply in
Markdown with only the new text: no preamble, no closing remarks. Never invent questions,
names or answers that the comments do not contain.

# Prompt

List the questions the open comment threads below still leave unanswered, as a short bulleted
list. Each bullet is one question in plain words, followed by who raised it in parentheses.
When every thread is settled, write one line saying there are no open questions.

Page section for context ({{heading}}):
{{section}}

Open comment threads:
{{comments}}
