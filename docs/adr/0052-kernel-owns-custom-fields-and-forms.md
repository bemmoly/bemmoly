# ADR 0052: The kernel owns typed custom fields and forms

- Status: accepted
- Date: 2026-10-22
- Changes: adds a kernel service (`packages/core/src/services/custom-fields`), its contract in
  `@bemmoly/shared` (`schemas/custom-fields`), four kernel tables (changeset
  `0802-custom-fields`) and two shared components (`CustomFieldControl`, `FormSections`) to the
  design system
- Evidence: the business suite proposal ("Make it yours": People, Helpdesk, Expenses each
  need company-defined fields and forms); Work's own `fields`, `issue_type_fields` and
  `issues.custom_fields`, which solve the same problem for one module only

## Context

Every suite module needs fields the company defines (a cost centre on an expense, a laptop
model on a person, a severity on a ticket) and forms that collect them (a leave request, an
equipment request). Built per module, each would repeat Work's design: its own definitions
table, its own value validation, its own filter compiler and its own form renderer, each a
little different. Modules may not import each other (AGENTS.md §2), so the only place to
share it is the kernel.

## Decision

1. **Definitions are scoped to (module, entity type).** `custom_field_definitions` holds a
   `module_id`, an `entity_type` (`person`, `ticket`, `expense`), a stable `key`, a label and
   one of ten kinds: `text`, `long_text`, `number`, `money`, `date`, `select`,
   `multi_select`, `person`, `boolean`, `file`. A definition carries `required`, a default,
   validation (length, range, pattern, decimals, currency, item count), select options, and
   two role lists: `visible_to` and `editable_by` (workspace role keys; empty means everyone).
   Managing definitions needs `workspace.settings.manage` and is audited.
2. **Values are one row per (field, entity) with typed shadow columns.** The kernel cannot add
   columns to a module's tables, so `custom_field_values` stores the canonical value as JSONB
   plus `value_text`, `value_number`, `value_date` and `value_bool`, each indexed with the
   field id. Filters and sorts compile to parameterised SQL over those columns
   (`fieldPredicate`, `fieldOrder`) that a module embeds against its own entity id column,
   so a filtered, sorted list stays one indexed query.
3. **One validation function, shared by server and browser.** `valueSchemaFor(definition)`
   and `validateFieldValues` live in `@bemmoly/shared`; the service and the form hook call the
   same code, so a form never accepts what the server would refuse.
4. **The service trusts the module for entity access and enforces fields itself.** A module
   authorizes the entity (can this person see this expense?) and then calls
   `readValues`/`writeValues`; the kernel drops fields the actor's role may not see and refuses
   writes to fields it may not edit. `writeValues` takes the module's transaction.
5. **Forms are definitions plus layout.** `custom_forms` holds sections, each listing field
   keys, with an optional condition on a section or a field (`equals`, `not_equals`, `in`,
   `is_set`, `is_empty`, all of a list). `visibleFieldKeys(form, values)` is shared: hidden
   fields are neither required nor stored. `submitForm` validates, stores a row in
   `custom_form_submissions`, writes the values onto the entity when one is given, and
   publishes `custom_form.submitted` in the same transaction. The approval engine subscribes
   to that event; this ADR does not decide approvals.
6. **Two components, no new visuals.** `@bemmoly/ui` gains `CustomFieldControl` (one control
   per kind, built from `Input`, `Textarea`, `Select`, `Checkbox` inside `Field`) and
   `FormSections` (sections on `FormGrid`). `@bemmoly/core-web` gains `CustomForm` and
   `useCustomForm`, which bind them to definitions and the shared validator. Person and file
   pickers take an async `LoadOptions`, so the page decides where people and files come from.

## Work migrates later, not now

Work keeps `fields`, `issue_type_fields` and `issues.custom_fields` for 0.x. Its kinds map
one to one except three: `richtext` and `doc` become `long_text` and a future `doc` kind,
`datetime` is added when Work moves, and `user` is `person`. The migration is a Work changeset
that copies each project field into `custom_field_definitions` (module `work`, entity type
`issue`, with the project id folded into the key or, if needed then, a `scope_id` column added
here) and each `issues.custom_fields` entry into `custom_field_values`; LQL's
`services/lql/custom.ts` then compiles through `fieldPredicate`. Until then the two stores do
not share rows.

## Consequences

- A module adds custom fields with no schema change of its own: one `entity_type` string.
- Row-per-value costs a join per filtered field; the shadow-column indexes keep it cheap, and
  `readValues` loads a page of entities in one query.
- `money` is stored as integer minor units with an ISO currency, so sums never round.
- No HTTP routes ship in this change. Each module exposes its fields through its own
  controllers until a settings screen for definitions is designed.
- Modules reach the service as `ctx.customFields`, pinned to their own module id: they list
  and define fields of their entity types and read and write values; the kernel's role rules
  and `workspace.settings.manage` apply unchanged.
