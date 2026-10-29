import { describe, expect, it } from 'vitest';
import { addDays, leaveDays, overlaps } from './leave-days.ts';
import { createLeaveRequestBodySchema } from './leave.ts';

describe('counting leave', () => {
  it('counts working days only, both ends included', () => {
    expect(leaveDays('2026-12-21', '2027-01-01')).toBe(10);
    expect(leaveDays('2026-11-14', '2026-11-15')).toBe(0);
    expect(leaveDays('2026-11-13', '2026-11-16')).toBe(2);
  });

  it('takes half a day off the first day when asked', () => {
    expect(leaveDays('2026-11-09', '2026-11-09', true)).toBe(0.5);
    expect(leaveDays('2026-11-14', '2026-11-14', true)).toBe(0);
  });

  it('counts nothing for a range that ends before it starts', () => {
    expect(leaveDays('2026-11-10', '2026-11-09')).toBe(0);
  });

  it('adds days across months and years, and finds overlaps', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-11-02', -7)).toBe('2026-10-26');
    expect(
      overlaps(
        { start: '2026-11-01', end: '2026-11-05' },
        { start: '2026-11-05', end: '2026-11-09' },
      ),
    ).toBe(true);
    expect(
      overlaps(
        { start: '2026-11-01', end: '2026-11-04' },
        { start: '2026-11-05', end: '2026-11-09' },
      ),
    ).toBe(false);
  });
});

describe('a leave request', () => {
  const body = { policyId: '018f0000-0000-7000-8000-000000000001', startDate: '2026-01-01' };

  it('spans at most a year, so its days are cheap to count', () => {
    expect(createLeaveRequestBodySchema.safeParse({ ...body, endDate: '2027-01-02' }).success).toBe(
      true,
    );
    expect(createLeaveRequestBodySchema.safeParse({ ...body, endDate: '2027-01-03' }).success).toBe(
      false,
    );
    expect(createLeaveRequestBodySchema.safeParse({ ...body, endDate: '9999-12-31' }).success).toBe(
      false,
    );
  });
});
