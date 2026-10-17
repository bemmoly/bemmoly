import { useT } from '@bemmoly/core-web';
import type { CurrentState, GlyphState, Runtime, Tier } from '@bemmoly/module-pipelines/shared';
import { Badge, EntityTile, entityHue, RunGlyph, type RunGlyphSize } from '@bemmoly/ui';
import { pipelinesText } from '../i18n/catalog.ts';

/*
 * Small marks every Pipelines screen draws the same way: a tier, an owning team, a state.
 * Built from @bemmoly/ui parts so a run or an application reads alike everywhere.
 */

export function TierBadge({ tier }: { tier: Tier }) {
  const t = useT(pipelinesText);
  return (
    <Badge tone="outline" className="font-mono" aria-label={t(`pipelines.tier.${tier}`)}>
      {t('pipelines.tierShort', { tier })}
    </Badge>
  );
}

/** A team is a square tile on its name's hue (people get round avatars, teams never do). */
export function TeamMark({ name, size = 18 }: { name: string; size?: number }) {
  return <EntityTile name={name} hue={entityHue(name)} size={size} />;
}

/** A run or station state with its word for assistive tech. */
export function StateGlyph({ state, size = 14 }: { state: GlyphState; size?: RunGlyphSize }) {
  const t = useT(pipelinesText);
  return <RunGlyph state={state} size={size} label={t(`pipelines.state.${state}`)} />;
}

/** The glyph a materialised environment state draws. */
export function currentGlyph(state: CurrentState | null): GlyphState {
  switch (state) {
    case 'deploying':
    case 'canary':
      return 'running';
    case 'waiting':
      return 'waiting';
    case 'failed':
      return 'failed';
    case 'rolled_back':
      return 'rolled_back';
    case 'idle':
      return 'passed';
    default:
      return 'queued';
  }
}

/** Runtimes as their catalog ids: ids take no dashes. */
export const RUNTIME_WORD = {
  'container-service': 'pipelines.runtime.containerService',
  kubernetes: 'pipelines.runtime.kubernetes',
  function: 'pipelines.runtime.function',
  'static-site': 'pipelines.runtime.staticSite',
} as const satisfies Record<Runtime, string>;
