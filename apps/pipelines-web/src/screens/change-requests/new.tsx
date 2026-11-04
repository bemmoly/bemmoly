import { useGlobalKeys, useT } from '@bemmoly/core-web';
import type { ChangeRisk } from '@bemmoly/module-pipelines/shared';
import {
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Kbd,
  SegmentedControl,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link, useNavigate } from '@tanstack/react-router';
import { changeRequestsText } from '../../i18n/catalog.ts';
import { LoadFailed, refusalOf } from '../../parts/load-failed.tsx';
import { ScreenFrame } from '../screen-frame.tsx';
import { ApproverPicker, VersionsField } from './new-parts.tsx';
import { useChangeRequestWrites } from './use-change-requests.ts';
import { useNewChange } from './use-new-change.ts';
import { windowWords } from './words.ts';

const RISKS: readonly ChangeRisk[] = ['low', 'medium', 'high'];

/**
 * A new change request, or a draft being edited: the versions that move, why, the risk, when,
 * the rollback plan, and the people who approve, picked by the person asking. Send is off
 * until every step has as many people as it needs (Mod+Enter sends).
 */
export default function NewChangeRequestScreen() {
  const t = useT(changeRequestsText);
  const toast = useToast();
  const navigate = useNavigate();
  const writes = useChangeRequestWrites();
  const state = useNewChange();
  const { form, set, options, steps } = state;
  const busy = writes.create.isPending || writes.update.isPending || writes.send.isPending;
  const failed = (error: unknown) =>
    toast.show({
      tone: 'danger',
      title: t('pipelinesChangeRequests.new.failed'),
      body: refusalOf(error)?.sentence ?? (error instanceof Error ? error.message : ''),
    });
  const opened = (number: string, sent: boolean) => {
    toast.show({
      tone: 'ok',
      title: t(sent ? 'pipelinesChangeRequests.actions.sent' : 'pipelinesChangeRequests.new.saved'),
    });
    void navigate({ to: '/changes/$number', params: { number } });
  };
  const submit = (send: boolean) => {
    if (busy || (send && !state.ready)) return;
    const body = state.body(send);
    if (state.editNumber) {
      const { title, why, risk, when, rollback, items, picks } = body;
      writes.update.mutate(
        { number: state.editNumber, body: { title, why, risk, when, rollback, items, picks } },
        {
          onSuccess: (saved) =>
            send
              ? writes.send.mutate(saved.number, {
                  onSuccess: () => opened(saved.number, true),
                  onError: failed,
                })
              : opened(saved.number, false),
          onError: failed,
        },
      );
      return;
    }
    writes.create.mutate(body, {
      onSuccess: (created) => opened(created.number, send),
      onError: failed,
    });
  };
  useGlobalKeys({ 'mod+Enter': () => submit(true) });

  const title = state.editNumber
    ? t('pipelinesChangeRequests.new.editTitle', { number: state.editNumber })
    : t('pipelinesChangeRequests.new.title');
  const crumbs = [
    {
      label: t('pipelinesChangeRequests.list.title'),
      href: '/changes',
      linkProps: { to: '/changes' },
    },
    { label: title },
  ];
  const frame = (body: React.ReactNode) => (
    <ScreenFrame
      title={title}
      heading={
        <div className="flex flex-col gap-1.5">
          <Breadcrumbs items={crumbs} linkAs={Link} />
          <h1 className="text-20 leading-title font-semibold text-tx">{title}</h1>
        </div>
      }
    >
      {body}
    </ScreenFrame>
  );
  if (state.optionsQuery.isError) {
    return frame(
      <LoadFailed
        error={state.optionsQuery.error}
        onRetry={() => void state.optionsQuery.refetch()}
      />,
    );
  }
  if (!options) return frame(<Skeleton className="h-96 w-full" />);
  const env = options.environment.name;
  const ruled = options.environments.filter((e) => e.needsChangeRequest);
  if (ruled.length === 0 || !options.needsChangeRequest) {
    return frame(
      <div className="rounded-card border border-line bg-card py-12">
        <EmptyState
          icon={<Icon name="checklist" size={18} />}
          title={t('pipelinesChangeRequests.new.noRuleTitle', { name: env })}
          description={t('pipelinesChangeRequests.new.noRule')}
          headingLevel={2}
        />
      </div>,
    );
  }
  return frame(
    <>
      <p className="-mt-2 max-w-3xl text-13 text-tx-2">
        {t('pipelinesChangeRequests.new.lead', { name: env })}
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-4 p-4">
          <Field label={t('pipelinesChangeRequests.new.titleField')}>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label={t('pipelinesChangeRequests.new.to')}>
            <Select
              value={form.environment}
              options={ruled.map((e) => ({ value: e.key, label: e.name }))}
              onChange={(event) => state.chooseEnvironment(event.value)}
            />
          </Field>
          <VersionsField
            services={options.services}
            items={form.items}
            environment={env}
            previous={options.previousEnvironment?.name ?? null}
            gated={options.versionsAllowed === 'passed_previous'}
            onChange={state.toggleVersion}
          />
          <Field label={t('pipelinesChangeRequests.new.why')}>
            <Textarea rows={4} value={form.why} onChange={(e) => set('why', e.target.value)} />
          </Field>
          <Field
            label={t('pipelinesChangeRequests.new.risk')}
            hint={t('pipelinesChangeRequests.new.riskHint')}
          >
            <SegmentedControl
              aria-label={t('pipelinesChangeRequests.new.risk')}
              options={RISKS.map((risk) => ({
                value: risk,
                label: t(`pipelinesChangeRequests.riskWord.${risk}`),
              }))}
              value={form.risk}
              onChange={(risk) => set('risk', risk)}
            />
          </Field>
          <Field
            label={t('pipelinesChangeRequests.new.when')}
            hint={t('pipelinesChangeRequests.new.whenHint', {
              window: windowWords(options.window, t),
            })}
          >
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                aria-label={t('pipelinesChangeRequests.new.when')}
                options={[
                  { value: 'asap', label: t('pipelinesChangeRequests.when.asap') },
                  { value: 'at', label: t('pipelinesChangeRequests.new.atTime') },
                ]}
                value={form.whenKind}
                onChange={(kind) => set('whenKind', kind as 'asap' | 'at')}
              />
              {form.whenKind === 'at' ? (
                <Input
                  type="datetime-local"
                  aria-label={t('pipelinesChangeRequests.new.atTime')}
                  value={form.at}
                  onChange={(e) => set('at', e.target.value)}
                  className="w-56"
                />
              ) : null}
            </div>
          </Field>
          <Field label={t('pipelinesChangeRequests.new.rollback')}>
            <Textarea
              rows={2}
              value={form.rollback}
              placeholder={t('pipelinesChangeRequests.new.rollbackPlaceholder')}
              onChange={(e) => set('rollback', e.target.value)}
            />
          </Field>
        </Card>
        <div className="flex min-w-0 flex-col gap-4">
          <ApproverPicker
            steps={steps}
            environment={env}
            picked={state.picked}
            onToggle={state.togglePick}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              disabled={
                !form.title.trim() || !form.why.trim() || Object.keys(form.items).length === 0
              }
              loading={busy}
              onClick={() => submit(false)}
            >
              {t('pipelinesChangeRequests.new.saveDraft')}
            </Button>
            <Button
              variant="primary"
              disabled={!state.ready}
              loading={busy}
              onClick={() => submit(true)}
              iconEnd={
                <span className="hidden md:inline-flex">
                  <Kbd keys="Mod+Enter" />
                </span>
              }
            >
              {state.missing > 0
                ? t('pipelinesChangeRequests.new.pickToSend', { count: state.missing })
                : t('pipelinesChangeRequests.actions.send')}
            </Button>
          </div>
        </div>
      </div>
    </>,
  );
}
