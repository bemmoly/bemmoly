import type { Issue } from '@bemmoly/module-work/shared';
import { Button, Kbd, Modal, Skeleton, Switch, useToast } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useCreateIssue, type CreateInitial } from '../hooks/create-issue.ts';
import { useCreateOptions } from '../hooks/create-options.ts';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { projectsQuery } from '../shared/use-project.ts';
import { CreateBody } from './create-body.tsx';
import { CreateFields } from './create-fields.tsx';
import { CreateHeader } from './create-header.tsx';

export interface CreateIssueDialogProps {
  open: boolean;
  onClose: () => void;
  /** The project to start in; the form can switch to any project the person sees. */
  projectKey: string | undefined;
  /** Creating a subtask: the parent's id and key, shown above the form. */
  parent?: { id: string; key: string };
  /**
   * Defaults from where the person started: a column's status, the sprint on screen, the
   * epic lane, "assigned to me". A description may be plain text.
   */
  initial?: CreateInitial;
  /** After the issue exists, in place of closing; the dialog has said so in a toast. */
  onCreated?: (issue: Issue) => void;
}

/**
 * Create issue, as the review draws it: project and type as pickers, a borderless title, the
 * issue page's editor, the type's documents, then the properties as chips. ⌘↵ creates,
 * "Create another" keeps the dialog for the next one, and Escape asks before throwing away
 * anything typed. The form mounts only while open, so every opening starts clean.
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
  const project = projects.data?.items.find((item) => item.key === form.projectKey);
  const options = useCreateOptions(form.projectKey, project?.id, form.types);
  const toast = useToast();
  const [another, setAnother] = useState(false);
  const [asking, setAsking] = useState(false);
  const keepId = useId();
  const type = form.types.find((item) => item.id === form.typeId);

  useEffect(() => {
    if (asking) document.getElementById(keepId)?.focus();
  }, [asking, keepId]);

  /** Escape, the scrim and Close: straight out when nothing is typed, otherwise ask first. */
  const requestClose = () => {
    if (asking) setAsking(false);
    else if (form.dirty) setAsking(true);
    else onClose();
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!project || form.isSubmitting) return;
    const result = await form.submit(project.id);
    if (!result) return;
    const { issue, moved } = result;
    toast.show({
      tone: 'ok',
      title: `Created ${issue.key}`,
      body: moved ? issue.title : `${issue.title}. It starts in the first status.`,
      action: { label: `Open ${issue.key}`, onClick: () => navigateTo(workPaths.issue(issue.key)) },
    });
    if (another) {
      form.again();
      document.querySelector<HTMLElement>('dialog[open] [data-autofocus]')?.focus();
    } else if (onCreated) onCreated(issue);
    else onClose();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      width="composer"
      flush
      title={parent ? `Create a subtask of ${parent.key}` : 'Create issue'}
      header={
        <CreateHeader
          projects={projects.data?.items ?? []}
          projectKey={form.projectKey}
          onProject={form.setProjectKey}
          types={form.types}
          typeId={form.typeId}
          onType={form.setTypeId}
          parentKey={parent?.key}
          onClose={requestClose}
        />
      }
      footer={
        asking ? (
          <>
            <span className="mr-auto text-13 text-tx" role="alert">
              Discard this issue? What you typed will be lost.
            </span>
            <Button id={keepId} variant="ghost" onClick={() => setAsking(false)}>
              Keep editing
            </Button>
            <Button variant="danger" onClick={onClose}>
              Discard
            </Button>
          </>
        ) : (
          <>
            {form.errors['form'] && (
              <span role="alert" className="mr-auto text-12 text-red-tx">
                {form.errors['form']}
              </span>
            )}
            <label className="mr-auto flex cursor-pointer items-center gap-2 text-13 text-tx-2 first:mr-0 max-sm:hidden">
              <Switch size="sm" checked={another} onCheckedChange={setAnother} />
              Create another
            </label>
            <Button variant="ghost" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={form.isSubmitting}
              disabled={!project || !form.typeId}
              onClick={() => void submit()}
              iconEnd={
                <Kbd keys="Mod+Enter" variant="plain" className="opacity-80 max-sm:hidden" />
              }
            >
              Create issue
            </Button>
          </>
        )
      }
    >
      <form
        onSubmit={(event) => void submit(event)}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-4 px-5 pt-4 pb-5"
        noValidate
      >
        <CreateBody form={form} typeName={type?.name} onSubmit={() => void submit()} />
        {form.layout.isPending && form.typeId ? (
          <Skeleton shape="block" height={26} />
        ) : (
          <CreateFields form={form} options={options} />
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
