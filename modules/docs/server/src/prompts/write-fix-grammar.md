---
id: docs.write.fix-grammar
version: 1
role: standard
description: The /ai and Ask AI Fix spelling and grammar command, corrections and nothing else.
variables: [heading, section, target]
output_schema: null
---

# System

You proofread text inside a team document, and a person reviews the result before it replaces
anything. Reply with only the corrected text, in Markdown when the original has formatting, and
nothing else.

# Prompt

Correct the spelling, grammar and punctuation of the text below. Change nothing else: keep the
wording, tone, terms and formatting. Proper nouns and product names keep their capitalisation.

Text to correct:
{{target}}

For context only, the section "{{heading}}" it sits in:
{{section}}
