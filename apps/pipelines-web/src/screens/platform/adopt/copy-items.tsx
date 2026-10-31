import { useT } from '@bemmoly/core-web';
import type {
  CopyApplication,
  CopyItem,
  CopyPlan,
  CopySecretMode,
} from '@bemmoly/module-pipelines/shared';
import { Checkbox, SegmentedControl } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { RUNTIME_NAME } from '../../../parts/runtime-words.ts';
import { FIELD_LABEL } from '../../application/settings/fields.ts';
import type { CopyDraft } from './draft.ts';

/** A value before and after, with the arrow drawn and the word "to" for screen readers. */
function Change({ before, after }: { before: string; after: string }) {
  const t = useT(pipelinesText);
  return (
    <span className="flex min-w-0 items-center gap-1.5 font-mono text-12">
      <span className="truncate text-tx-3">{before}</span>
      <Icon name="arrow" size={12} className="shrink-0 text-tx-3" />
      <span className="sr-only">{t('pipelines.copy.to')}</span>
      <span className="truncate text-tx">{after}</span>
    </span>
  );
}

/**
 * One application's items in the copy plan, each with its tick: variables before and after,
 * each secret with how it travels, and each setting as the target's next deploy would use it
 * before and after. A setting the target's runtime lacks is shown dropped, without a tick.
 */
export function CopyItems({
  plan,
  app,
  draft,
  onTick,
  onMode,
}: {
  plan: CopyPlan;
  app: CopyApplication;
  draft: CopyDraft;
  onTick: (id: string, on: boolean) => void;
  onMode: (id: string, mode: CopySecretMode) => void;
}) {
  const t = useT(pipelinesText);
  const none = t('pipelines.copy.unset');
  const label = (item: CopyItem) =>
    item.kind === 'setting' ? t(FIELD_LABEL[item.field]) : item.name;
  return (
    <section
      aria-label={app.application.key}
      className="flex flex-col gap-2 rounded-card border border-line bg-card p-3"
    >
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 className="font-mono text-13 font-medium text-tx">{app.application.key}</h3>
        <span className="text-12 text-tx-3">
          {t('pipelines.copy.runtimes', {
            from: t(RUNTIME_NAME[app.runtime.from]),
            to: t(RUNTIME_NAME[app.runtime.to]),
          })}
        </span>
        {app.same > 0 && (
          <span className="text-12 text-tx-3">{t('pipelines.copy.same', { count: app.same })}</span>
        )}
      </header>
      {app.items.length === 0 ? (
        <p className="text-12 text-tx-2">{t('pipelines.copy.nothingHere')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {app.items.map((item) => (
            <li key={item.id} className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <Checkbox
                  size="sm"
                  checked={draft.ticked.has(item.id)}
                  disabled={item.kind === 'setting' && !item.applies}
                  label={
                    <span className={item.kind === 'setting' ? 'text-tx' : 'font-mono text-tx'}>
                      {label(item)}
                    </span>
                  }
                  aria-label={t('pipelines.copy.tick', {
                    name: label(item),
                    application: app.application.key,
                  })}
                  onChange={(event) => onTick(item.id, event.target.checked)}
                />
                {item.kind === 'variable' && (
                  <Change before={item.before ?? none} after={item.after} />
                )}
                {item.kind === 'setting' && item.applies && (
                  <Change before={String(item.before ?? none)} after={String(item.after ?? none)} />
                )}
                {item.kind === 'secret' && (
                  <span className="flex min-w-0 items-center gap-1.5 text-12 text-tx-2">
                    <Icon name="lock" size={12} />
                    <span className="truncate">{item.location}</span>
                  </span>
                )}
              </div>
              {item.kind === 'secret' && item.location && (
                <SegmentedControl
                  size="sm"
                  aria-label={t('pipelines.copy.secretHow', {
                    name: item.name,
                    environment: plan.to.name,
                  })}
                  value={draft.modes.get(item.id) ?? item.mode}
                  options={[
                    { value: 'needs-value', label: t('pipelines.copy.needsValue') },
                    { value: 'copy', label: t('pipelines.copy.copyValue') },
                  ]}
                  onChange={(mode) => onMode(item.id, mode)}
                  className="self-start"
                />
              )}
              {item.kind === 'variable' && item.reference && (
                <span className="text-12 text-tx-3">{t('pipelines.copy.referenceHint')}</span>
              )}
              {item.kind === 'setting' && item.note === 'dropped' && (
                <span className="text-12 text-tx-3">
                  {t('pipelines.copy.dropped', { runtime: t(RUNTIME_NAME[app.runtime.to]) })}
                </span>
              )}
              {item.kind === 'setting' && item.note === 'keeps-default' && (
                <span className="text-12 text-tx-3">
                  {t('pipelines.copy.keepsDefault', {
                    environment: plan.to.name,
                    value: String(item.before ?? none),
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
