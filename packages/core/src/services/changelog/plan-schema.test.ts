import { describe, expect, it } from 'vitest';
import { createPlannedSchema, splitTopLevel } from './plan-schema.ts';

describe('createPlannedSchema', () => {
  it('knows nothing about objects the plan does not touch', () => {
    const schema = createPlannedSchema();
    expect(schema.answer({ tableExists: { table: 'users' } })).toBeUndefined();
    expect(schema.answer({ columnExists: { table: 'users', column: 'email' } })).toBeUndefined();
    expect(schema.answer({ indexExists: { index: 'users_email_key' } })).toBeUndefined();
    expect(schema.answer({ rowCount: { table: 'users', expected: 0 } })).toBeUndefined();
  });

  it('answers existence checks from the DDL earlier changesets would run', () => {
    const schema = createPlannedSchema();
    schema.record(`CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  "displayName" text,
  status text NOT NULL
    CONSTRAINT users_status_check CHECK (status IN ('active', 'invited')),
  UNIQUE (id, status)
);`);
    schema.record('CREATE UNIQUE INDEX users_email_key ON users (lower(email));');
    expect(schema.answer({ tableExists: { table: 'users' } })).toBe(true);
    expect(schema.answer({ tableExists: { table: 'public.users' } })).toBe(true);
    expect(schema.answer({ columnExists: { table: 'users', column: 'displayName' } })).toBe(true);
    expect(schema.answer({ columnExists: { table: 'users', column: 'status' } })).toBe(true);
    expect(schema.answer({ columnExists: { table: 'users', column: 'unique' } })).toBe(false);
    expect(schema.answer({ indexExists: { index: 'users_email_key', table: 'users' } })).toBe(true);
    expect(schema.answer({ indexExists: { index: 'users_email_key', table: 'teams' } })).toBe(
      false,
    );
    expect(schema.answer({ not: { tableExists: { table: 'users' } } })).toBe(false);
  });

  it('follows alters and drops, including several statements in one exec', () => {
    const schema = createPlannedSchema();
    schema.record(
      'create table if not exists things (id uuid primary key); ' +
        'alter table things add column if not exists label text, drop column id;\n' +
        '-- params: []',
    );
    expect(schema.answer({ columnExists: { table: 'things', column: 'label' } })).toBe(true);
    expect(schema.answer({ columnExists: { table: 'things', column: 'id' } })).toBe(false);
    schema.record('create index things_label_idx on things (label);');
    schema.record('drop table if exists things cascade;');
    expect(schema.answer({ tableExists: { table: 'things' } })).toBe(false);
    expect(schema.answer({ columnExists: { table: 'things', column: 'label' } })).toBe(false);
    expect(schema.answer({ indexExists: { index: 'things_label_idx' } })).toBe(false);
    schema.record('alter table legacy rename to current_items;');
    expect(schema.answer({ tableExists: { table: 'legacy' } })).toBe(false);
    expect(schema.answer({ tableExists: { table: 'current_items' } })).toBe(true);
    expect(schema.answer({ columnExists: { table: 'current_items', column: 'x' } })).toBe(
      undefined,
    );
  });

  it('ignores semicolons inside function bodies and string literals', () => {
    const text = `create function f() returns trigger as $fn$ begin raise 'a; b'; end $fn$ language plpgsql;
select ';' as x`;
    expect(splitTopLevel(text, ';')).toHaveLength(2);
    const schema = createPlannedSchema();
    schema.record(text);
    expect(schema.answer({ tableExists: { table: 'f' } })).toBeUndefined();
  });
});
