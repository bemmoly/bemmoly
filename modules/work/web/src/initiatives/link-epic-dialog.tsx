import type { Initiative } from '@bemmoly/module-work/shared';
import { Button, Field, Kbd, Modal, Select, useToast } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useInitiativeActions } from '../hooks/initiatives.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';

export interface LinkEpicDialogProps {
  initiative: Initiative;
  /** Epics already in it, left out of the choices. */
  linked: ReadonlySet<string>;
  open: boolean;
  onClose: () => void;
}

/**
 * "Link epic": every epic the person can open, from any project, read from the all-projects
 * roadmap the Roadmap screen caches too. The search has focus on open; choosing moves focus to
 * Link so Enter finishes, and Mod+Enter links from anywhere in the dialog.
 */
export function LinkEpicDialog({ initiative, linked, open, onClose }: LinkEpicDialogProps) {
  const [epicId, setEpicId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const search = useRef<HTMLButtonElement>(null);
  const linkId = useId();
  const { link } = useInitiativeActions();
  const toast = useToast();
  const all = useQuery({
    queryKey: workKeys.roadmap({}),
    queryFn: ({ signal }) => api.work.roadmap.view({}, { signal }),
    enabled: open,
  });
  const projectName = new Map(
    (all.data?.projects ?? []).map((project) => [project.id, project.name]),
  );
  const options = (all.data?.items ?? [])
    .filter((item) => item.kind === 'epic' && !linked.has(item.id))
    .map((item) => ({
      value: item.id,
      label: `${item.key ?? ''} ${item.title}`,
      description: projectName.get(item.projectId) ?? '',
    }));

  useEffect(() => {
    if (!open) return;
    setEpicId('');
    setError(null);
    const frame = requestAnimationFrame(() => search.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const submit = () => {
    const chosen = options.find((option) => option.value === epicId);
    if (!chosen) {
      setError('Choose the epic to link.');
      return;
    }
    link.mutate(
      { id: initiative.id, epicId },
      {
        onSuccess: () => {
          toast.show({ tone: 'ok', title: `Linked ${chosen.label.split(' ')[0]}` });
          onClose();
        },
        onError: (failure) => setError(failure.message),
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Link an epic to ${initiative.name}`}
      description="Any epic you can open, from any project. Its issues count toward the progress."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            id={linkId}
            variant="primary"
            loading={link.isPending}
            onClick={submit}
            iconEnd={<Kbd keys="Mod+Enter" variant="plain" className="opacity-80 max-sm:hidden" />}
          >
            Link epic
          </Button>
        </>
      }
    >
      <div onKeyDown={onKeyDown}>
        <Field label="Epic" error={error}>
          <Select
            ref={search}
            value={epicId}
            placeholder={all.isPending ? 'Loading epics' : 'Search by key or title'}
            searchPlaceholder="PLT-190 or a few words"
            options={options}
            onChange={(event) => {
              setEpicId(event.value);
              setError(null);
              requestAnimationFrame(() => document.getElementById(linkId)?.focus());
            }}
            className="w-full"
          />
        </Field>
      </div>
    </Modal>
  );
}
