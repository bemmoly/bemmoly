import { useT } from '@bemmoly/core-web';
import { Button, Field, Input, Modal, Select } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { deliveryKeys } from '../../api/delivery.ts';
import { pipelinesKeys } from '../../api/pipelines.ts';
import { runsText } from '../../i18n/catalog.ts';
import { api } from '../../lib/api.ts';
import { ActionError } from '../../parts/action-error.tsx';

/**
 * "Run a pipeline": a service's pipeline, by hand, on a branch (and a commit when Pipelines has
 * not seen one on it yet). The only way a pipeline with no triggers runs.
 */
export function RunPipelineDialog({ service, onClose }: { service?: string; onClose: () => void }) {
  const t = useT(runsText);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [application, setApplication] = useState(service ?? '');
  const [chosenRef, setRef] = useState<string | null>(null);
  const [commit, setCommit] = useState('');
  const services = useQuery({
    queryKey: pipelinesKeys.applications({ limit: 200 }),
    queryFn: () => api.pipelines.applications({ limit: 200 }),
    enabled: !service,
  });
  const pipeline = useQuery({
    queryKey: deliveryKeys.pipeline(application),
    queryFn: () => api.delivery.applicationPipeline(application),
    enabled: application.length > 0,
  });
  const ref = chosenRef ?? pipeline.data?.defaultRef ?? '';
  const start = useMutation({
    mutationFn: () =>
      api.delivery.createRun({
        application,
        ref: ref || 'main',
        ...(commit.trim() ? { commitSha: commit.trim() } : {}),
      }),
    onSuccess: (run) => {
      void client.invalidateQueries({ queryKey: ['pipelines', 'runs'] });
      onClose();
      void navigate({ to: '/runs/$id', params: { id: run.id } });
    },
  });
  const noPipeline = pipeline.data?.source === 'none';
  const validCommit = commit.trim() === '' || /^[0-9a-f]{7,64}$/.test(commit.trim());
  return (
    <Modal
      open
      onClose={onClose}
      title={t('pipelinesRuns.dialog.title')}
      description={t('pipelinesRuns.dialog.description')}
      footer={
        <>
          <Button onClick={onClose}>{t('pipelinesRuns.common.cancel')}</Button>
          <Button
            variant="primary"
            icon={<Icon name="play" size={14} />}
            disabled={!application || noPipeline || !validCommit}
            loading={start.isPending}
            onClick={() => start.mutate()}
          >
            {t('pipelinesRuns.dialog.run')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {service ? null : (
          <Field label={t('pipelinesRuns.dialog.service')}>
            <Select
              value={application}
              placeholder={t('pipelinesRuns.dialog.servicePick')}
              options={(services.data?.items ?? []).map((item) => ({
                value: item.key,
                label: item.key,
              }))}
              onChange={(event) => {
                setApplication(event.value);
                setRef(null);
              }}
            />
          </Field>
        )}
        <Field label={t('pipelinesRuns.dialog.pipeline')}>
          <Input value={t('pipelinesRuns.dialog.deliver')} readOnly tone="recessed" />
        </Field>
        {noPipeline ? (
          <span className="text-13 text-tx-2">{t('pipelinesRuns.dialog.noPipeline')}</span>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('pipelinesRuns.dialog.branch')}>
            <Input mono value={ref} onChange={(event) => setRef(event.target.value)} />
          </Field>
          <Field
            label={t('pipelinesRuns.dialog.commit')}
            hint={t('pipelinesRuns.dialog.commitHint')}
            {...(validCommit ? {} : { error: t('pipelinesRuns.dialog.commitInvalid') })}
          >
            <Input mono value={commit} onChange={(event) => setCommit(event.target.value)} />
          </Field>
        </div>
        <ActionError error={start.error} />
      </div>
    </Modal>
  );
}
