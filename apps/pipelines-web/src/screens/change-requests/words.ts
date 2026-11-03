import type { Catalog, Translate } from '@bemmoly/core-web';
import type { DeployWindow } from '@bemmoly/module-pipelines/shared';
import type { changeRequestsText } from '../../i18n/catalog.ts';

/* Sentences several change request parts share: a deploy window in words. */

type T = Translate<typeof changeRequestsText extends Catalog<infer Id> ? Id : never>;

const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** "Mon to Fri, 10:00 to 18:00 Asia/Kolkata", or "any time" without a window. */
export function windowWords(window: DeployWindow, t: T): string {
  if (!window) return t('pipelinesChangeRequests.window.anyTime');
  const days = ORDER.filter((day) => window.days.includes(day));
  const name = (day: (typeof ORDER)[number]) => t(`pipelinesChangeRequests.day.${day}`);
  const first = days[0];
  const last = days[days.length - 1];
  const contiguous =
    first !== undefined &&
    last !== undefined &&
    ORDER.indexOf(last) - ORDER.indexOf(first) === days.length - 1;
  const span =
    days.length === 7
      ? t('pipelinesChangeRequests.window.everyDay')
      : days.length > 2 && contiguous && first && last
        ? t('pipelinesChangeRequests.window.span', { from: name(first), to: name(last) })
        : days.map(name).join(', ');
  return t('pipelinesChangeRequests.window.text', {
    days: span,
    from: window.from,
    to: window.to,
    zone: window.timeZone,
  });
}
