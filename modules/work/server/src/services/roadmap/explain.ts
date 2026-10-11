import type { ForecastHistory, ForecastState } from '../../../../shared/roadmap.ts';
import { dayWords, daysWords } from './days.ts';
import { MIN_COMPLETIONS, type Steadiness } from './history.ts';
import type { Ends } from './forecast.ts';

/*
 * The forecast in plain words, a sentence per step of the reasoning: what history it used,
 * what is left, who shares the team, what it waits on, what the simulation found, how that
 * compares with the target and how sure it is. Every sentence is built from the numbers the
 * forecast used, so the words can never say something the arithmetic did not do.
 */

const round = (value: number) => Math.round(value * 10) / 10;
const plural = (count: number, one: string, many = `${one}s`) =>
  `${round(count)} ${count === 1 ? one : many}`;

function paceSentence(project: string, history: ForecastHistory): string {
  const { samples } = history;
  const period = history.basis === 'velocity' ? 'sprint' : 'week';
  const unit = history.unit === 'points' ? 'point' : 'issue';
  const low = Math.min(...samples);
  const high = Math.max(...samples);
  const mean = round(samples.reduce((a, b) => a + b, 0) / samples.length);
  const span =
    history.basis === 'velocity'
      ? `Over its last ${samples.length} sprints`
      : `Over the last ${samples.length} weeks`;
  if (low === high) return `${span}, ${project} finished ${plural(low, unit)} every ${period}.`;
  return `${span}, ${project} finished ${round(low)} to ${plural(high, unit)} a ${period}, ${mean} on average.`;
}

function shareWords(share: number): string {
  if (share === 1 / 2) return 'half';
  if (share === 1 / 3) return 'a third';
  if (share === 1 / 4) return 'a quarter';
  return `about ${Math.round(share * 100)}%`;
}

const names = (titles: readonly string[]) =>
  titles.length <= 2
    ? titles.join(' and ')
    : `${titles.slice(0, -1).join(', ')} and ${titles.at(-1) ?? ''}`;

export interface Reasoning {
  kind: 'epic' | 'version';
  project: string;
  history: ForecastHistory;
  totalIssues: number;
  remainingIssues: number;
  remainingPoints: number;
  unestimated: number;
  meanEstimate: number;
  sharedWith: number;
  started: boolean;
  blockers: readonly { title: string; likely: number }[];
  ends: Ends;
  state: ForecastState;
  targetDay: number | null;
  steadiness: Steadiness;
  working: number;
  today: number;
}

function remainingSentence(r: Reasoning): string {
  if (r.remainingIssues === 0) return 'Every issue in it is done; it is ready to close.';
  const whole = r.kind === 'epic' ? 'its' : 'this version’s';
  if (r.history.unit === 'issues')
    return `${r.remainingIssues} of ${whole} ${plural(r.totalIssues, 'issue')} are left.`;
  const counted =
    r.unestimated > 0
      ? `, counting the ${plural(r.unestimated, 'issue')} without an estimate at ${round(r.meanEstimate)} points each, the project’s average`
      : '';
  return `${plural(r.remainingPoints, 'point')} are left in ${plural(r.remainingIssues, 'open issue')}${counted}.`;
}

function targetSentence(r: Reasoning): string {
  if (r.targetDay === null) return 'It has no target date to compare with.';
  const target = dayWords(r.targetDay, r.today);
  if (r.state === 'late')
    return `That is ${daysWords(r.ends.likely - r.targetDay)} after the ${target} target.`;
  if (r.state === 'at_risk') return `That meets the ${target} target, but the slower runs miss it.`;
  const spare = r.targetDay - r.ends.latest;
  return spare > 0
    ? `Even the slower runs finish by the ${target} target, ${daysWords(spare)} early.`
    : `Even the slower runs finish by the ${target} target.`;
}

function confidenceSentence(r: Reasoning): string {
  const period = r.history.basis === 'velocity' ? 'sprint' : 'week';
  const { confidence, reason } = r.steadiness;
  if (reason === 'steady') return `Confidence is ${confidence}: the pace has been steady.`;
  if (reason === 'short')
    return `Confidence is ${confidence}: only ${plural(r.working, period)} had finished work.`;
  return `Confidence is ${confidence}: the pace swings from ${period} to ${period}.`;
}

/** The full explanation of a forecast that has dates. */
export function explainForecast(r: Reasoning): string[] {
  const sentences = [paceSentence(r.project, r.history), remainingSentence(r)];
  if (r.remainingIssues === 0) return [...sentences, targetSentence(r)];
  if (r.sharedWith > 0) {
    const share = shareWords(1 / (r.sharedWith + 1));
    sentences.push(
      `The team is working on ${r.sharedWith + 1} epics at once, so this one gets ${share} of that pace.`,
    );
  }
  const latest = r.blockers.reduce((max, blocker) => Math.max(max, blocker.likely), -Infinity);
  if (r.blockers.length > 0) {
    const who = names(r.blockers.map((blocker) => blocker.title));
    const when = dayWords(latest, r.today);
    sentences.push(
      r.started
        ? `It cannot finish before ${who}, likely done ${when}.`
        : `It starts once ${who} ${r.blockers.length === 1 ? 'is' : 'are'} done, likely ${when}.`,
    );
  }
  const periods = r.history.basis === 'velocity' ? 'sprints' : 'weeks';
  sentences.push(
    `Replaying those ${periods} a thousand times, half the runs finish by ${dayWords(r.ends.likely, r.today)} and 85 in 100 by ${dayWords(r.ends.latest, r.today)}.`,
  );
  sentences.push(targetSentence(r), confidenceSentence(r));
  return sentences;
}

export const explainDone = (kind: 'epic' | 'version'): string[] =>
  kind === 'epic' ? ['Every issue in it is done.'] : ['Released.'];

export const explainNoWork = (kind: 'epic' | 'version'): string[] => [
  kind === 'epic'
    ? 'No issues are in it yet, so there is nothing to forecast.'
    : 'No issues name this version yet, so there is nothing to forecast.',
];

export const explainNoHistory = (project: string, completions: number): string[] => [
  `Not enough finished work to forecast yet: ${project} finished ${plural(completions, 'issue')} in the last 8 weeks, and a forecast needs ${MIN_COMPLETIONS} or more.`,
];

export const explainHorizon = (project: string): string[] => [
  `At the pace ${project} has kept, this would take more than three years, too far to forecast.`,
];
