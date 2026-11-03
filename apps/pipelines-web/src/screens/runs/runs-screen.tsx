import { useT } from '@bemmoly/core-web';
import { Button } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { pipelinesText, runsText } from '../../i18n/catalog.ts';
import { ScreenFrame, useScopeName } from '../screen-frame.tsx';
import { RunPipelineDialog } from './run-pipeline-dialog.tsx';
import { RunsList } from './runs-list.tsx';

/** Every run in the scope: what is running, what is queued, what failed. */
export default function RunsScreen() {
  const t = useT(pipelinesText);
  const runs = useT(runsText);
  const scope = useScopeName();
  const [running, setRunning] = useState(false);
  return (
    <ScreenFrame
      title={t('pipelines.runs.title')}
      meta={scope ? t('pipelines.runs.inScope', { scope }) : null}
      actions={
        <Button
          variant="primary"
          icon={<Icon name="play" size={14} />}
          onClick={() => setRunning(true)}
        >
          {runs('pipelinesRuns.dialog.title')}
        </Button>
      }
    >
      <span className="-mt-2 text-13 text-tx-3">{runs('pipelinesRuns.list.description')}</span>
      <RunsList />
      {running ? <RunPipelineDialog onClose={() => setRunning(false)} /> : null}
    </ScreenFrame>
  );
}
