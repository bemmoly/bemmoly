import { RichTextEditor, type RichTextDoc } from '@bemmoly/editor';
import type { RichText } from '@bemmoly/module-work/shared';
import { Kbd } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useEditorSources } from '../hooks/editor-sources.ts';
import type { useCreateIssue } from '../hooks/create-issue.ts';
import type { LayoutField } from '../hooks/issue-fields.ts';
import { cx } from '../issue/cx.ts';

type Form = ReturnType<typeof useCreateIssue>;

/** One empty checklist item: the shape a criteria section starts from. */
const CHECKLIST: RichTextDoc = {
  type: 'doc',
  content: [
    {
      type: 'taskList',
      content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }],
    },
  ],
};

const isChecklist = (name: string) => /criteria|checklist|checks/i.test(name);

const plural = (name: string) => {
  const word = name.toLowerCase();
  if (/s$/.test(word)) return word;
  return /[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`;
};

interface CreateBodyProps {
  form: Form;
  /** The chosen type's name, for "Required for stories". */
  typeName: string | undefined;
  onSubmit: () => void;
}

/**
 * Title and description first, as the review draws them: a borderless 20px title, the issue
 * page's own editor (with / for blocks), then the type's document fields as bordered
 * sections that say when and why they are required.
 */
export function CreateBody({ form, typeName, onSubmit }: CreateBodyProps) {
  const { draft, set, setCustom, errors, layout } = form;
  const sources = useEditorSources();
  const documents = layout.rows.filter(
    (row) => row.column === null && row.field.kind === 'richtext',
  );
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col">
        <span className="sr-only">Title</span>
        <textarea
          data-autofocus
          rows={1}
          value={draft.title}
          placeholder="Issue title"
          aria-invalid={Boolean(errors['title']) || undefined}
          aria-describedby={errors['title'] ? 'create-title-error' : undefined}
          onChange={(event) => set('title', event.target.value.replace(/\n/g, ' '))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) event.preventDefault();
          }}
          className="field-sizing-content m-0 min-h-7 w-full resize-none border-0 bg-transparent p-0 font-sans text-20 leading-title font-semibold tracking-title text-tx outline-0 placeholder:text-tx-3"
        />
      </label>
      {errors['title'] && (
        <p id="create-title-error" role="alert" className="m-0 text-12 text-red-tx">
          {errors['title']}
        </p>
      )}
      <RichTextEditor
        key={`description-${form.round}`}
        label="Description"
        placeholder="Add a description, or press / for blocks…"
        initialDoc={draft.description as RichTextDoc | null}
        blocks
        size="page"
        sources={sources}
        contentClassName="min-h-21"
        onChange={(doc) => set('description', doc as RichText | null)}
        onSubmit={onSubmit}
      >
        {({ content }) => <div className="mt-1">{content}</div>}
      </RichTextEditor>
      {errors['description'] && (
        <p role="alert" className="m-0 text-12 text-red-tx">
          {errors['description']}
        </p>
      )}
      {documents.map((row) => (
        <DocumentSection
          key={`${row.field.id}-${form.round}`}
          row={row}
          typeName={typeName}
          error={errors[`customFields.${row.field.key}`]}
          value={draft.custom[row.field.key]}
          onChange={(doc) => setCustom(row.field.key, doc)}
          onSubmit={onSubmit}
        />
      ))}
    </div>
  );
}

interface DocumentSectionProps {
  row: LayoutField;
  typeName: string | undefined;
  error: string | undefined;
  value: unknown;
  onChange: (doc: RichText | null) => void;
  onSubmit: () => void;
}

/** "Acceptance criteria · Required for stories", as a checklist in its own box. */
function DocumentSection({
  row,
  typeName,
  error,
  value,
  onChange,
  onSubmit,
}: DocumentSectionProps) {
  const sources = useEditorSources();
  const { field, required } = row;
  const checklist = isChecklist(field.name);
  const start =
    value && typeof value === 'object' ? (value as RichTextDoc) : checklist ? CHECKLIST : null;
  return (
    <section
      aria-label={field.name}
      className={cx('mt-1 rounded-card border px-3 py-2.5', error ? 'border-red' : 'border-line')}
    >
      <div className="flex items-center gap-2 text-13">
        <Icon name={checklist ? 'checklist' : 'lines'} size={14} className="text-tx-3" />
        <b className="font-semibold">{field.name}</b>
        {required && (
          <span className="rounded-chip bg-amber-50 px-1.5 py-0.5 text-11 font-medium text-amber-tx">
            Required{typeName ? ` for ${plural(typeName)}` : ''}
          </span>
        )}
      </div>
      <RichTextEditor
        label={field.name}
        placeholder={checklist ? 'Add the first check…' : `Add ${field.name.toLowerCase()}…`}
        initialDoc={start}
        blocks
        size="comment"
        sources={sources}
        contentClassName="min-h-6 pl-5.5"
        onChange={(doc) => onChange(doc as RichText | null)}
        onSubmit={onSubmit}
      >
        {({ content }) => <div className="mt-1.5">{content}</div>}
      </RichTextEditor>
      {error && (
        <p role="alert" className="m-0 mt-1 pl-5.5 text-12 text-red-tx">
          {error}
        </p>
      )}
      {checklist && (
        <p className="m-0 mt-1 hidden pl-5.5 text-11 text-tx-3 sm:block">
          <Kbd keys="Enter" variant="plain" /> adds a check
        </p>
      )}
    </section>
  );
}
