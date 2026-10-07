/**
 * Keyset cursors are the last row's UUIDv7 id, base64url encoded so clients
 * treat them as opaque. Ids are time ordered, so id order is creation order.
 */
export function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the id a cursor points at, or null when it is not one of ours. */
export function decodeCursor(cursor: string | undefined): string | null {
  if (!cursor) return null;
  const id = Buffer.from(cursor, 'base64url').toString('utf8');
  return UUID.test(id) ? id : null;
}

/** Fetch limit + 1 rows; this trims the extra one and computes the next cursor. */
export function toPage<Row extends { id: string }>(
  rows: Row[],
  limit: number,
): { rows: Row[]; nextCursor: string | null } {
  if (rows.length <= limit) return { rows, nextCursor: null };
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return { rows: page, nextCursor: last ? encodeCursor(last.id) : null };
}
