# ADR 0050: The person record and org data live in the kernel

- Status: accepted
- Date: 2026-10-22
- Changes: the identity model in the tech design, which knows users, roles and teams but not
  employment; adds a kernel capability, `workspace.people.manage`
- Evidence: the suite proposal (`docs/proposals/suite/people.html`): every product reads one
  record of who someone is, who they report to, where they work and which cost centre pays

## Context

Bemmoly is becoming a suite. Approvals route to a manager, expenses charge a cost centre,
time off follows a location's holiday calendar, IT provisions on a start date. If each product
keeps its own copy, we rebuild the problem People exists to solve. The kernel already owns the
user (identity) and teams; employment is the missing half.

## Decision

1. **One person row per user, keyed by the user id.** `people.user_id` is the primary key and
   references `users`. Every product already holds user ids, so nothing maps between two ids.
   A user without a row is simply not an employee (a contractor guest, a service account).
2. **Employment state is a small closed set**: `offer_accepted`, `active`, `on_leave`,
   `leaving`, `left`, with allowed transitions enforced in the service (a rehire goes from
   `left` back to `offer_accepted` or `active`). Dates are plain `date` columns
   (`start_date`, `end_date`): employment is a calendar fact, not an instant.
3. **The record carries**: job title, level (free text, so each company's ladder fits), manager
   (another person), primary team, location and cost centre. History is the audit log for now;
   effective-dated changes are a later decision.
4. **Org entities**: `locations` (name, IANA timezone, country code, a holiday calendar
   reference that the time-off product resolves) and `cost_centres` (code, name, owner).
   **Teams are the existing `teams`**: SSO groups and SCIM already map onto them, so a
   department is a team. A team hierarchy waits for a product that needs it.
5. **Manager cycles are refused** when written; the manager chain walks with a recursive query
   and a depth cap.
6. **Reads are open, writes are not.** Anyone signed in reads the directory (it is the org
   chart). Creating and changing records, locations and cost centres needs
   `workspace.people.manage`, org admins only by default; every write is audited.
7. **Other products read through `PersonDirectory`** (`contracts/people.ts`) and react to four
   events on the kernel bus, published inside the writing transaction: `person.joined`
   (became `active` from `offer_accepted` or on create), `person.changed` (manager, team,
   location, cost centre, title or level, with before and after), `person.leaving` (an end
   date is set and the state is `leaving`) and `person.left`.

## Consequences

- Compensation, personal and country-specific fields stay out of this table; the custom
  fields work adds them with their own visibility rules.
- Deleting a user deletes the person row; deactivation (the normal path) keeps it.
- A later minor can add effective dating or a team hierarchy without changing the contract's
  read shape.
