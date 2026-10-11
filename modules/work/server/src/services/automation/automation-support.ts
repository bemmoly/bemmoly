import type { Unsubscribe } from '@bemmoly/core';
import type { AutomationRun, CreateAutomationRuleBody } from '../../../../shared/index.ts';
import type { WorkHarness } from '../int-support.ts';
import { WORK_AUTOMATION_RUN_JOB } from '../jobs.ts';
import { subscribeAutomation, type AutomationService } from './index.ts';

/*
 * What the automation suites share: the engine subscribed to the harness's bus, the queued
 * run jobs drained by hand (each run may queue more), and quick reads of runs and audit rows.
 * Test-only.
 */

export interface AutomationFixture {
  automation: AutomationService;
  /** Runs queued jobs until none are left; returns how many ran. Fails on a runaway loop. */
  drain(limit?: number): Promise<number>;
  rule(body: CreateAutomationRuleBody, userId?: string): Promise<{ id: string }>;
  runs(ruleId?: string): Promise<AutomationRun[]>;
  stop: Unsubscribe;
}

export function automationFixture(
  h: WorkHarness,
  automation: AutomationService = h.services.automation,
): AutomationFixture {
  const stop = subscribeAutomation(h.bus, automation);
  return {
    automation,
    stop,
    async drain(limit = 50) {
      let ran = 0;
      for (;;) {
        const index = h.jobs.findIndex((job) => job.name === WORK_AUTOMATION_RUN_JOB);
        if (index < 0) return ran;
        const [job] = h.jobs.splice(index, 1);
        await automation.handleJob(job?.payload);
        ran += 1;
        if (ran > limit) throw new Error(`More than ${limit} automation runs: a loop got through`);
      }
    },
    rule: (body, userId = h.users.admin) => automation.create(h.as(userId), body),
    async runs(ruleId) {
      const page = await automation.runs(h.as(h.users.admin), {
        limit: 200,
        ...(ruleId ? { ruleId } : {}),
      });
      return [...page.items].reverse();
    },
  };
}
