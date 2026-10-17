import type { GlyphState, Tier } from '../../../../shared/common.ts';
import type { EnvironmentRef } from '../../../../shared/environments.ts';
import type { Journey, JourneyNote, JourneyStation } from '../../../../shared/for-you.ts';
import type {
  ChangeRow,
  FlakyRow,
  JobRow,
  OpenPromotionRow,
  PlaceRow,
  ReleaseRow,
} from './reads.ts';
import { iso } from '../../utils/time.ts';

export interface JourneyInputs {
  jobs: Map<string, JobRow[]>;
  releases: Map<string, ReleaseRow>;
  places: Map<string, PlaceRow[]>;
  promotions: Map<string, OpenPromotionRow[]>;
  flaky: Map<string, FlakyRow>;
  /** "release:environment" to how long the deploy took, for releases deployed there. */
  deployed: Map<string, number | null>;
}

const BUILD_KINDS = new Set(['detect', 'build', 'publish']);

/** "2m", "45s", "1h 5m": short, as the stations draw it. */
export function shortDuration(seconds: number | null): string | null {
  if (seconds === null || seconds < 0) return null;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** "Prod · asia-south1" as a station: "Prod asia". */
function stationLabel(place: PlaceRow): string {
  if (place.environment_class === 'prod' && place.region)
    return `Prod ${place.region.split('-')[0] ?? place.region}`;
  return place.environment_name;
}

/** Several jobs as one station: failed wins, then running, then waiting, else passed. */
function jobsStation(key: string, label: string, list: readonly JobRow[]): JourneyStation {
  const failed = list.find((job) => job.state === 'failed');
  const running = list.some((job) => ['claimed', 'running'].includes(job.state));
  const waiting = list.some((job) => ['pending', 'ready'].includes(job.state));
  const state: GlyphState = failed
    ? 'failed'
    : running
      ? 'running'
      : waiting
        ? 'queued'
        : list.length && list.every((job) => job.state === 'skipped')
          ? 'skipped'
          : 'passed';
  const seconds = Math.max(0, ...list.map((job) => job.seconds ?? 0));
  const detail = failed
    ? failed.name.toLowerCase()
    : state === 'passed'
      ? shortDuration(seconds)
      : null;
  return { key, label, state, detail, live: false, environment: null };
}

function placeStation(
  place: PlaceRow,
  release: ReleaseRow | undefined,
  runFailed: boolean,
  promotion: OpenPromotionRow | undefined,
  deployed: Map<string, number | null>,
): JourneyStation {
  const environment: EnvironmentRef = {
    id: place.environment_id,
    key: place.environment_key,
    name: place.environment_name,
    class: place.environment_class as EnvironmentRef['class'],
  };
  const base = { key: place.environment_key, label: stationLabel(place), live: false, environment };
  if (!release) return { ...base, state: runFailed ? 'skipped' : 'queued', detail: null };
  if (place.release_id === release.id && place.moving_release_id !== release.id)
    return { ...base, state: 'passed', detail: shortDuration(place.deploy_seconds) };
  const earlier = `${release.id}:${place.environment_id}`;
  if (deployed.has(earlier) && place.moving_release_id !== release.id)
    return { ...base, state: 'passed', detail: shortDuration(deployed.get(earlier) ?? null) };
  if (place.moving_release_id === release.id) {
    if (place.state === 'canary')
      return { ...base, state: 'running', detail: `${place.traffic_percent ?? 0}% canary` };
    if (place.state === 'deploying') return { ...base, state: 'running', detail: 'deploying' };
    if (place.state === 'failed') return { ...base, state: 'failed', detail: 'failed' };
    if (
      promotion?.state === 'awaiting_approval' &&
      promotion.environment_id === place.environment_id
    )
      return { ...base, state: 'waiting', detail: 'approval' };
  }
  return { ...base, state: runFailed ? 'skipped' : 'queued', detail: null };
}

function noteFor(
  change: ChangeRow,
  stations: readonly JourneyStation[],
  jobs: readonly JobRow[],
  promotion: OpenPromotionRow | undefined,
  flaky: FlakyRow | undefined,
): JourneyNote {
  const failedJob = jobs.find((job) => job.state === 'failed');
  if (change.state === 'failed' || failedJob) {
    return {
      glyph: 'failed',
      text: failedJob?.failure_summary ?? `${failedJob?.name ?? 'The run'} failed`,
      action: 'rerun_failed',
      flag:
        flaky && flaky.failed > 0
          ? `Failed ${flaky.failed} of last ${flaky.samples} on main`
          : null,
    };
  }
  const live = stations.find((station) => station.live);
  if (live?.state === 'running' && live.environment)
    return {
      glyph: 'running',
      text: live.detail?.endsWith('canary')
        ? `Canary at ${live.detail.replace(' canary', '')} in ${live.environment.name}.`
        : `Deploying to ${live.environment.name}.`,
      action: 'open',
      flag: null,
    };
  if (live?.state === 'waiting' && promotion)
    return {
      glyph: 'waiting',
      text:
        promotion.gates_open === 0
          ? 'Waiting for approval. Every gate passed.'
          : `Waiting for approval and ${promotion.gates_open} more ${promotion.gates_open === 1 ? 'gate' : 'gates'}.`,
      action: 'remind',
      flag: null,
    };
  if (live?.state === 'running')
    return { glyph: 'running', text: `${live.label} is running.`, action: 'open', flag: null };
  const shipped = stations
    .filter((station) => station.environment)
    .every((s) => s.state === 'passed');
  if (shipped)
    return { glyph: 'passed', text: 'In every environment.', action: 'open', flag: null };
  const last = [...stations].reverse().find((station) => station.state === 'passed');
  return {
    glyph: 'passed',
    text: last?.environment ? `In ${last.environment.name}.` : 'Built and tested.',
    action: 'open',
    flag: null,
  };
}

/** One change from commit to the last Prod region, with the station it is at now. */
export function toJourney(change: ChangeRow, inputs: JourneyInputs): Journey {
  const jobs = inputs.jobs.get(change.id) ?? [];
  const release = inputs.releases.get(change.id);
  const places = change.application_id ? (inputs.places.get(change.application_id) ?? []) : [];
  const promotions = release ? (inputs.promotions.get(release.id) ?? []) : [];
  const promotion = promotions[0];
  const runFailed = change.state === 'failed';
  const stations: JourneyStation[] = [
    jobsStation(
      'build',
      'Build',
      jobs.filter((job) => BUILD_KINDS.has(job.kind)),
    ),
    jobsStation(
      'test',
      'Test',
      jobs.filter((job) => !BUILD_KINDS.has(job.kind) && job.kind !== 'deploy'),
    ),
    ...places.map((place) => placeStation(place, release, runFailed, promotion, inputs.deployed)),
  ];
  const liveIndex = stations.findIndex((station) => station.state !== 'passed');
  const at = liveIndex === -1 ? stations.length - 1 : liveIndex;
  const marked = stations.map((station, index) => ({
    ...station,
    live: index === at && liveIndex !== -1,
  }));
  // The track fills to just short of the live station, as the drawing shows it.
  const progress =
    stations.length > 1 ? Math.min(1, Math.max(0, (at - 0.5) / (stations.length - 1))) : 0;
  const flaky = change.application_id ? inputs.flaky.get(change.application_id) : undefined;
  return {
    id: change.id,
    title: change.title,
    repository: change.repository,
    commitSha: change.commit_sha,
    issueKey: change.issue_key,
    application:
      change.application_id && change.application_key && change.application_name
        ? {
            id: change.application_id,
            key: change.application_key,
            name: change.application_name,
            tier: (change.tier ?? 2) as Tier,
          }
        : null,
    stations: marked,
    progress: liveIndex === -1 ? 1 : progress,
    note: noteFor(change, marked, jobs, promotion, flaky),
    runId: change.id,
    releaseId: release?.id ?? null,
    promotionId: promotion?.id ?? null,
    updatedAt: iso(change.updated_at),
  };
}
