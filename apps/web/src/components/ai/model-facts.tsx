import type { AiCatalogModelEntry, AiRole } from '@bemmoly/shared';
import { Badge } from '@bemmoly/ui';
import { contextLine, priceLine, releaseLine } from '../../lib/ai-format.ts';

/** The capability badges a model earns, in the order admins look for them. */
export function capabilityLabels(model: AiCatalogModelEntry): string[] {
  return [
    model.toolCall ? 'Tool calling' : null,
    model.structuredOutput ? 'Structured output' : null,
    model.reasoning ? 'Reasoning' : null,
    model.attachment ? 'Images' : null,
  ].filter((label): label is string => label !== null);
}

/** One line for a select option: context, price and date, so models compare at a glance. */
export function modelSummary(model: AiCatalogModelEntry, role: AiRole): string {
  return [
    model.suggestedFor.includes(role) ? 'Suggested' : null,
    contextLine(model.contextWindow),
    priceLine(model.inputCostPerMillion, model.outputCostPerMillion),
    releaseLine(model.releaseDate),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * What the chosen model is: its capability badges, context size, price per million tokens
 * and release date. Neutral chips; colour is kept for state.
 */
export function ModelFacts({ model, role }: { model: AiCatalogModelEntry; role: AiRole }) {
  const facts = [
    contextLine(model.contextWindow),
    priceLine(model.inputCostPerMillion, model.outputCostPerMillion),
    releaseLine(model.releaseDate),
  ].filter((fact): fact is string => Boolean(fact));
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-12 text-tx-3 tabular-nums">
      {model.suggestedFor.includes(role) ? <Badge tone="accent">Suggested</Badge> : null}
      {capabilityLabels(model).map((label) => (
        <Badge key={label}>{label}</Badge>
      ))}
      {facts.map((fact) => (
        <span key={fact}>{fact}</span>
      ))}
    </span>
  );
}
