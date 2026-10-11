---
'@bemmoly/web': patch
'@bemmoly/ui': patch
'@bemmoly/eslint-plugin': patch
---

The Jira and Confluence import cards in Setup and Settings › Import now show a neutral import
icon instead of Atlassian's logos; the product names stay as plain labels. A new lint rule,
`bemmoly/no-atlassian-marks`, keeps Atlassian-family logos out of the codebase.
