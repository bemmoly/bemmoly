import { isEmptyDoc, RichTextView, type RichTextDoc } from '@bemmoly/editor';
import type { OrgTemplate, TemplateDetail } from '@bemmoly/module-docs/shared';
import { RelativeTime, SettingsValue, SettingsValues } from '@bemmoly/ui';
import { fieldSummary } from './fields-editor.tsx';
import { categoryLabel } from './templates-table.tsx';

const SUBHEAD = 'm-0 text-12 font-semibold text-tx-2';

/**
 * A template as the people who manage it check it: where it sits in the picker, how much it is
 * used, the fields its page form asks for, and its body exactly as a new page would show it.
 */
export function TemplateRead({
  template,
  row,
}: {
  template: TemplateDetail;
  row: OrgTemplate | undefined;
}) {
  const body = template.snapshot as RichTextDoc;
  return (
    <div className="flex flex-col gap-5">
      <SettingsValues>
        <SettingsValue label="Category" muted={!template.category}>
          {categoryLabel(template.category)}
        </SettingsValue>
        {row && (
          <SettingsValue label="Used by">
            <span className="tabular-nums">
              {row.usedBy === 1 ? '1 page' : `${row.usedBy} pages`}
            </span>
          </SettingsValue>
        )}
        <SettingsValue label="Added">
          {template.isBuiltin ? (
            'With Bemmoly'
          ) : (
            <span>
              {row?.createdBy ? `${row.createdBy.name}, ` : ''}
              <RelativeTime iso={template.createdAt} />
            </span>
          )}
        </SettingsValue>
        {row?.archivedAt && (
          <SettingsValue label="Archived" hint="Hidden from every template picker until restored.">
            <RelativeTime iso={row.archivedAt} />
          </SettingsValue>
        )}
      </SettingsValues>
      <section aria-label="Page form fields" className="flex flex-col gap-2">
        <h3 className={SUBHEAD}>Fields the page form asks for</h3>
        {template.fields.length === 0 ? (
          <p className="m-0 text-13 text-tx-3">None. A new page starts with the body only.</p>
        ) : (
          <SettingsValues>
            {template.fields.map((field) => (
              <SettingsValue key={field.key} label={field.label}>
                {fieldSummary(field)}
              </SettingsValue>
            ))}
          </SettingsValues>
        )}
      </section>
      <section aria-label="Preview" className="flex flex-col gap-2">
        <h3 className={SUBHEAD}>Preview</h3>
        <div className="rounded-control border border-line px-5 py-4">
          {isEmptyDoc(body) ? (
            <p className="m-0 text-13 text-tx-3">The body is empty.</p>
          ) : (
            <RichTextView doc={body} size="doc" />
          )}
        </div>
      </section>
    </div>
  );
}
