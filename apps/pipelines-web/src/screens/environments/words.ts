import type { Catalog, Translate } from '@bemmoly/core-web';
import type { DeployWindow, EnvironmentV2View, Weekday } from '@bemmoly/module-pipelines/shared';
import type { environmentsText } from '../../i18n/catalog.ts';

/*
 * An environment's settings in words, for its card and the checklist's summary. Each says "Off"
 * or "None" until someone turns it on, so a fresh environment reads as exactly that.
 */

type T = typeof environmentsText extends Catalog<infer Id> ? Translate<Id> : never;

const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export function windowText(t: T, window: DeployWindow): string {
  if (!window) return t('pipelinesEnvironments.value.none');
  const days =
    window.days.length === 7
      ? t('pipelinesEnvironments.value.everyDay')
      : window.days.length === 5 && WEEKDAYS.every((day) => window.days.includes(day))
        ? t('pipelinesEnvironments.value.weekdays')
        : window.days.map((day) => t(`pipelinesEnvironments.day.${day}`)).join(', ');
  return t('pipelinesEnvironments.value.window', { days, from: window.from, to: window.to });
}

export function approvalText(t: T, environment: EnvironmentV2View): string {
  if (environment.approvalSteps.length === 0) return t('pipelinesEnvironments.value.off');
  const steps = environment.approvalSteps.map((step) =>
    t(
      step.when === 'always'
        ? 'pipelinesEnvironments.value.step'
        : 'pipelinesEnvironments.value.stepHighRisk',
      { count: step.count, group: step.groupRef.name },
    ),
  );
  return steps.reduce((all, step) =>
    t('pipelinesEnvironments.suggest.then', { first: all, second: step }),
  );
}

export function deployersText(t: T, environment: EnvironmentV2View): string {
  const named =
    (environment.deployers?.users.length ?? 0) + (environment.deployers?.groups.length ?? 0);
  return named === 0
    ? t('pipelinesEnvironments.value.anyone')
    : t('pipelinesEnvironments.value.named', { count: named });
}

export function versionsText(
  t: T,
  environment: EnvironmentV2View,
  previous: string | null,
): string {
  if (environment.versionsAllowed === 'any') return t('pipelinesEnvironments.value.anyVersion');
  return previous
    ? t('pipelinesEnvironments.value.passed', { previous })
    : t('pipelinesEnvironments.value.passedPrevious');
}
