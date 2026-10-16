import type { Deployment, RolloutWave } from '@bemmoly/module-pipelines/shared';
import type { RolloutStep, RunGlyphState } from '@bemmoly/ui';

/**
 * A wave's canary steps with where the deployment has got to: steps below the live traffic
 * passed, the live one runs (or fails, or waits when paused), the rest queue.
 */
export function stepsOf(wave: RolloutWave, deployment: Deployment | undefined): RolloutStep[] {
  // A wave without canary steps goes straight to all traffic; it shows a step once it runs.
  if (wave.steps.length === 0 && !deployment) return [];
  const steps = wave.steps.length ? wave.steps : [{ trafficPercent: 100, holdMinutes: 0 }];
  return steps.map((step, index) => {
    const key = `${index}:${step.trafficPercent}`;
    const label = `${step.trafficPercent}%`;
    if (!deployment) return { key, label };
    return { key, label, state: stepState(step.trafficPercent, deployment) };
  });
}

function stepState(traffic: number, deployment: Deployment): RunGlyphState {
  if (deployment.state === 'succeeded') return 'passed';
  if (deployment.state === 'rolled_back') {
    return traffic <= deployment.trafficPercent ? 'rolled_back' : 'skipped';
  }
  if (deployment.state === 'cancelled') return 'skipped';
  if (traffic < deployment.trafficPercent) return 'passed';
  if (traffic > deployment.trafficPercent) return 'queued';
  if (deployment.state === 'failed') return 'failed';
  return deployment.phase === 'paused' || deployment.state === 'waiting' ? 'waiting' : 'running';
}

/** The deployment of this promotion into a wave's first environment, newest first. */
export function deploymentFor(
  wave: RolloutWave,
  deployments: readonly Deployment[],
  promotionId: string,
): Deployment | undefined {
  const keys = new Set(wave.environments.map((environment) => environment.key));
  return deployments.find(
    (deployment) => deployment.promotionId === promotionId && keys.has(deployment.environment.key),
  );
}
