import { ValidationError } from '@bemmoly/shared';
import { z } from 'zod';
import {
  deployRuntimeSchema,
  type DeployRuntime,
  type EnvironmentClass,
  type Tier,
} from '../../../../shared/common.ts';
import type { EnvironmentRef } from '../../../../shared/environments.ts';
import type { RolloutPlan } from '../../../../shared/promotions.ts';

/*
 * The rollout plan as a promotion stores it: compact, by environment key, so a seeded or
 * hand-written plan reads the same as one the engine built. The API shows it in the richer
 * shape of shared/promotions.ts. Defaults come from the tier and the path: the first Prod
 * region gets canary steps judged on metrics, later regions follow after their bake time.
 */

const checkSchema = z.enum(['error_rate', 'latency_p95', 'custom']);

export const storedWaveSchema = z.object({
  wave: z.number().int().min(1),
  environments: z.array(z.string()).min(1),
  /** Traffic percentages; empty means straight to 100%. */
  steps: z.array(z.number().int().min(1).max(100)).default([]),
  holdMinutes: z.number().int().min(0).default(10),
  startsAfterMinutes: z.number().int().min(0).optional(),
  checks: z.array(checkSchema).default(['error_rate', 'latency_p95']),
});

export const storedPlanSchema = z.object({
  waves: z.array(storedWaveSchema).default([]),
  autoRollback: z.boolean().default(true),
  /** After 100%, how long the new revision is watched against the old one's baseline. */
  watchMinutes: z.number().int().min(0).default(10),
  /** How often a step is sampled; two failing samples in a row roll back. */
  sampleSeconds: z.number().int().min(5).max(600).default(60),
});

export type StoredWave = z.infer<typeof storedWaveSchema>;
export type StoredPlan = z.infer<typeof storedPlanSchema>;

/** What one deployment carries: its wave's steps plus the plan-wide settings. */
export interface DeploymentPlan {
  steps: number[];
  holdMinutes: number;
  watchMinutes: number;
  sampleSeconds: number;
  autoRollback: boolean;
  checks: Array<z.infer<typeof checkSchema>>;
  /** The stable revision's numbers just before the deploy, for the watch period. */
  baseline?: { error_rate: number | null; latency_p95: number | null };
  /** The runtime the deploy started on; a switch takes effect on the next deploy. */
  runtime?: DeployRuntime;
}

export const deploymentPlanSchema = z.object({
  steps: z.array(z.number().int()).default([]),
  holdMinutes: z.number().int().default(0),
  watchMinutes: z.number().int().default(0),
  sampleSeconds: z.number().int().default(60),
  autoRollback: z.boolean().default(true),
  checks: z.array(checkSchema).default(['error_rate', 'latency_p95']),
  baseline: z
    .object({ error_rate: z.number().nullable(), latency_p95: z.number().nullable() })
    .optional(),
  runtime: deployRuntimeSchema.optional(),
});

export function readPlan(value: unknown): StoredPlan {
  const parsed = storedPlanSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : storedPlanSchema.parse({});
}

export interface PlanDefaults {
  holdMinutes: number;
  watchMinutes: number;
  sampleSeconds: number;
}

export interface PathStage {
  stage: number;
  bakeMinutes: number;
  environments: string[];
}

/** Canary steps by tier for the first wave of a protected class; others go straight. */
function firstWaveSteps(tier: Tier, environmentClass: EnvironmentClass): number[] {
  if (environmentClass !== 'prod') return [];
  if (tier === 0) return [5, 25, 50, 100];
  if (tier === 1) return [5, 25, 100];
  return [50, 100];
}

export function defaultPlan(input: {
  tier: Tier;
  environmentClass: EnvironmentClass;
  stages: readonly PathStage[];
  defaults: PlanDefaults;
}): StoredPlan {
  const prod = input.environmentClass === 'prod';
  const stages = [...input.stages]
    .sort((a, b) => a.stage - b.stage)
    .filter((stage) => stage.environments.length > 0);
  // A stage's bake is how long it must stay healthy before the next stage starts.
  const waves = stages.map((stage, index): StoredWave => ({
    wave: index + 1,
    environments: stage.environments,
    steps: index === 0 ? firstWaveSteps(input.tier, input.environmentClass) : [],
    holdMinutes: prod ? input.defaults.holdMinutes : 0,
    ...(index > 0 ? { startsAfterMinutes: stages[index - 1]?.bakeMinutes || (prod ? 30 : 0) } : {}),
    checks: ['error_rate', 'latency_p95'],
  }));
  return {
    waves,
    autoRollback: true,
    watchMinutes: input.environmentClass === 'dev' ? 0 : input.defaults.watchMinutes,
    sampleSeconds: input.defaults.sampleSeconds,
  };
}

/** A person may ask for a plan narrower than the default, never a less careful one. */
export function narrowPlan(base: StoredPlan, asked: Partial<RolloutPlan> | undefined): StoredPlan {
  if (!asked) return base;
  const refuse = (why: string) =>
    new ValidationError(`A plan may be more careful than the default, never less: ${why}`);
  if (asked.autoRollback === false && base.autoRollback) throw refuse('keep automatic roll back');
  if (!asked.waves) return { ...base, autoRollback: asked.autoRollback ?? base.autoRollback };
  const waves = base.waves.map((wave) => {
    const want = asked.waves?.find((w) => w.wave === wave.wave);
    if (!want) return wave;
    const steps = want.steps.map((step) => step.trafficPercent);
    const hold = Math.max(0, ...want.steps.map((step) => step.holdMinutes));
    if (steps.length < wave.steps.length) throw refuse(`wave ${wave.wave} needs its canary steps`);
    if (steps.length > 0 && hold < wave.holdMinutes) {
      throw refuse(`wave ${wave.wave} holds each step at least ${wave.holdMinutes} minutes`);
    }
    if (
      steps.some((step, i) => i > 0 && step <= (steps[i - 1] ?? 0)) ||
      (steps.at(-1) ?? 100) !== 100
    ) {
      throw refuse(`wave ${wave.wave} steps must rise to 100%`);
    }
    return { ...wave, steps, holdMinutes: steps.length > 0 ? hold : wave.holdMinutes };
  });
  return { ...base, waves };
}

export function deploymentPlanFor(plan: StoredPlan, wave: StoredWave): DeploymentPlan {
  return {
    steps: wave.steps,
    holdMinutes: wave.holdMinutes,
    watchMinutes: plan.watchMinutes,
    sampleSeconds: plan.sampleSeconds,
    autoRollback: plan.autoRollback,
    checks: wave.checks,
  };
}

/** The stored plan in the API's shape; unknown environment keys are left out. */
export function presentPlan(
  plan: StoredPlan,
  environments: ReadonlyMap<string, EnvironmentRef>,
): RolloutPlan {
  const waves = plan.waves
    .map((wave, index) => ({
      wave: wave.wave,
      environments: wave.environments.flatMap((key) => {
        const found = environments.get(key);
        return found ? [found] : [];
      }),
      steps: wave.steps.map((trafficPercent) => ({
        trafficPercent,
        holdMinutes: wave.holdMinutes,
      })),
      startsAfter:
        index > 0
          ? { wave: plan.waves[index - 1]?.wave ?? 1, bakeMinutes: wave.startsAfterMinutes ?? 0 }
          : null,
      checks: wave.checks,
    }))
    .filter((wave) => wave.environments.length > 0);
  return { waves, autoRollback: plan.autoRollback };
}
