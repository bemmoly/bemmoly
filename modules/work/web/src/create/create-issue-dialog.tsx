import type { Issue } from '@bemmoly/module-work/shared';
import {
  Button,
  Field,
  FormGrid,
  FormGridItem,
  Input,
  Modal,
  RequiredMark,
  Select,
  Skeleton,
  Textarea,
  TypeGlyph,
  useToast,
} from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { useCreateIssue, type CreateDraft } from '../hooks/create-issue.ts';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { typeGlyph } from '../issue/vocabulary.ts';
import { projectsQuery } from '../shared/use-project.ts';
import { CreateFields } from './create-fields.tsx';

export interface CreateIssueDialogProps {
  open: boolean;
  onClose: () => void;
  /** The project to start in; the form can switch to any project the person sees. */
  projectKey: string | undefined;
  /** Creating a subtask: the parent's id and key, shown above the form. */
  parent?: { id: string; key: string };
  initial?: Partial<CreateDraft>;
  /** After the issue exists, in place of closing; the dialog has said so in a toast. */
  onCreated?: (issue: Issue) => void;
}

/**
 * Create issue: project and type first, then the title, description and the fields the
 * type's layout lists, with its required ones marked. The toast names the new key. The form
 * mounts only while open, so every opening starts from a clean draft.
 */
export function CreateIssueDialog(props: CreateIssueDialogProps) {
  return props.open ? <CreateIssueForm {...props} /> : null;
}

function CreateIssueForm(props: CreateIssueDialogProps) {
  const { open, onClose, parent, onCreated } = props;
  const form = useCreateIssue({
    projectKey: props.projectKey,
    ...(parent ? { parentId: parent.id } : {}),
    ...(props.initial ? { initial: props.initial } : {}),
  });
  const projects = useQuery(projectsQuery);
  const toast = useToast();
  const project = projects.data?.items.find((item) => item.key === form.projectKey);
  const { draft, set, errors } = form;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!project) return;
    const issue = await form.submit(project.id);
    if (!issue) return;
    toast.show({
      tone: 'ok',
      title: `Created ${issue.key}`,
      body: issue.title,
      action: { label: `Open ${issue.key}`, onClick: () => navigateTo(workPaths.issue(issue.key)) },
    });
    if (onCreated) onCreated(issue);
    else onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="lg"
      title={parent ? `Create a subtask of ${parent.key}` : 'Create issue'}
      description="Fields follow the issue type; the ones marked * are required."
      footer={
        <>
          {errors['form'] && (
            <span role="alert" className="mr-auto text-12h text-danger">
              {errors['form']}
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={form.isSubmitting}
            disabled={!project || !form.typeId}
            onClick={() => void submit()}
          >
            Create issue
          </Button>
        </>
      }
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3.5" noValidate>
        <FormGrid columns={2}>
          <FormGridItem>
            <Field label="Project" error={errors['projectId']}>
              <Select
                value={form.projectKey ?? ''}
                placeholder="Choose a project"
                disabled={Boolean(parent)}
                options={(projects.data?.items ?? []).map((item) => ({
                  value: item.key,
                  label: item.name,
                  description: item.key,
                }))}
                onChange={(event) => form.setProjectKey(event.value)}
              />
            </Field>
          </FormGridItem>
          <FormGridItem>
            <Field label="Issue type" error={errors['typeId']}>
              <Select
                value={form.typeId ?? ''}
                placeholder="Choose a type"
                options={form.types.map((type) => ({
                  value: type.id,
                  label: type.name,
                  icon: <TypeGlyph type={typeGlyph(type)} />,
                }))}
                onChange={(event) => form.setTypeId(event.value)}
              />
            </Field>
          </FormGridItem>
          <FormGridItem full>
            <Field
              label={
                <>
                  Title
                  <RequiredMark />
                </>
              }
              error={errors['title']}
            >
              <Input
                autoFocus
                value={draft.title}
                placeholder="What needs doing"
                onChange={(event) => set('title', event.target.value)}
              />
            </Field>
          </FormGridItem>
          <FormGridItem full>
            <Field label="Description" error={errors['description']}>
              <Textarea
                rows={4}
                value={draft.description}
                placeholder="Context, links, what done looks like"
                onChange={(event) => set('description', event.target.value)}
              />
            </Field>
          </FormGridItem>
        </FormGrid>
        {form.layout.isPending && form.typeId ? (
          <Skeleton shape="block" height={120} />
        ) : (
          <CreateFields form={form} />
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
