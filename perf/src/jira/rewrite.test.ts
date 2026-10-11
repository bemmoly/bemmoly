import { describe, expect, it } from 'vitest';
import { generateIssues } from '../../../apps/server/src/imports/generate.ts';
import { IMPORT_KEY, rewriteRequest, rewriteResponse } from './rewrite.ts';

describe('fake Jira rewrite', () => {
  it('renames the project, its issue keys and its people into the harness namespace', () => {
    const body = JSON.stringify({
      projects: [{ id: '10000', key: 'OPS', name: 'Operations' }],
      issues: generateIssues(3),
      myself: { emailAddress: 'rohan@acmelabs.dev', displayName: 'Rohan S.' },
    });
    const out = rewriteResponse(body);
    expect(out).not.toMatch(/\bOPS\b/);
    expect(out).not.toMatch(/@example\.test|@acmelabs\.dev/);
    expect(out).toContain(`"key":"${IMPORT_KEY}"`);
    expect(out).toContain(`"key":"${IMPORT_KEY}-2"`);
    expect(out).toContain('"name":"LOAD Jira import"');
    expect(out).toContain('"emailAddress":"load-jira-rohan@load.bemmoly.test"');
    expect(out).toContain('"displayName":"LOAD Rohan S."');
    const emails = out.match(/"[^"]*@[^"]*"/g) ?? [];
    expect(emails.every((email) => email.endsWith('@load.bemmoly.test"'))).toBe(true);
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it('leaves text that only contains the letters alone', () => {
    expect(rewriteResponse('"summary":"OPSEC review for SHOPS"')).toBe(
      '"summary":"OPSEC review for SHOPS"',
    );
  });

  it('maps the key back in paths, queries and JQL bodies', () => {
    expect(rewriteRequest(`/rest/api/3/project/${IMPORT_KEY}/statuses`)).toBe(
      '/rest/api/3/project/OPS/statuses',
    );
    expect(rewriteRequest(`/rest/api/3/issue/${IMPORT_KEY}-17/comment`)).toBe(
      '/rest/api/3/issue/OPS-17/comment',
    );
    expect(rewriteRequest(`jql=project%20%3D%20%22${IMPORT_KEY}%22`)).toBe(
      'jql=project%20%3D%20%22OPS%22',
    );
    expect(rewriteRequest(`{"jql":"project = \\"${IMPORT_KEY}\\""}`)).toBe(
      '{"jql":"project = \\"OPS\\""}',
    );
  });
});
