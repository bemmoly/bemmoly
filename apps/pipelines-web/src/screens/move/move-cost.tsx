import { useT } from '@bemmoly/core-web';
import type { RuntimeMove } from '@bemmoly/module-pipelines/shared';
import { pipelinesText } from '../../i18n/catalog.ts';
import { RUNTIME_NAME } from '../../parts/runtime-words.ts';
import { Panel } from '../../parts/screen.tsx';
import { formatDollars } from './words.ts';

/**
 * The month before and after, line by line, and the difference. Every figure is a rough
 * estimate from list prices on the date shown, never a bill.
 */
export function MoveCost({ move }: { move: RuntimeMove }) {
  const t = useT(pipelinesText);
  const { cost } = move;
  const label = (line: RuntimeMove['cost']['lines'][number]) => {
    const runtime = line.runtime ? t(RUNTIME_NAME[line.runtime]) : '';
    if (line.item === 'front-door') return t('pipelines.move.costFrontDoor');
    if (line.item === 'cluster') return t('pipelines.move.costCluster', { runtime });
    return runtime;
  };
  const cell = 'py-1.5 text-end font-mono tabular-nums';
  return (
    <Panel
      title={t('pipelines.move.cost')}
      meta={t('pipelines.move.costEstimate', { date: cost.pricesAsOf })}
    >
      <table className="w-full text-13 text-tx">
        <caption className="sr-only">{t('pipelines.move.cost')}</caption>
        <thead>
          <tr className="text-12 text-tx-3">
            <th scope="col" className="py-1.5 text-start font-normal">
              {t('pipelines.move.costItem')}
            </th>
            <th scope="col" className="py-1.5 text-end font-normal">
              {t('pipelines.move.costBefore')}
            </th>
            <th scope="col" className="py-1.5 text-end font-normal">
              {t('pipelines.move.costAfter')}
            </th>
          </tr>
        </thead>
        <tbody>
          {cost.lines.map((line) => (
            <tr key={`${line.item}-${line.runtime ?? ''}`} className="border-t border-line-2">
              <th scope="row" className="py-1.5 text-start font-normal">
                {label(line)}
              </th>
              <td className={cell}>{formatDollars(line.before)}</td>
              <td className={cell}>{formatDollars(line.after)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line font-semibold">
            <th scope="row" className="py-1.5 text-start">
              {t('pipelines.move.costTotal')}
            </th>
            <td className={cell}>{formatDollars(cost.before)}</td>
            <td className={cell}>{formatDollars(cost.after)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-13 font-medium text-tx">
        {cost.difference === 0
          ? t('pipelines.move.costSame')
          : t(cost.difference > 0 ? 'pipelines.move.costAdds' : 'pipelines.move.costSaves', {
              amount: formatDollars(Math.abs(cost.difference)),
            })}
      </p>
      <p className="mt-1 text-12 leading-body text-tx-3">
        {t('pipelines.move.costAssumes', {
          cpu: cost.assumes.cpu,
          memory: cost.assumes.memoryGiB,
        })}
      </p>
    </Panel>
  );
}
