import { formatDate, useGlobalKeys, useShortcutHelp, useT } from '@bemmoly/core-web';
import { Button, Kbd, RelativeTime, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { useMe } from '../../hooks/use-me.ts';
import { useScreenKeys } from '../../hooks/use-screen-keys.ts';
import { useShippingWrites } from '../../hooks/use-shipping.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { refusalOf } from '../../parts/load-failed.tsx';
import { OPEN_STATES } from '../../parts/promotion-state.ts';
import { ReasonDialog } from './reason-dialog.tsx';
import type { RolloutChoice } from './rollout-card.tsx';
import type { PromoteView } from './use-promote.ts';

/**
 * The decision at the foot of the screen. Before a request: what approvers will see and when
 * it expires, then Request approval (Mod+Enter). On a request: Approve (A) or Reject for an
 * approver, Cancel for the person who asked, and a freeze override for a Release manager.
 */
export function DecisionBar({
  view,
  to,
  choice,
  onRequested,
  onBack,
}: {
  view: PromoteView;
  to: string;
  choice: RolloutChoice;
  onRequested: (id: string) => void;
  onBack: () => void;
}) {
  const t = useT(pipelinesText);
  const toast = useToast();
  const me = useMe().data?.user.id;
  const writes = useShippingWrites();
  const [dialog, setDialog] = useState<'reject' | 'freeze' | null>(null);
  const failed = (title: string) => (error: unknown) =>
    toast.show({
      tone: 'danger',
      title,
      body: refusalOf(error)?.sentence ?? t('pipelines.common.loadFailed'),
    });
  const promotion = view.promotion;
  const needsApproval = view.requirements.length > 0;
  const time = (iso: string) => formatDate(iso, { hour: '2-digit', minute: '2-digit' });
  const request = () => {
    if (!view.preview?.request.allowed || writes.request.isPending) return;
    writes.request.mutate(
      {
        release: view.release.id,
        to,
        mode: choice.departure ? 'train' : needsApproval ? 'approval' : 'continuous',
        ...(choice.departure ? { departure: choice.departure } : {}),
        ...(choice.autoRollback !== view.plan.autoRollback
          ? { plan: { autoRollback: choice.autoRollback } }
          : {}),
      },
      {
        onSuccess: ({ id }) => onRequested(id),
        onError: failed(t('pipelines.promote.requestFailed')),
      },
    );
  };
  const canApprove =
    promotion?.state === 'awaiting_approval' &&
    view.requirements.some((requirement) => requirement.canApprove);
  const decide = (decision: 'approved' | 'rejected', comment?: string) => {
    if (!promotion) return;
    writes.decide.mutate(
      {
        id: promotion.id,
        body: {
          decision,
          releaseDigest: promotion.release.digest,
          ...(comment ? { comment } : {}),
        },
      },
      {
        onSuccess: () => {
          setDialog(null);
          toast.show({
            tone: 'ok',
            title: t(
              decision === 'approved' ? 'pipelines.promote.approved' : 'pipelines.promote.rejected',
              { application: view.application.name, version: view.release.version },
            ),
          });
        },
        onError: failed(t('pipelines.promote.decideFailed')),
      },
    );
  };
  useGlobalKeys({ 'mod+enter': () => (promotion ? undefined : request()) });
  useScreenKeys({ a: () => (canApprove ? decide('approved') : undefined) });
  useShortcutHelp({
    id: 'pipelines.promote',
    label: t('pipelines.promote.title'),
    keys: [
      { keys: 'Mod+Enter', label: t('pipelines.promote.requestApproval') },
      { keys: 'A', label: t('pipelines.promote.approve') },
      { keys: 'Shift+B', label: t('pipelines.keys.rollBackCanary') },
    ],
  });
  const open = promotion !== null && OPEN_STATES.has(promotion.state);
  const mine = promotion?.requestedBy?.id === me;
  const frozen = view.gates.some((gate) => gate.gate === 'freeze' && gate.state === 'fail');
  const refusal = view.preview && !view.preview.request.allowed ? view.preview.request : null;
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3.5 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-12">
        {refusal ? (
          <p role="alert" className="text-red-tx">
            {refusal.sentence} {refusal.askWho?.label}
          </p>
        ) : promotion ? (
          <p className="text-tx-2">
            {t(`pipelines.promotionState.${promotion.state}`)}
            {' · '}
            {promotion.requestedBy
              ? t('pipelines.promote.requestedBy', { name: promotion.requestedBy.name })
              : t('pipelines.releases.automatic')}{' '}
            <RelativeTime iso={promotion.createdAt} />
            {open && promotion.expiresAt
              ? ` · ${t('pipelines.promote.expiresAt', { time: time(promotion.expiresAt) })}`
              : ''}
          </p>
        ) : (
          <p className="text-tx-2">
            {needsApproval
              ? view.expiresAt
                ? t('pipelines.promote.requestNoteExpires', { time: time(view.expiresAt) })
                : t('pipelines.promote.requestNote')
              : t('pipelines.promote.goesNow')}
          </p>
        )}
        {promotion?.outcomeReason && <p className="text-tx-3">{promotion.outcomeReason}</p>}
        {promotion?.freezeOverride && (
          <p className="text-amber-tx">
            {t('pipelines.promote.freezeOverridden', {
              name: promotion.freezeOverride.by.name,
              reason: promotion.freezeOverride.reason,
            })}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!promotion && (
          <>
            <Button variant="ghost" onClick={onBack}>
              {t('pipelines.common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={Boolean(refusal)}
              loading={writes.request.isPending}
              onClick={request}
            >
              {t(
                needsApproval
                  ? 'pipelines.promote.requestApproval'
                  : 'pipelines.promote.promoteNow',
              )}
              <span className="hidden md:inline-flex">
                <Kbd keys="Mod+Enter" />
              </span>
            </Button>
          </>
        )}
        {open && frozen && (
          <Button variant="secondary" onClick={() => setDialog('freeze')}>
            {t('pipelines.promote.overrideFreeze')}
          </Button>
        )}
        {open && mine && (
          <Button
            variant="ghost"
            loading={writes.cancel.isPending}
            onClick={() =>
              promotion &&
              writes.cancel.mutate(
                { id: promotion.id },
                { onError: failed(t('pipelines.promote.cancelFailed')) },
              )
            }
          >
            {t('pipelines.promote.cancelRequest')}
          </Button>
        )}
        {canApprove && (
          <>
            <Button variant="secondary" onClick={() => setDialog('reject')}>
              {t('pipelines.promote.reject')}
            </Button>
            <Button
              variant="primary"
              loading={writes.decide.isPending}
              onClick={() => decide('approved')}
            >
              {t('pipelines.promote.approve')}
              <span className="hidden md:inline-flex">
                <Kbd keys="A" />
              </span>
            </Button>
          </>
        )}
      </div>
      <ReasonDialog
        open={dialog === 'reject'}
        title={t('pipelines.promote.rejectTitle', { version: view.release.version })}
        description={t('pipelines.promote.rejectDescription')}
        label={t('pipelines.promote.rejectReason')}
        confirm={t('pipelines.promote.reject')}
        danger
        busy={writes.decide.isPending}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => decide('rejected', reason)}
      />
      <ReasonDialog
        open={dialog === 'freeze'}
        title={t('pipelines.promote.freezeTitle')}
        description={t('pipelines.promote.freezeDescription')}
        label={t('pipelines.promote.freezeReason')}
        confirm={t('pipelines.promote.overrideFreeze')}
        minLength={10}
        busy={writes.overrideFreeze.isPending}
        onClose={() => setDialog(null)}
        onConfirm={(reason) =>
          promotion &&
          writes.overrideFreeze.mutate(
            { id: promotion.id, reason },
            {
              onSuccess: () => setDialog(null),
              onError: failed(t('pipelines.promote.freezeFailed')),
            },
          )
        }
      />
    </div>
  );
}
