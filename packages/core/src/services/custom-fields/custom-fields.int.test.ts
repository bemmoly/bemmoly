import {
  CUSTOM_FORM_SUBMITTED_EVENT,
  ForbiddenError,
  ValidationError,
  type CreateCustomFieldBody,
} from '@bemmoly/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSqlClient, type SqlClient } from '../../clients/postgres.ts';
import type { AuditEntry } from '../../contracts/audit.ts';
import type { DomainEvent } from '../../contracts/event-bus.ts';
import { fakeAuthorize, userActor } from '../../testing/fakes.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../../testing/isolated-database.ts';
import { applyKernelChangelog } from '../../testing/kernel-changelog.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { createCustomFieldsService, type CustomFieldsService } from './index.ts';

const scope = { moduleId: 'helpdesk', entityType: 'ticket' };
const options = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'phone', label: 'Phone' },
];
const id = (n: number) => `0199c7a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

describe('custom fields and forms against Postgres', () => {
  let server: TestDatabase;
  let database: IsolatedDatabase | undefined;
  let sql: SqlClient;
  let fields: CustomFieldsService;
  let admin: ReturnType<typeof userActor>;
  let member: ReturnType<typeof userActor>;
  let audit: AuditEntry[];
  let events: DomainEvent[];

  beforeAll(async () => {
    server = await startTestDatabase();
    if (!server.available) return;
    database = await createIsolatedDatabase(server.url);
    sql = createSqlClient(database.url);
    await applyKernelChangelog(sql);
    const user = async (email: string, role: string) => {
      const [row] = await sql<{ id: string }[]>`
        insert into users (email, name, role_id)
        select ${email}, ${email}, id from roles where key = ${role} returning id`;
      return userActor(row!.id);
    };
    admin = await user('admin@example.com', 'org_admin');
    member = await user('member@example.com', 'member');
  }, 180_000);
  afterAll(async () => {
    if (!server.available) return;
    await sql.end({ timeout: 5 });
    await database?.drop();
    await server.stop();
  });
  beforeEach(async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    await sql`truncate custom_field_definitions, custom_forms cascade`;
    audit = [];
    events = [];
    fields = createCustomFieldsService({
      sql,
      authorize: fakeAuthorize([admin.id]),
      audit: { record: async (entry) => void audit.push(entry) },
      events: {
        publish: async (event) => void events.push(event),
        subscribe: () => () => undefined,
      },
    });
  });

  const define = (
    body: Partial<CreateCustomFieldBody> & Pick<CreateCustomFieldBody, 'key' | 'kind'>,
  ) => fields.createField(admin, { ...scope, label: body.key, ...body });

  it('lets only settings managers define fields, audits them, and refuses a duplicate key', async () => {
    await expect(define({ key: 'cost', kind: 'money' }).then(() => null)).resolves.toBeNull();
    await expect(
      fields.createField(member, { ...scope, key: 'x', label: 'X', kind: 'text' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(define({ key: 'cost', kind: 'text' })).rejects.toThrow(/already exists/);
    expect(audit.map((entry) => entry.action)).toEqual(['custom_field.created']);
    await expect(define({ key: 'n', kind: 'number', defaultValue: 'x' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('writes, reads, clears and fills defaults with typed values', async () => {
    await define({ key: 'device', kind: 'select', options, required: true });
    await define({ key: 'cost', kind: 'money' });
    await define({ key: 'urgent', kind: 'boolean', defaultValue: false });
    await expect(fields.writeValues(member, scope, id(1), {}, { mode: 'create' })).rejects.toThrow(
      /device is required/,
    );
    const stored = await fields.writeValues(
      member,
      scope,
      id(1),
      { device: 'phone', cost: { amountMinor: 4999, currency: 'EUR' } },
      { mode: 'create' },
    );
    expect(stored).toEqual({
      device: 'phone',
      cost: { amountMinor: 4999, currency: 'EUR' },
      urgent: false,
    });
    await fields.writeValues(member, scope, id(1), { cost: null }, { mode: 'update' });
    const read = await fields.readValues(member, scope, [id(1), id(2)]);
    expect(read.get(id(1))).toEqual({ device: 'phone', urgent: false });
    expect(read.get(id(2))).toEqual({});
  });

  it('hides fields by role on read and refuses writes the role may not make', async () => {
    await define({
      key: 'salary',
      kind: 'number',
      visibleTo: ['org_admin'],
      editableBy: ['org_admin'],
    });
    await fields.writeValues(admin, scope, id(1), { salary: 100 }, { mode: 'update' });
    expect((await fields.readValues(member, scope, [id(1)])).get(id(1))).toEqual({});
    expect((await fields.readValues(admin, scope, [id(1)])).get(id(1))).toEqual({ salary: 100 });
    await expect(
      fields.writeValues(member, scope, id(1), { salary: 1 }, { mode: 'update' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      fields.compileQuery(
        member,
        scope,
        { filters: [{ field: 'salary', operator: 'gt', value: 1 }] },
        sql`x`,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('filters and sorts entities through the shadow columns', async () => {
    await sql`create table if not exists test_tickets (id uuid primary key)`;
    await define({ key: 'cost', kind: 'number' });
    await define({ key: 'tags', kind: 'multi_select', options });
    await define({ key: 'title', kind: 'text' });
    const rows: [number, number | null, string[], string][] = [
      [1, 30, ['laptop'], 'Broken 100% screen'],
      [2, 10, ['phone', 'laptop'], 'New phone'],
      [3, null, [], 'Nothing yet'],
    ];
    for (const [n, cost, tags, title] of rows) {
      await sql`insert into test_tickets values (${id(n)})`;
      await fields.writeValues(admin, scope, id(n), { cost, tags, title }, { mode: 'update' });
    }
    const list = async (query: Parameters<CustomFieldsService['compileQuery']>[2]) => {
      const { where, orderBy } = await fields.compileQuery(admin, scope, query, sql`t.id`);
      const found = await sql<{ id: string }[]>`
        select t.id from test_tickets t where ${where} order by ${orderBy}, t.id`;
      return found.map((row) => rows.findIndex(([n]) => id(n) === row.id) + 1);
    };
    expect(await list({ sort: [{ field: 'cost', direction: 'asc' }] })).toEqual([2, 1, 3]);
    expect(await list({ sort: [{ field: 'cost', direction: 'desc' }] })).toEqual([1, 2, 3]);
    expect(await list({ filters: [{ field: 'cost', operator: 'gte', value: 20 }] })).toEqual([1]);
    expect(await list({ filters: [{ field: 'cost', operator: 'is_empty' }] })).toEqual([3]);
    expect(await list({ filters: [{ field: 'tags', operator: 'in', value: ['phone'] }] })).toEqual([
      2,
    ]);
    expect(
      await list({ filters: [{ field: 'title', operator: 'contains', value: '100%' }] }),
    ).toEqual([1]);
    expect(await list({})).toEqual([1, 2, 3]);
    await sql`drop table test_tickets`;
  });

  it('refuses a submission without an entity that sets a field the role may not edit', async () => {
    await define({ key: 'budget', kind: 'number', editableBy: ['org_admin'] });
    await fields.createForm(admin, {
      ...scope,
      key: 'budget_request',
      title: 'Budget',
      sections: [{ id: 'main', items: [{ field: 'budget' }] }],
    });
    await expect(
      fields.submitForm(member, 'helpdesk', 'budget_request', { values: { budget: 5 } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(events).toEqual([]);
  });

  it('submits a form: validates shown fields only, stores, writes and publishes', async () => {
    await define({ key: 'device', kind: 'select', options, required: true });
    await define({ key: 'model', kind: 'text', required: true });
    await define({ key: 'carrier', kind: 'text', required: true });
    await fields.createForm(admin, {
      ...scope,
      key: 'equipment',
      title: 'Request equipment',
      sections: [
        {
          id: 'main',
          items: [
            { field: 'device' },
            { field: 'model', when: [{ field: 'device', operator: 'equals', value: 'laptop' }] },
            { field: 'carrier', when: [{ field: 'device', operator: 'equals', value: 'phone' }] },
          ],
        },
      ],
    });
    await expect(
      fields.submitForm(member, 'helpdesk', 'equipment', { values: { device: 'laptop' } }),
    ).rejects.toThrow(/model is required/);
    const submission = await fields.submitForm(member, 'helpdesk', 'equipment', {
      values: { device: 'laptop', model: 'X1', carrier: 'ignored while hidden' },
      entityId: id(7),
    });
    expect(submission.values).toEqual({ device: 'laptop', model: 'X1' });
    expect((await fields.readValues(member, scope, [id(7)])).get(id(7))).toEqual({
      device: 'laptop',
      model: 'X1',
    });
    expect(events).toEqual([
      expect.objectContaining({
        kind: CUSTOM_FORM_SUBMITTED_EVENT,
        payload: expect.objectContaining({ formKey: 'equipment', entityId: id(7) }),
        transaction: expect.anything(),
      }),
    ]);
    await expect(
      fields.createForm(admin, {
        ...scope,
        key: 'bad',
        title: 'Bad',
        sections: [{ id: 'a', items: [{ field: 'nope' }] }],
      }),
    ).rejects.toThrow(/do not exist: nope/);
  });
});
