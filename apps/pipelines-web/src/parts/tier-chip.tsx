import { useT } from '@bemmoly/core-web';
import { pipelinesText } from '../i18n/catalog.ts';

/** "T0": an application's or a policy's tier, drawn as a quiet outlined key. */
export function TierChip({ tier }: { tier: number | null }) {
  const t = useT(pipelinesText);
  if (tier === null) return null;
  return (
    <span className="shrink-0 rounded-chip border border-line px-1 font-mono text-11 text-tx-2">
      {t('pipelines.common.tierShort', { tier })}
    </span>
  );
}
