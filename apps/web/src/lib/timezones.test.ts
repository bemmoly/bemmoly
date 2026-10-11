import { describe, expect, it } from 'vitest';
import { TIMEZONES, timezoneOptions } from './timezones.ts';

/** What the Select's search does: a case-insensitive match on label or description. */
function find(query: string): string[] {
  const q = query.toLowerCase();
  return timezoneOptions()
    .filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q))
    .map((o) => o.value);
}

describe('timezones', () => {
  it('lists current IANA names, not the old spellings', () => {
    expect(TIMEZONES[0]).toBe('UTC');
    expect(TIMEZONES).toContain('Asia/Kolkata');
    expect(TIMEZONES).toContain('Europe/Kyiv');
    expect(TIMEZONES).not.toContain('Asia/Calcutta');
  });

  it('finds a zone by abbreviation, country or offset', () => {
    expect(find('IST')).toContain('Asia/Kolkata');
    expect(find('india')).toContain('Asia/Kolkata');
    expect(find('+05:30')).toContain('Asia/Kolkata');
    expect(find('PST')).toContain('America/Los_Angeles');
  });

  it('keeps a stored value the list does not have', () => {
    expect(timezoneOptions('Asia/Calcutta')[0]?.value).toBe('Asia/Calcutta');
  });
});
