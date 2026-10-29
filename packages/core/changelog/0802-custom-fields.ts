import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Custom fields and forms any module can use (ADR 0052). Definitions are scoped to
 * (module, entity type). Values are one row per field and entity: the canonical value as
 * JSONB plus one typed shadow column per kind family, indexed with the field id, so a
 * module's filtered and sorted list stays an indexed query. entity_id has no foreign key:
 * the entity lives in a module's table, and the module removes its values when it deletes one.
 */
export default changeset({
  id: '0802-custom-fields',
  author: 'bemmoly',
  description: 'Add custom field definitions and values, custom forms and their submissions',
  preconditions: [
    {
      tableExists: { table: 'users' },
      onFail: 'halt',
      reason: 'definitions and submissions name the person who made them',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`
      create table custom_field_definitions (
        id uuid primary key default uuidv7(),
        module_id text not null check (module_id ~ '^[a-z][a-z0-9-]{1,31}$'),
        entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]{0,39}$'),
        key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
        label text not null check (char_length(label) between 1 and 60),
        description text,
        kind text not null constraint custom_field_definitions_kind_check check (kind in (
          'text', 'long_text', 'number', 'money', 'date', 'select', 'multi_select', 'person',
          'boolean', 'file')),
        required boolean not null default false,
        options jsonb not null default '[]'::jsonb,
        validation jsonb not null default '{}'::jsonb,
        default_value jsonb,
        visible_to text[] not null default '{}',
        editable_by text[] not null default '{}',
        position integer not null default 0,
        archived_at timestamptz,
        created_by uuid references users (id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index custom_field_definitions_scope_key
        on custom_field_definitions (module_id, entity_type, key)`);
    await ctx.exec(sql`
      create table custom_field_values (
        id uuid primary key default uuidv7(),
        field_id uuid not null references custom_field_definitions (id) on delete cascade,
        entity_id uuid not null,
        value jsonb not null,
        value_text text,
        value_number numeric,
        value_date date,
        value_bool boolean,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index custom_field_values_field_entity_key
        on custom_field_values (field_id, entity_id)`);
    await ctx.exec(sql`
      create index custom_field_values_entity_idx on custom_field_values (entity_id)`);
    await ctx.exec(sql`
      create index custom_field_values_text_idx on custom_field_values (field_id, value_text)
        where value_text is not null`);
    await ctx.exec(sql`
      create index custom_field_values_number_idx on custom_field_values (field_id, value_number)
        where value_number is not null`);
    await ctx.exec(sql`
      create index custom_field_values_date_idx on custom_field_values (field_id, value_date)
        where value_date is not null`);
    await ctx.exec(sql`
      create index custom_field_values_value_idx on custom_field_values
        using gin (value jsonb_path_ops)`);
    await ctx.exec(sql`
      create table custom_forms (
        id uuid primary key default uuidv7(),
        module_id text not null check (module_id ~ '^[a-z][a-z0-9-]{1,31}$'),
        entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]{0,39}$'),
        key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
        title text not null check (char_length(title) between 1 and 80),
        description text not null default '',
        sections jsonb not null,
        archived_at timestamptz,
        created_by uuid references users (id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index custom_forms_module_key_key on custom_forms (module_id, key)`);
    await ctx.exec(sql`
      create table custom_form_submissions (
        id uuid primary key default uuidv7(),
        form_id uuid not null references custom_forms (id) on delete cascade,
        entity_id uuid,
        submitted_by uuid references users (id) on delete set null,
        values jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create index custom_form_submissions_form_idx
        on custom_form_submissions (form_id, created_at desc)`);
    await ctx.exec(sql`
      create index custom_form_submissions_entity_idx on custom_form_submissions (entity_id)
        where entity_id is not null`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table custom_form_submissions`);
    await ctx.exec(sql`drop table custom_forms`);
    await ctx.exec(sql`drop table custom_field_values`);
    await ctx.exec(sql`drop table custom_field_definitions`);
  },
});
