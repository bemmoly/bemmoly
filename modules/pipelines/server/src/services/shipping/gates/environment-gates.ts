import { closesAt, isOpen, nextOpening, parseWindow } from '../../rollout/window.ts';
import { durationMinutes, type GateDefinition } from './contract.ts';

/*
 * Gates answered by where the release is going: how long it has been healthy in Staging,
 * the deploy window, freezes and the error budget. Roll backs never pass through these.
 */

const MINUTE = 60_000;
const clock = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }).format(at);
const day = (at: Date) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(at);

export const stagingHealthyGate: GateDefinition = {
  name: 'staging_healthy',
  label: () => 'Healthy in Staging',
  async evaluate({ release, application, now }, args, { sql }) {
    const needed = durationMinutes(args[0], 30);
    const rows = await sql<
      { release_id: string | null; state: string; deployed_at: string | null; name: string }[]
    >`
      select c.release_id, c.state, c.deployed_at, e.name
      from pipeline_current c join pipeline_environments e on e.id = c.environment_id
      where c.application_id = ${application.id} and e.class = 'staging'`;
    if (rows.length === 0) return { state: 'pending', reason: 'Not deployed to Staging yet' };
    const here = rows.filter((row) => row.release_id === release.id);
    if (here.length === 0) {
      const rolled = rows.some((row) => row.state === 'rolled_back');
      return rolled
        ? { state: 'fail', reason: 'Rolled back in Staging' }
        : { state: 'pending', reason: `Staging runs another release` };
    }
    if (application.health === 'failing') {
      return {
        state: 'pending',
        reason: 'Failing health checks',
        recheckAt: new Date(now.getTime() + 5 * MINUTE),
      };
    }
    const since = Math.max(...here.map((row) => new Date(row.deployed_at ?? now).getTime()));
    const healthy = Math.floor((now.getTime() - since) / MINUTE);
    const evidence = { healthyMinutes: healthy, neededMinutes: needed };
    if (here.some((row) => row.state !== 'idle')) {
      return {
        state: 'pending',
        reason: 'Still rolling out in Staging',
        evidence,
        recheckAt: new Date(now.getTime() + MINUTE),
      };
    }
    if (healthy >= needed) {
      return { state: 'pass', reason: `Healthy for ${healthy} minutes, needs ${needed}`, evidence };
    }
    return {
      state: 'pending',
      reason: `Healthy for ${healthy} minutes, needs ${needed}`,
      evidence,
      recheckAt: new Date(since + needed * MINUTE),
    };
  },
};

export const windowGate: GateDefinition = {
  name: 'window',
  label: () => 'Deploy window',
  async evaluate({ requirements, now }) {
    if (!requirements.window) return { state: 'pass', reason: 'No deploy window applies' };
    const window = parseWindow(requirements.window);
    if (isOpen(window, now)) {
      return {
        state: 'pass',
        reason: `Open until ${clock(closesAt(window, now), window.timeZone)}`,
        evidence: { window: window.text },
      };
    }
    const opens = nextOpening(window, now);
    return {
      state: 'pending',
      reason: opens
        ? `Closed; opens ${clock(opens, window.timeZone)} ${window.timeZone}`
        : 'Closed',
      evidence: { window: window.text },
      recheckAt: opens,
    };
  },
};

export const freezeGate: GateDefinition = {
  name: 'freeze',
  label: () => 'No freeze',
  async evaluate({ application, environment, promotion, now }, _args, { sql }) {
    const freezes = await sql<
      { id: string; name: string; starts_at: string; ends_at: string; reason: string | null }[]
    >`
      select id, name, starts_at, ends_at, reason from pipeline_freezes
      where ends_at > ${now.toISOString()}::timestamptz
        and (environment_class is null or environment_class = ${environment.class})
        and (scope_kind = 'organisation'
          or (scope_kind = 'domain' and scope_id = ${application.domain_id})
          or (scope_kind = 'group' and scope_id = ${application.group_id})
          or (scope_kind = 'application' and scope_id = ${application.id}))
      order by starts_at limit 5`;
    const active = freezes.find((f) => new Date(f.starts_at).getTime() <= now.getTime());
    if (active) {
      const evidence = { freeze: active.id, name: active.name, endsAt: active.ends_at };
      if (promotion.freezeOverride) {
        return {
          state: 'pass',
          reason: `${active.name}, overridden by ${promotion.freezeOverride.byName}: ${promotion.freezeOverride.reason}`,
          evidence: { ...evidence, override: promotion.freezeOverride },
        };
      }
      return {
        state: 'pending',
        reason: `${active.name} until ${day(new Date(active.ends_at))}`,
        evidence,
        recheckAt: new Date(active.ends_at),
      };
    }
    const next = freezes[0];
    return {
      state: 'pass',
      reason: next ? `Next freeze ${day(new Date(next.starts_at))}` : 'No freeze planned',
    };
  },
};

export const errorBudgetGate: GateDefinition = {
  name: 'error_budget',
  label: () => 'Error budget',
  async evaluate({ now }, args, { metrics }) {
    const minimum = Number(args[0] ?? 0) > 0 ? Number(args[0]) / 100 : 0;
    const remaining = metrics ? await metrics.part.errorBudget(metrics.target) : null;
    if (remaining === null) {
      return {
        state: 'pending',
        reason: 'Waiting for metrics',
        recheckAt: new Date(now.getTime() + 15 * MINUTE),
      };
    }
    const left = `${Math.round(remaining * 100)}% left this month`;
    if (remaining <= minimum) return { state: 'fail', reason: left, evidence: { remaining } };
    return { state: 'pass', reason: left, evidence: { remaining } };
  },
};
