import { ApiError } from '@bemmoly/api-client';
import { useT } from '@bemmoly/core-web';
import type { Policy } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal, Switch, Textarea, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { usePolicyWrites } from '../../../hooks/use-access.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { refusalOf } from '../../../parts/load-failed.tsx';
import { ApprovalRules, type ApprovalRule } from './approval-rules.tsx';

const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * A policy edited as its parts: what it applies to (CEL), who may request, the approvals and
 * gates it asks for, the window and when it denies outright. A change to a policy that
 * touches Tier 0 waits for a second Platform admin; the toast says so.
 */
export function PolicyEditor({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const t = useT(pipelinesText);
  const toast = useToast();
  const { update } = usePolicyWrites();
  const requirements = policy.requirements;
  const [name, setName] = useState(policy.name);
  const [applies, setApplies] = useState(policy.applies);
  const [requester, setRequester] = useState(requirements.requester ?? '');
  const [approvals, setApprovals] = useState<ApprovalRule[]>(requirements.approvals);
  const [gates, setGates] = useState(requirements.gates.join('\n'));
  const [window, setWindow] = useState(requirements.window ?? '');
  const [denyIf, setDenyIf] = useState(requirements.denyIf ?? '');
  const [enabled, setEnabled] = useState(policy.enabled);
  const error = update.error
    ? (refusalOf(update.error)?.sentence ??
      (update.error instanceof ApiError ? update.error.message : t('pipelines.common.loadFailed')))
    : null;
  const save = () =>
    update.mutate(
      {
        id: policy.id,
        body: {
          name: name.trim(),
          applies: applies.trim(),
          enabled,
          requirements: {
            ...(requester.trim() ? { requester: requester.trim() } : {}),
            approvals,
            gates: lines(gates),
            ...(window.trim() ? { window: window.trim() } : {}),
            ...(denyIf.trim() ? { denyIf: denyIf.trim() } : {}),
          },
        },
      },
      {
        onSuccess: (saved) => {
          toast.show({
            tone: 'ok',
            title: saved.pending
              ? t('pipelines.policy.waiting', { name: saved.name })
              : t('pipelines.policy.saved', { name: saved.name, version: saved.version }),
          });
          onClose();
        },
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={t('pipelines.policy.editTitle', { name: policy.name })}
      description={t('pipelines.policy.editDescription', { version: policy.version })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('pipelines.common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !applies.trim()}
            loading={update.isPending}
            onClick={save}
          >
            {t('pipelines.policy.save')}
          </Button>
        </>
      }
    >
      <div
        className="flex flex-col gap-3.5"
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) save();
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label={t('pipelines.policy.name')}>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <label className="flex h-control items-center gap-2 text-13 text-tx">
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label={t('pipelines.policy.enabled')}
            />
            {t('pipelines.policy.enabled')}
          </label>
        </div>
        <Field label={t('pipelines.policy.applies')} hint={t('pipelines.policy.appliesHint')}>
          <Input
            className="font-mono"
            value={applies}
            onChange={(event) => setApplies(event.target.value)}
          />
        </Field>
        <Field label={t('pipelines.policy.requester')} hint={t('pipelines.policy.requesterHint')}>
          <Input
            className="font-mono"
            value={requester}
            onChange={(event) => setRequester(event.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-13 font-medium text-tx">{t('pipelines.policy.approvals')}</span>
          <ApprovalRules rules={approvals} onChange={setApprovals} />
        </div>
        <Field label={t('pipelines.policy.gates')} hint={t('pipelines.policy.gatesHint')}>
          <Textarea
            className="font-mono"
            rows={4}
            value={gates}
            onChange={(event) => setGates(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('pipelines.policy.window')} hint={t('pipelines.policy.windowHint')}>
            <Input value={window} onChange={(event) => setWindow(event.target.value)} />
          </Field>
          <Field label={t('pipelines.policy.denyIf')} hint={t('pipelines.policy.denyIfHint')}>
            <Input
              className="font-mono"
              value={denyIf}
              onChange={(event) => setDenyIf(event.target.value)}
            />
          </Field>
        </div>
        {error && (
          <p role="alert" className="rounded-control bg-red-50 px-3 py-2 text-12 text-red-tx">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
