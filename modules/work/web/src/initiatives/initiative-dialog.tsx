import type { Initiative } from '@bemmoly/module-work/shared';
import { Button, Field, Input, Kbd, Modal, Textarea, useToast } from '@bemmoly/ui';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { useInitiativeActions } from '../hooks/initiatives.ts';

export interface InitiativeDialogProps {
  open: boolean;
  onClose: () => void;
  /** The initiative to edit; a new one when left out. */
  initiative?: Initiative | undefined;
}

interface Draft {
  name: string;
  description: string;
  startAt: string;
  targetAt: string;
}

const draftOf = (initiative?: Initiative): Draft => ({
  name: initiative?.name ?? '',
  description: initiative?.description ?? '',
  startAt: initiative?.startAt ?? '',
  targetAt: initiative?.targetAt ?? '',
});

/**
 * New initiative and Edit initiative: a name, what it is for and its dates. A new one opens
 * its program view, where its epics are linked. Mod+Enter saves from anywhere in the dialog.
 */
export function InitiativeDialog({ open, onClose, initiative }: InitiativeDialogProps) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(initiative));
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const { create, update } = useInitiativeActions();
  const toast = useToast();
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (open) {
      setDraft(draftOf(initiative));
      setError(null);
    }
  }, [open, initiative]);

  const set = (field: keyof Draft) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const submit = () => {
    if (!draft.name.trim()) {
      setError({ field: 'name', message: 'Name the initiative.' });
      return;
    }
    if (draft.startAt && draft.targetAt && draft.startAt > draft.targetAt) {
      setError({ field: 'startAt', message: 'Start on or before the target date.' });
      return;
    }
    const body = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      startAt: draft.startAt || null,
      targetAt: draft.targetAt || null,
    };
    const fail = (failure: Error) => setError({ field: 'form', message: failure.message });
    if (initiative) {
      update.mutate(
        { id: initiative.id, body },
        {
          onSuccess: () => {
            toast.show({ tone: 'ok', title: `Saved ${body.name}` });
            onClose();
          },
          onError: fail,
        },
      );
      return;
    }
    create.mutate(body, {
      onSuccess: (created) => {
        toast.show({ tone: 'ok', title: `Created ${created.name}` });
        onClose();
        navigateTo(workPaths.initiatives(created.id));
      },
      onError: fail,
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };
  const errorFor = (field: string) => (error?.field === field ? error.message : undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="md"
      title={initiative ? 'Edit initiative' : 'New initiative'}
      description="An initiative gathers epics from any project, so a program reads as one timeline."
      footer={
        <>
          {error?.field === 'form' && (
            <span role="alert" className="mr-auto text-12 text-red-tx">
              {error.message}
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            onClick={submit}
            iconEnd={<Kbd keys="Mod+Enter" variant="plain" className="opacity-80 max-sm:hidden" />}
          >
            {initiative ? 'Save initiative' : 'Create initiative'}
          </Button>
        </>
      }
    >
      <div onKeyDown={onKeyDown} className="flex flex-col gap-3.5">
        <Field label="Name" error={errorFor('name')}>
          <Input
            autoFocus
            value={draft.name}
            maxLength={120}
            placeholder="New checkout"
            onChange={(event) => set('name')(event.target.value)}
          />
        </Field>
        <Field label="Description" hint="What the program delivers, in a sentence or two.">
          <Textarea
            value={draft.description}
            maxLength={2000}
            rows={3}
            onChange={(event) => set('description')(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
          <Field label="Start" error={errorFor('startAt')}>
            <Input
              type="date"
              value={draft.startAt}
              onChange={(event) => set('startAt')(event.target.value)}
            />
          </Field>
          <Field label="Target">
            <Input
              type="date"
              value={draft.targetAt}
              onChange={(event) => set('targetAt')(event.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
