import { useShortcutHelp, useT } from '@bemmoly/core-web';
import {
  changeKindSchema,
  changeWindowSchema,
  topicOf,
  type ChangeItem,
  type ChangeKind,
  type ChangeWindow,
} from '@bemmoly/module-pipelines/shared';
import { Button, Menu, MenuItem, SegmentedControl, Skeleton, Switch, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useScope } from '../../hooks/use-scope.ts';
import { useScreenKeys } from '../../hooks/use-screen-keys.ts';
import { useSearchState, useSearchText } from '../../hooks/use-search-state.ts';
import { useChanges, useShippingStream, useShippingWrites } from '../../hooks/use-shipping.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { LoadFailed, refusalOf } from '../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../parts/rows-skeleton.tsx';
import { Panel, Screen } from '../../parts/screen.tsx';
import { ReasonDialog } from '../promote/reason-dialog.tsx';
import { ReleasesTabs } from '../releases/tabs.tsx';
import { useScopeName } from '../screen-frame.tsx';
import { ChangesChart } from './chart.tsx';
import { canRollBack, ChangesList } from './list.tsx';

const WINDOWS = changeWindowSchema.options;
const KINDS = changeKindSchema.options;

/**
 * What changed?: the on-call screen. Every change in the scope and window over the error
 * rate, newest first, the ones just before a rise flagged by timing alone, each deploy
 * rolled back from its row. [ and ] narrow or widen the window; Shift+B rolls back the row.
 */
export default function ChangesScreen() {
  const t = useT(pipelinesText);
  const toast = useToast();
  const { path } = useScope();
  const scopeName = useScopeName();
  const [window, setWindow] = useSearchState<ChangeWindow>('window', WINDOWS, '3h');
  const [prod, setProd] = useSearchText('prod');
  const [kindsText, setKinds] = useSearchText('kinds');
  const kinds = kindsText
    ? (kindsText.split(',').filter((k) => KINDS.includes(k as ChangeKind)) as ChangeKind[])
    : [];
  const changes = useChanges({
    ...(path ? { scope: path } : {}),
    window,
    ...(prod ? { prodOnly: 'true' } : {}),
    ...(kinds.length ? { kinds } : {}),
  });
  useShippingStream([topicOf.map(path)]);
  const { rollback } = useShippingWrites();
  const [focused, setFocused] = useState<ChangeItem | null>(null);
  const [undoing, setUndoing] = useState<ChangeItem | null>(null);
  const step = (by: number) => {
    const next = WINDOWS[WINDOWS.indexOf(window) + by];
    if (next) setWindow(next);
  };
  useShortcutHelp({
    id: 'pipelines.changes',
    label: t('pipelines.changes.title'),
    keys: [
      { keys: '[ ]', label: t('pipelines.keys.window') },
      { keys: 'J K', label: t('pipelines.keys.moveRows') },
      { keys: 'Shift+B', label: t('pipelines.keys.rollBackRow') },
    ],
  });
  useScreenKeys({
    '[': () => step(-1),
    ']': () => step(1),
    'shift+b': () => focused && canRollBack(focused) && setUndoing(focused),
  });
  const toggleKind = (kind: ChangeKind) => {
    const next = kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind];
    setKinds(next.length === KINDS.length ? '' : next.join(','));
  };
  const confirm = (reason: string) => {
    const deployment = undoing?.ref?.id;
    if (!deployment) return;
    rollback.mutate(
      { deployment, body: reason ? { reason } : {} },
      {
        onSuccess: () => {
          setUndoing(null);
          toast.show({ tone: 'ok', title: t('pipelines.canary.rolledBack') });
        },
        onError: (error) =>
          toast.show({
            tone: 'danger',
            title: t('pipelines.canary.rollbackFailed'),
            body: refusalOf(error)?.sentence ?? t('pipelines.common.loadFailed'),
          }),
      },
    );
  };
  const data = changes.data;
  return (
    <Screen
      title={t('pipelines.changes.title')}
      meta={
        data &&
        (scopeName
          ? t('pipelines.changes.counts', {
              total: data.counts.total,
              prod: data.counts.prod,
              scope: scopeName,
            })
          : t('pipelines.changes.countsOnly', { total: data.counts.total, prod: data.counts.prod }))
      }
    >
      <ReleasesTabs />
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          size="sm"
          aria-label={t('pipelines.common.timeRange')}
          options={WINDOWS.map((value) => ({
            value,
            label: t(`pipelines.changes.window.${value}`),
          }))}
          value={window}
          onChange={setWindow}
        />
        <label className="flex items-center gap-2 text-13 text-tx-2">
          <Switch
            size="sm"
            checked={Boolean(prod)}
            onCheckedChange={(on) => setProd(on ? '1' : '')}
          />
          {t('pipelines.changes.prodOnly')}
        </label>
        <Menu
          trigger={(props) => (
            <Button {...props} size="sm" variant="ghost">
              <Icon name="filter" size={14} />
              {kinds.length
                ? t('pipelines.changes.kindsSome', { count: kinds.length })
                : t('pipelines.changes.kindsAll')}
            </Button>
          )}
        >
          {KINDS.map((kind) => (
            <MenuItem
              key={kind}
              kind="checkbox"
              keepOpen
              checked={kinds.length === 0 || kinds.includes(kind)}
              onSelect={() => toggleKind(kind)}
            >
              {t(`pipelines.changeKind.${kind}`)}
            </MenuItem>
          ))}
        </Menu>
      </div>
      {changes.isError && !data ? (
        <LoadFailed error={changes.error} onRetry={() => void changes.refetch()} />
      ) : !data ? (
        <>
          <Skeleton height={190} shape="block" />
          <RowsSkeleton columns={4} rows={6} />
        </>
      ) : (
        <>
          <ChangesChart changes={data} />
          <Panel flush title={t('pipelines.changes.listTitle')}>
            <ChangesList items={data.items} onRollBack={setUndoing} onFocus={setFocused} />
          </Panel>
        </>
      )}
      <ReasonDialog
        open={undoing !== null}
        title={t('pipelines.changes.rollBackTitle', { what: undoing?.summary ?? '' })}
        description={t('pipelines.changes.rollBackDescription')}
        label={t('pipelines.changes.rollBackReason')}
        confirm={t('pipelines.canary.rollBack')}
        danger
        busy={rollback.isPending}
        onClose={() => setUndoing(null)}
        onConfirm={confirm}
      />
    </Screen>
  );
}
