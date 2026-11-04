import { useT } from '@bemmoly/core-web';
import type { PipelineTrigger } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal, SegmentedControl, Tag } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { editorText } from '../../../i18n/catalog.ts';

type Kind = PipelineTrigger['kind'];

/** What starts the pipeline, each removable; none means it runs only when someone presses Run. */
export function TriggersBar({
  triggers,
  onChange,
}: {
  triggers: readonly PipelineTrigger[];
  onChange: (next: PipelineTrigger[]) => void;
}) {
  const t = useT(editorText);
  const [adding, setAdding] = useState(false);
  const words = (trigger: PipelineTrigger) =>
    trigger.kind === 'push'
      ? t('pipelinesEditor.trigger.push', { branch: trigger.branch })
      : trigger.kind === 'pull_request'
        ? t('pipelinesEditor.trigger.pullRequest')
        : t('pipelinesEditor.trigger.schedule', { cron: trigger.cron, zone: trigger.timeZone });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {triggers.length === 0 ? (
        <Tag size="md">{t('pipelinesEditor.trigger.none')}</Tag>
      ) : (
        triggers.map((trigger, index) => (
          <Tag
            key={`${trigger.kind}-${index}`}
            size="md"
            tone="accent"
            onRemove={() => onChange(triggers.filter((_, at) => at !== index))}
            removeLabel={t('pipelinesEditor.trigger.remove', { trigger: words(trigger) })}
          >
            {words(trigger)}
          </Tag>
        ))
      )}
      <Button
        size="sm"
        variant="ghost"
        icon={<Icon name="plus" size={14} />}
        onClick={() => setAdding(true)}
      >
        {t('pipelinesEditor.trigger.add')}
      </Button>
      {adding ? (
        <AddTrigger
          onClose={() => setAdding(false)}
          onAdd={(trigger) => {
            onChange([...triggers, trigger]);
            setAdding(false);
          }}
        />
      ) : null}
    </div>
  );
}

function AddTrigger({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (t: PipelineTrigger) => void;
}) {
  const t = useT(editorText);
  const [kind, setKind] = useState<Kind>('push');
  const [branch, setBranch] = useState('main');
  const [cron, setCron] = useState('0 2 * * *');
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [timeZone, setTimeZone] = useState(zone);
  const valid =
    kind === 'push'
      ? branch.trim().length > 0
      : kind === 'schedule'
        ? /^(\S+\s+){4}\S+$/.test(cron.trim())
        : true;
  const trigger: PipelineTrigger =
    kind === 'push'
      ? { kind, branch: branch.trim() }
      : kind === 'schedule'
        ? { kind, cron: cron.trim(), timeZone }
        : { kind };
  return (
    <Modal
      open
      onClose={onClose}
      title={t('pipelinesEditor.trigger.addTitle')}
      description={t('pipelinesEditor.trigger.addHint')}
      footer={
        <>
          <Button onClick={onClose}>{t('pipelinesEditor.common.cancel')}</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onAdd(trigger)}>
            {t('pipelinesEditor.trigger.addButton')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl<Kind>
          aria-label={t('pipelinesEditor.trigger.kind')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'push', label: t('pipelinesEditor.trigger.kind.push') },
            { value: 'pull_request', label: t('pipelinesEditor.trigger.kind.pullRequest') },
            { value: 'schedule', label: t('pipelinesEditor.trigger.kind.schedule') },
          ]}
        />
        {kind === 'push' ? (
          <Field
            label={t('pipelinesEditor.trigger.branch')}
            hint={t('pipelinesEditor.trigger.branchHint')}
          >
            <Input mono value={branch} onChange={(event) => setBranch(event.target.value)} />
          </Field>
        ) : kind === 'schedule' ? (
          <>
            <Field
              label={t('pipelinesEditor.trigger.cron')}
              hint={t('pipelinesEditor.trigger.cronHint')}
            >
              <Input mono value={cron} onChange={(event) => setCron(event.target.value)} />
            </Field>
            <Field label={t('pipelinesEditor.trigger.timeZone')}>
              <Input value={timeZone} onChange={(event) => setTimeZone(event.target.value)} />
            </Field>
          </>
        ) : (
          <span className="text-13 text-tx-2">{t('pipelinesEditor.trigger.pullRequestHint')}</span>
        )}
      </div>
    </Modal>
  );
}
