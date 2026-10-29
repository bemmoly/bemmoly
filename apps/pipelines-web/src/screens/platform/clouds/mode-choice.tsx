import { useT } from '@bemmoly/core-web';
import type { CloudConnection } from '@bemmoly/module-pipelines/shared';
import { SelectableCard } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../../i18n/catalog.ts';

export type ConnectionMode = CloudConnection['mode'];

export const MODES: readonly ConnectionMode[] = ['managed', 'attached'];

const WORDS = {
  managed: {
    icon: 'layers',
    title: 'pipelines.clouds.mode.managed',
    hint: 'pipelines.clouds.modeHint.managed',
  },
  attached: {
    icon: 'box',
    title: 'pipelines.clouds.mode.attached',
    hint: 'pipelines.clouds.modeHint.attached',
  },
} as const satisfies Record<ConnectionMode, { icon: IconName; title: string; hint: string }>;

/** How much of the cloud Pipelines controls: it makes the projects, or it uses yours. */
export function ModeChoice({
  value,
  onChange,
}: {
  value: ConnectionMode;
  onChange: (mode: ConnectionMode) => void;
}) {
  const t = useT(pipelinesText);
  return (
    <div
      role="radiogroup"
      aria-label={t('pipelines.clouds.modeLabel')}
      className="grid grid-cols-1 gap-2.5 md:grid-cols-2"
    >
      {MODES.map((mode) => (
        <SelectableCard
          key={mode}
          selected={value === mode}
          onClick={() => onChange(mode)}
          className="gap-1 p-3.5"
        >
          <span className="flex items-center gap-2">
            <Icon name={WORDS[mode].icon} size={16} className="text-tx-2" />
            <span className="font-medium">{t(WORDS[mode].title)}</span>
          </span>
          <span className="text-12 text-tx-2">{t(WORDS[mode].hint)}</span>
        </SelectableCard>
      ))}
    </div>
  );
}
