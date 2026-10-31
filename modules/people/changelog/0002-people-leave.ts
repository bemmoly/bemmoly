import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Time off. A policy grants days of one kind, everywhere or at one location; a request books
 * working days against it and, when the policy needs approval, points at the approval
 * engine's request. Balances are worked out from the requests, so every number is explained
 * by the rows behind it.
 */
export default changeset({
  id: '0002-people-leave',
  author: 'bemmoly',
  description: 'Create leave policies and leave requests',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE leave_policies (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        kind text NOT NULL CHECK (kind IN ('annual', 'sick', 'parental', 'unpaid', 'other')),
        location_id uuid REFERENCES locations (id) ON DELETE CASCADE,
        allowance_days numeric(5, 1) CHECK (allowance_days >= 0),
        carry_over_days numeric(5, 1) NOT NULL DEFAULT 0 CHECK (carry_over_days >= 0),
        needs_approval boolean NOT NULL DEFAULT true,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX leave_policies_kind_location_key
        ON leave_policies (kind, coalesce(location_id, '00000000-0000-0000-0000-000000000000'))
        WHERE archived_at IS NULL`);
    await ctx.exec(sql`
      CREATE TABLE leave_requests (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        policy_id uuid NOT NULL REFERENCES leave_policies (id) ON DELETE RESTRICT,
        start_date date NOT NULL,
        end_date date NOT NULL,
        half_day boolean NOT NULL DEFAULT false,
        days numeric(5, 1) NOT NULL CHECK (days >= 0),
        note text,
        status text NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
        approval_request_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (start_date <= end_date)
      )`);
    await ctx.exec(sql`
      CREATE INDEX leave_requests_user_dates_idx ON leave_requests (user_id, start_date)`);
    await ctx.exec(sql`
      CREATE INDEX leave_requests_open_dates_idx ON leave_requests (start_date, end_date)
        WHERE status IN ('pending', 'approved')`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX leave_requests_approval_key ON leave_requests (approval_request_id)
        WHERE approval_request_id IS NOT NULL`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE leave_requests`);
    await ctx.exec(sql`DROP TABLE leave_policies`);
  },
});
