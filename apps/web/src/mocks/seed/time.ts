/** ISO timestamp `minutes` before now; seeds read as "3h ago", "yesterday", like the mocks. */
export function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** ISO timestamp `minutes` after now. */
export function ahead(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** A stable UUIDv7-shaped id for seed rows, so the shared schemas accept them. */
export function uid(n: number): string {
  return `018f0000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;
}

let sequence = 0x100000;

/** A fresh UUIDv7-shaped id for rows the mock creates. */
export function newId(): string {
  sequence += 1;
  return uid(sequence);
}
