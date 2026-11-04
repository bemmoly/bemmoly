import { useT } from '@bemmoly/core-web';
import type { BuiltInTemplateSummary } from '@bemmoly/module-pipelines/shared';
import { editorText } from '../../i18n/catalog.ts';

/** A template's groups of steps, one box per group, and what it leaves out. */
export function TemplateGroups({ template }: { template: BuiltInTemplateSummary }) {
  const t = useT(editorText);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2.5">
        {template.groups.map((group) => (
          <div
            key={`${group.name}-${group.environment ?? ''}`}
            className="flex min-w-36 flex-col gap-1.5 rounded-card border border-line bg-sunken px-3 py-2"
          >
            <span className="text-12 font-semibold text-tx-2">{group.name}</span>
            {group.steps.map((step) => (
              <span
                key={step}
                className="rounded-chip border border-line bg-card px-2 py-1 text-12 text-tx"
              >
                {step}
              </span>
            ))}
          </div>
        ))}
      </div>
      {template.leftOut.length > 0 ? (
        <span className="text-12 text-tx-3">
          {t('pipelinesEditor.template.leftOut', { names: template.leftOut.join(', ') })}
        </span>
      ) : null}
    </div>
  );
}
