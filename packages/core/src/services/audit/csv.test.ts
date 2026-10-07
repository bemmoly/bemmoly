import type { AuditEntry } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { auditCsvHeader, auditCsvRow, csvCell } from './csv.ts';
import { redactSecrets } from './record.ts';

describe('audit CSV', () => {
  it('quotes separators and neutralises spreadsheet formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell(null)).toBe('');
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });

  it('writes one CRLF line per entry in header order', () => {
    const entry: AuditEntry = {
      id: '01900000-0000-7000-8000-000000000001',
      actorId: 'u1',
      actorKind: 'user',
      actorUserId: null,
      action: 'team.created',
      targetKind: 'team',
      targetId: 't1',
      before: null,
      after: { name: 'Platform' },
      ip: '127.0.0.1',
      requestId: 'r1',
      aiPlanId: null,
      createdAt: '2026-10-07T00:00:00.000Z',
    };
    expect(auditCsvHeader()).toBe(
      'id,createdAt,actorKind,actorId,actorUserId,action,targetKind,targetId,ip,requestId,aiPlanId,before,after\r\n',
    );
    expect(auditCsvRow(entry)).toBe(
      '01900000-0000-7000-8000-000000000001,2026-10-07T00:00:00.000Z,user,u1,,team.created,team,t1,127.0.0.1,r1,,,"{""name"":""Platform""}"\r\n',
    );
  });
});

describe('redactSecrets', () => {
  it('drops secret-looking keys at any depth and keeps the rest', () => {
    expect(
      redactSecrets({
        name: 'x',
        password: 'p',
        passwordHash: 'h',
        nested: { tokenHash: 't', token: 'raw', keep: [{ secret: 1, ok: 2 }] },
        at: new Date('2026-01-01T00:00:00Z'),
      }),
    ).toEqual({ name: 'x', nested: { keep: [{ ok: 2 }] }, at: '2026-01-01T00:00:00.000Z' });
  });
});
