import { useT } from '@bemmoly/core-web';
import { pipelinesText } from '../../i18n/catalog.ts';
import { ScreenFrame, useScopeName } from '../screen-frame.tsx';
import { RunsList } from './runs-list.tsx';

/** Every run in the scope: what is running, what is queued, what failed. */
export default function RunsScreen() {
  const t = useT(pipelinesText);
  const scope = useScopeName();
  return (
    <ScreenFrame
      title={t('pipelines.runs.title')}
      meta={scope ? t('pipelines.runs.inScope', { scope }) : null}
    >
      <RunsList />
    </ScreenFrame>
  );
}
