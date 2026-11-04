import { useT } from '@bemmoly/core-web';
import { Skeleton } from '@bemmoly/ui';
import { useParams } from '@tanstack/react-router';
import { editorText } from '../../i18n/catalog.ts';
import { LoadError } from '../../parts/load-error.tsx';
import { PipelineEditor } from '../pipeline/editor/pipeline-editor.tsx';
import { SetupForm } from '../pipeline/setup-form.tsx';
import { usePipelineSetup, useStoredPipeline } from '../pipeline/use-pipeline-setup.ts';

/**
 * A service's Pipelines tab: the three setup choices until they are made, then the editor of
 * its Deliver pipeline.
 */
export default function ServicePipelines() {
  const t = useT(editorText);
  const { key = '' } = useParams({ strict: false }) as { key?: string };
  const setup = usePipelineSetup(key);
  const chosen = Boolean(setup.data?.start);
  const stored = useStoredPipeline(key, chosen);
  return (
    <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6">
      {setup.isError ? (
        <LoadError
          title={t('pipelinesEditor.loadFailed')}
          error={setup.error}
          onRetry={() => void setup.refetch()}
        />
      ) : !setup.data || (chosen && !stored.data) ? (
        <Skeleton width="100%" height={320} />
      ) : chosen ? (
        <PipelineEditor service={key} setup={setup.data} stored={stored.data?.definition} />
      ) : (
        <SetupForm service={key} />
      )}
    </div>
  );
}
