/*
 * A story whose dates run past its epic's target: the warning the roadmap and the board card
 * show, and the two fixes they offer. Pure, so the server, the screens and the mock agree on
 * when a story is outside its epic and on what each fix writes. Dates are ISO days.
 */

export interface StoryDates {
  startAt: string | null;
  dueAt: string | null;
}

/** Where an epic's target lives: its Target date field or its due date. */
export type EpicTargetField = 'target_date' | 'dueAt';

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The day itself when the text is an ISO day, else null; custom fields hold any text. */
export function isoDayOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const day = value.slice(0, 10);
  return ISO_DAY.test(day) && !Number.isNaN(Date.parse(day)) ? day : null;
}

/** The story's last day: its due date, else its start. */
export function storyEnd(story: StoryDates): string | null {
  if (story.dueAt && story.startAt)
    return story.dueAt > story.startAt ? story.dueAt : story.startAt;
  return story.dueAt ?? story.startAt;
}

/**
 * How many days the story runs past the epic's target, or null when it fits (or either has
 * no date to compare).
 */
export function daysPastEpic(story: StoryDates, epicEnd: string | null): number | null {
  const end = storyEnd(story);
  if (!end || !epicEnd || end <= epicEnd) return null;
  return Math.round((Date.parse(end) - Date.parse(epicEnd)) / DAY_MS);
}

/** "Extend the epic": its new target, the story's last day. */
export function extendedEpicEnd(story: StoryDates): string | null {
  return storyEnd(story);
}

/**
 * "Pull the story in": due on the epic's target, and a start that never passes it. A start
 * already inside the epic stays where it is.
 */
export function pulledInside(story: StoryDates, epicEnd: string): StoryDates {
  return {
    startAt: story.startAt && story.startAt > epicEnd ? epicEnd : story.startAt,
    dueAt: epicEnd,
  };
}
