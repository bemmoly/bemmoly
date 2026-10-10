import type { PageDetail } from '@bemmoly/module-docs/shared';
import { Button, Field, Input, Modal, Select, TemplatePicker } from '@bemmoly/ui';
import { useSpaces, useTemplates } from '../hooks/queries.ts';
import { useCreatePage, type CreatePagePlace } from './use-create-page.ts';

export interface CreatePageDialogProps extends CreatePagePlace {
  open: boolean;
  /** "Inside Architecture", when the page goes under another. */
  parentTitle?: string | null;
  onClose: () => void;
  onCreated: (page: PageDetail) => void;
}

/**
 * New page: the template picker, with the space to put it in when it is not already
 * known, and an optional title. Blank is chosen first, so Enter makes an empty page at
 * once; a double click on a template makes the page from it.
 */
export function CreatePageDialog(props: CreatePageDialogProps) {
  return props.open ? <CreatePageForm {...props} /> : null;
}

function CreatePageForm({
  open,
  spaceId: presetSpace,
  parentId,
  parentTitle,
  templateId,
  onClose,
  onCreated,
}: CreatePageDialogProps) {
  const spaces = useSpaces();
  const fallback = presetSpace ?? spaces.data?.[0]?.id ?? null;
  const form = useCreatePage({ spaceId: fallback, parentId, templateId }, onCreated);
  const spaceId = form.spaceId;
  const templates = useTemplates(spaceId ?? undefined);
  const space = spaces.data?.find((item) => item.id === spaceId);
  const where = parentTitle
    ? `Inside ${parentTitle || 'Untitled'}, in ${space?.name ?? 'this space'}.`
    : space
      ? `At the top of ${space.name}.`
      : 'Choose a space and a template to start from.';

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="lg"
      title="New page"
      description={where}
      footer={
        <>
          {form.error && (
            <span role="alert" className="mr-auto text-12h text-danger">
              {form.error}
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={form.isSubmitting} onClick={() => form.submit()}>
            Create page
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          form.submit();
        }}
      >
        <div
          className={`grid gap-3.5 ${presetSpace ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-[minmax(0,1fr)_220px]'}`}
        >
          <Field label="Title" hint="Optional. A template page takes the template's name.">
            <Input
              autoFocus
              value={form.title}
              placeholder="Untitled"
              onChange={(event) => form.setTitle(event.target.value)}
            />
          </Field>
          {!presetSpace && (
            <Field label="Space">
              <Select
                value={spaceId ?? ''}
                placeholder={spaces.isPending ? 'Loading spaces' : 'Choose a space'}
                options={(spaces.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                  description: item.key,
                }))}
                onChange={(event) => form.setSpaceId(event.value)}
              />
            </Field>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-medium text-tx">Start from</span>
          <TemplatePicker
            templates={templates.data ?? []}
            loading={templates.isPending}
            {...(templates.isError ? { error: 'Templates could not be loaded.' } : {})}
            selectedId={form.templateId}
            onSelect={form.setTemplateId}
            onChoose={(id) => {
              form.setTemplateId(id);
              form.submit(id);
            }}
          />
        </div>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
