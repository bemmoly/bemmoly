import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RelativeTime } from '../components/relative-time/relative-time.tsx';
import { formatDate, formatNumber, setFormatLocale } from './intl.ts';
import { formatAbsolute, formatRelative } from './time.ts';

const now = new Date(2026, 9, 11, 15, 0);
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const daysAgo = (days: number) => new Date(2026, 9, 11 - days, 9, 0).toISOString();

afterEach(() => setFormatLocale('en'));

describe('formatRelative through Intl', () => {
  it('reads as the mocks do in English', () => {
    expect(formatRelative(ago(0.5), now)).toBe('now');
    expect(formatRelative(ago(5), now)).toBe('5m ago');
    expect(formatRelative(ago(180), now)).toBe('3h ago');
    expect(formatRelative(daysAgo(1), now)).toBe('yesterday');
    expect(formatRelative(daysAgo(2), now)).toBe('Friday');
    expect(formatRelative(daysAgo(12), now)).toBe('12 days ago');
    expect(formatRelative(daysAgo(90), now)).toBe('Jul 13');
    expect(formatRelative(null, now)).toBe('Never');
  });

  it('follows the active locale', () => {
    setFormatLocale('de');
    expect(formatRelative(daysAgo(1), now)).toBe('gestern');
    expect(formatRelative(daysAgo(12), now)).toBe('vor 12 Tagen');
    expect(formatRelative(daysAgo(2), now)).toBe('Freitag');
    expect(formatRelative(ago(5), now, 'en')).toBe('5m ago');
  });

  it('gives the absolute time a relative one stands for', () => {
    const iso = new Date(2026, 9, 7, 14, 32).toISOString();
    expect(formatAbsolute(iso)).toBe('Oct 7, 2026, 02:32 PM');
    expect(formatAbsolute(iso, 'de')).toBe('7. Okt. 2026, 14:32');
  });
});

describe('numbers and dates', () => {
  it('group and separate by locale', () => {
    expect(formatNumber(1234.5)).toBe('1,234.5');
    setFormatLocale('fr');
    expect(formatNumber(1234.5)).toBe('1 234,5');
    expect(formatDate(new Date(2026, 9, 11), { month: 'long', day: 'numeric' })).toBe('11 octobre');
  });
});

describe('RelativeTime', () => {
  it('re-renders when the language changes', () => {
    render(<RelativeTime iso={daysAgo(1)} now={now} />);
    expect(screen.getByText('yesterday')).toBeTruthy();
    act(() => setFormatLocale('fr'));
    expect(screen.getByText('hier')).toBeTruthy();
  });
});
