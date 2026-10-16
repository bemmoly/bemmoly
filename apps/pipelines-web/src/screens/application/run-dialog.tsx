import { formatNumber, useT } from '@bemmoly/core-web';
import type { RunInputField } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal, Select, Skeleton, Switch, useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState, type KeyboardEvent } from 'react';
import { pipelinesKeys } from '../../api/pipelines.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { api } from '../../lib/api.ts';
import { ActionError } from '../../parts/action-error.tsx';

type Value = string | number | boolean;

function InputControl({
  field,
  value,
  onChange,
}: {
  field: RunInputField;
  value: Value | undefined;
  onChange: (value: Value) => void;
}) {
  if (field.type === 'boolean')
    return <Switch checked={Boolean(value)} onCheckedChange={onChange} aria-label={field.name} />;
  if (field.type === 'choice')
    return (
      <Select
        value={value === undefined ? '' : String(value)}
        options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
        onChange={(event) => onChange(event.value)}
      />
    );
  return (
    <Input
      type={field.type === 'number' ? 'number' : 'text'}
      value={value === undefined ? '' : String(value)}
      onChange={(event) =>
        onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)
      }
    />
  );
}

/**
 * Run pipeline…: the branch and the pipeline's typed inputs as a form, defaults filled in.
 * Mod+Enter runs it from any field; the run opens as soon as it exists.
 */
export function RunDialog({
  application,
  open,
  onClose,
}: {
  application: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const toast = useToast();
  const navigate = useNavigate();
  const client = useQueryClient();
  const pipeline = useQuery({
    queryKey: pipelinesKeys.pipeline(application),
    queryFn: () => api.pipelines.applicationPipeline(application),
    enabled: open,
  });
  // What the person typed, over the pipeline's defaults; nothing is copied out of the query.
  const [refEdit, setRef] = useState<string | null>(null);
  const [edits, setInputs] = useState<Record<string, Value>>({});
  const ref = refEdit ?? pipeline.data?.defaultRef ?? '';
  const inputs: Record<string, Value> = {
    ...Object.fromEntries(
      (pipeline.data?.inputs ?? [])
        .filter((field) => field.default !== null)
        .map((field) => [field.name, field.default as Value]),
    ),
    ...edits,
  };
  const run = useMutation({
    mutationFn: () => api.pipelines.createRun({ application, ref: ref.trim() || 'main', inputs }),
    onSuccess: (created) => {
      void client.invalidateQueries({ queryKey: pipelinesKeys.runs({}).slice(0, 2) });
      toast.show({
        tone: 'ok',
        title: t('pipelines.runDialog.started', { number: formatNumber(created.number) }),
      });
      onClose();
      void navigate({ to: '/runs/$id', params: { id: created.id } });
    },
  });
  const missing = (pipeline.data?.inputs ?? []).some(
    (field) => field.required && (inputs[field.name] === undefined || inputs[field.name] === ''),
  );
  const submit = () => {
    if (!missing && !run.isPending) run.mutate();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('pipelines.runDialog.title', { application })}
      description={t('pipelines.runDialog.description')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('pipelines.common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={run.isPending}
            disabled={missing || !pipeline.data}
          >
            {t('pipelines.runDialog.run')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" onKeyDown={onKeyDown}>
        <ActionError error={run.error} />
        {pipeline.isPending ? (
          <div aria-busy className="flex flex-col gap-3">
            <Skeleton width={120} height={10} />
            <Skeleton width="100%" height={30} />
          </div>
        ) : pipeline.isError ? (
          <ActionError error={pipeline.error} />
        ) : (
          <>
            <Field label={t('pipelines.runDialog.ref')}>
              <Input value={ref} onChange={(event) => setRef(event.target.value)} autoFocus />
            </Field>
            {pipeline.data.inputs.map((field) => (
              <Field key={field.name} label={field.name} hint={field.description ?? undefined}>
                <InputControl
                  field={field}
                  value={inputs[field.name]}
                  onChange={(value) =>
                    setInputs((current) => ({ ...current, [field.name]: value }))
                  }
                />
              </Field>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
