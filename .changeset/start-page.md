---
'@bemmoly/core': minor
'@bemmoly/core-web': minor
'@bemmoly/web': minor
'@bemmoly/module-work': minor
'@bemmoly/module-docs': minor
'@bemmoly/pipelines-web': minor
---

A start page now opens after sign-in (/start). It lists the products you can use with what is
waiting for you in each, a "Needs you" list (Work issues due within a week, Docs reviews and
pages due for a refresh), your recent items and one question box that hands your words to the
command palette, where AI answers or plans when it is on. A grid button beside Search in the
sidebar, and in the Pipelines top bar, switches between products and back to the start page.
Modules contribute their part through `ctx.start.add({ summaryForUser })`, served at
GET /api/v1/start-summaries. No schema or configuration change.
