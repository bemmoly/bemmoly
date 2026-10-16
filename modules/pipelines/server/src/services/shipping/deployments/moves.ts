import type { DeploymentRow } from '../../../models/shipping.ts';
import type { CloudProvider, DeployTarget } from '../../providers/contract.ts';
import type { DeploymentPlan } from '../../rollout/plan.ts';
import type { ShippingEngineDeps } from '../engine-deps.ts';
import { recordDeploymentEvent, type DeploymentChange } from '../record.ts';

/*
 * The moves a rollout makes, each one provider call (when it needs one) followed by one
 * recorded state change: shift to a step, pause for a person, succeed, roll back. Wake-ups
 * follow each write so the next sample, or the promotion, happens on time.
 */

export interface Step {
  row: DeploymentRow;
  plan: DeploymentPlan;
  provider: CloudProvider;
  target: DeployTarget;
  now: Date;
}

export function createMoves(deps: ShippingEngineDeps) {
  const { sql } = deps;

  async function write(row: DeploymentRow, change: DeploymentChange, now: Date) {
    await sql.begin((tx) => recordDeploymentEvent(tx, row.id, change, now));
    if (change.nextActionAt) await deps.wake('deployment', row.id, change.nextActionAt);
    const finished = ['succeeded', 'failed', 'rolled_back', 'cancelled'].includes(change.state);
    if ((finished || change.state === 'waiting') && row.promotion_id) {
      await deps.wake('promotion', row.promotion_id, now);
    }
  }

  const sampleAt = (step: Step) => new Date(step.now.getTime() + step.plan.sampleSeconds * 1000);

  async function rollBack(step: Step, reason: string, automatic: boolean, failingSamples?: number) {
    const { row, provider, target, now } = step;
    if (!row.previous_revision) {
      // A first deploy has nothing to go back to; it stays where it is, marked failed.
      await write(
        row,
        {
          state: 'failed',
          message: reason,
          phase: 'done',
          traffic: 0,
          reason: `${reason}. There was no earlier revision to go back to.`,
          nextActionAt: null,
        },
        now,
      );
      return;
    }
    await provider.targets?.rollback(target, row.previous_revision);
    await write(
      row,
      {
        state: 'rolled_back',
        message: reason,
        phase: 'done',
        traffic: 0,
        reason,
        nextActionAt: null,
        data: { automatic },
        ...(failingSamples === undefined ? {} : { failingSamples }),
      },
      now,
    );
    await deps.onRolledBack?.({
      deploymentId: row.id,
      applicationId: row.application_id,
      environmentId: row.environment_id,
      reason,
      automatic,
    });
  }

  async function pause(step: Step, reason: string) {
    await write(
      step.row,
      {
        state: 'waiting',
        message: reason,
        phase: 'paused',
        pauseReason: reason,
        nextActionAt: null,
      },
      step.now,
    );
  }

  async function succeed(step: Step, note: string) {
    await write(
      step.row,
      {
        state: 'succeeded',
        message: note,
        phase: 'done',
        traffic: 100,
        nextActionAt: null,
        pauseReason: null,
      },
      step.now,
    );
  }

  async function goTo(step: Step, index: number) {
    const { row, plan, provider, target, now } = step;
    const percent = plan.steps[index];
    const stable = row.previous_revision;
    if (percent === undefined || percent >= 100) {
      await provider.targets?.shift(target, { revision: row.revision ?? '', percent: 100, stable });
      if (plan.watchMinutes > 0) {
        await write(
          row,
          {
            state: 'canary',
            message: `All traffic on the new revision; watching for ${plan.watchMinutes} minutes`,
            phase: 'watch',
            traffic: 100,
            stepIndex: plan.steps.length,
            stepStartedAt: now,
            failingSamples: 0,
            nextActionAt: sampleAt(step),
          },
          now,
        );
      } else {
        await succeed({ ...step }, 'All traffic on the new revision');
      }
      return;
    }
    await provider.targets?.shift(target, { revision: row.revision ?? '', percent, stable });
    await write(
      row,
      {
        state: 'canary',
        message: `Canary at ${percent}%`,
        phase: 'step',
        traffic: percent,
        stepIndex: index,
        stepStartedAt: now,
        failingSamples: 0,
        nextActionAt: sampleAt(step),
      },
      now,
    );
  }

  return { write, sampleAt, rollBack, pause, succeed, goTo };
}

export type Moves = ReturnType<typeof createMoves>;
