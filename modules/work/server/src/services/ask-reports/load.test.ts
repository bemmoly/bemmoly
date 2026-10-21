import { describe, expect, it } from 'vitest';
import { fakeSql } from '../test-support.ts';
import { loadGroupValues, loadReportIssues } from './load.ts';

/* The SQL a spec produces: fixed text per option, every value the spec carries bound. */

const PROJECT = '0199c0de-0000-7000-8000-0000000000aa';
const ME = '0199c0de-0000-7000-8000-000000000001';

describe('report reads', () => {
  it('maps rows to issues', async () => {
    const sql = fakeSql([
      [
        {
          id: 'i1',
          estimate: '3.00',
          created_at: new Date('2026-10-01T00:00:00Z'),
          resolved_at: new Date('2026-10-03T00:00:00Z'),
          category: 'done',
        },
      ],
    ]);
    const issues = await loadReportIssues(sql.client, PROJECT, {}, ME);
    expect(issues).toEqual([
      {
        id: 'i1',
        estimate: 3,
        createdAt: Date.parse('2026-10-01T00:00:00Z'),
        resolvedAt: Date.parse('2026-10-03T00:00:00Z'),
        done: true,
      },
    ]);
  });

  it('adds one fixed fragment per filter and binds every value', async () => {
    const sql = fakeSql([[]]);
    await loadReportIssues(
      sql.client,
      PROJECT,
      {
        status: 'open',
        sprint: 'active',
        assignee: 'me',
        types: ["Bug'; drop table issues; --"],
        priorities: ['high'],
        createdWithinDays: 30,
      },
      ME,
    );
    const [statement = ''] = sql.statements;
    expect(statement).toContain("s.category <> 'done'");
    expect(statement).toContain("state = 'active'");
    expect(statement).toContain('a.user_id = ?');
    expect(statement).toContain('lower(name) = any(?)');
    expect(statement).toContain('i.priority = any(?)');
    expect(statement).toContain('make_interval(days => ?)');
    expect(statement).not.toContain('drop table');
  });

  it('reads sprints for the sprint grouping and nothing for none', async () => {
    const sql = fakeSql([[{ issue_id: 'i1', id: 's1', name: 'Sprint 14', state: 'active' }]]);
    const values = await loadGroupValues(sql.client, PROJECT, 'sprint');
    expect(values.get('i1')).toEqual([{ id: 's1', label: 'Sprint 14', order: 0 }]);
    expect((await loadGroupValues(sql.client, PROJECT, 'none')).size).toBe(0);
    expect(sql.statements).toHaveLength(1);
  });
});
