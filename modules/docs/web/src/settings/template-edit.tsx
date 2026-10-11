import { DocEditor } from '@bemmoly/editor';
import { Button, Field, FormGrid, FormGridItem, Input, Textarea } from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import { DocPopover } from '../page/body/doc-popover.tsx';
import { PageIconPicker } from '../page/body/page-icon-picker.tsx';
import { FieldsEditor } from './fields-editor.tsx';
import type { TemplateForm } from './use-template-form.ts';

const SUBHEAD = 'm-0 text-12 font-semibold text-tx-2';

/**
 * The template's editable parts inside its section: name, icon, category and description,
 * the fields the new page's form asks for, and the body in the Docs editor. Mod+Enter saves
 * from any of them.
 */
export function TemplateEdit({ form, autoFocus }: { form: TemplateForm; autoFocus: boolean }) {
  const { draft, change, problem } = form;
  return (
    <div
      className="flex flex-col gap-5"
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          form.submit();
        }
      }}
    >
      <FormGrid columns={1} className="sm:grid-cols-2">
        <Field label="Name" error={problem.name}>
          <Input
            value={draft.name}
            maxLength={120}
            autoFocus={autoFocus}
            placeholder="Architecture decision"
            onChange={(event) => change({ name: event.target.value })}
          />
        </Field>
        <Field label="Category" hint="Groups it in the picker, such as Engineering.">
          <Input
            value={draft.category}
            maxLength={40}
            placeholder="General"
            onChange={(event) => change({ category: event.target.value })}
          />
        </Field>
        <FormGridItem full>
          <Field label="Description" hint="One line the picker shows under the name.">
            <Textarea
              rows={2}
              value={draft.description}
              maxLength={500}
              onChange={(event) => change({ description: event.target.value })}
            />
          </Field>
        </FormGridItem>
        <FormGridItem full className="flex flex-col gap-1.5">
          <span className="text-13 font-medium text-tx">Icon</span>
          <DocPopover
            label="Template icon"
            trigger={(props) => (
              <Button
                {...props}
                size="sm"
                className="w-fit"
                icon={
                  draft.icon ? <PageIcon value={draft.icon} size={15} /> : <Icon name="smile" />
                }
              >
                {draft.icon ? 'Change icon' : 'Choose an icon'}
              </Button>
            )}
          >
            {(close) => (
              <PageIconPicker
                value={draft.icon}
                onChange={(icon) => {
                  change({ icon });
                  if (icon === null) close();
                }}
              />
            )}
          </DocPopover>
        </FormGridItem>
      </FormGrid>
      <section aria-label="Page form fields" className="flex flex-col gap-2">
        <h3 className={SUBHEAD}>Fields the page form asks for</h3>
        <FieldsEditor fields={draft.fields} onChange={(fields) => change({ fields })} />
        {problem.fields && (
          <p role="alert" className="m-0 text-12 text-red-tx">
            {problem.fields}
          </p>
        )}
      </section>
      <section aria-label="Template body" className="flex flex-col gap-2">
        <h3 className={SUBHEAD}>Body</h3>
        <div className="rounded-control border border-line px-4 py-3 focus-within:border-acc">
          <DocEditor
            label="Template body"
            initialDoc={draft.snapshot}
            onChange={(doc) => change({ snapshot: doc ?? { type: 'doc', content: [] } })}
            placeholder="Write what every page made from this template starts with"
            contentClassName="min-h-48"
          />
        </div>
      </section>
    </div>
  );
}
