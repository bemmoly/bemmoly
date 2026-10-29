import { describe, expect, it } from 'vitest';
import { databaseHosts, resetRefusal } from './reset.ts';

/* --reset truncates tables, so it is refused against a database that is not on this machine. */

describe('the reset guard', () => {
  it.each([
    'postgres://bemmoly:secret@localhost:5432/bemmoly_db',
    'postgres://bemmoly@127.0.0.1/bemmoly_db',
    'postgresql://bemmoly@[::1]:55432/bemmoly_db',
    'postgres://bemmoly@%2Fvar%2Frun%2Fpostgresql/bemmoly_db',
    'postgres://bemmoly@/bemmoly_db?host=/tmp',
    'postgres:///bemmoly_db',
  ])('lets %s reset', (url) => {
    expect(resetRefusal(url, false)).toBeNull();
  });

  it('refuses a remote database, naming the host and the flag', () => {
    const refusal = resetRefusal(
      'postgres://bemmoly:secret@db.acme.example:5432/bemmoly_db',
      false,
    );
    expect(refusal).toContain('db.acme.example');
    expect(refusal).toContain('--force');
    expect(refusal).not.toContain('secret');
  });

  it('reads every host libpq would try, and the host parameter over the authority', () => {
    expect(databaseHosts('postgres://u@localhost:5432,db.acme.example:5432/x')).toEqual([
      'localhost',
      'db.acme.example',
    ]);
    expect(resetRefusal('postgres://u@localhost,db.acme.example/x', false)).toContain(
      'db.acme.example',
    );
    expect(databaseHosts('postgres://u@localhost/x?host=db.acme.example')).toEqual([
      'db.acme.example',
    ]);
  });

  it('runs against any database with --force', () => {
    expect(resetRefusal('postgres://u@db.acme.example/x', true)).toBeNull();
  });
});
