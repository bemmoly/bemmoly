import type { IssueLinkKind } from '@bemmoly/module-work/shared';
import { Button, Field, Kbd, Modal, Select, useToast } from '@bemmoly/ui';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useIssueLinks, useIssueSuggestions } from '../hooks/issue-links.ts';

const KINDS: ReadonlyArray<{
  value: string;
  label: string;
  kind: IssueLinkKind;
  inverse: boolean;
}> = [
  { value: 'blocks', label: 'blocks', kind: 'blocks', inverse: false },
  { value: 'blocked-by', label: 'is blocked by', kind: 'blocks', inverse: true },
  { value: 'relates', label: 'relates to', kind: 'relates', inverse: false },
  { value: 'duplicates', label: 'duplicates', kind: 'duplicates', inverse: false },
  { value: 'duplicated-by', label: 'is duplicated by', kind: 'duplicates', inverse: true },
];

export interface LinkIssueDialogProps {
  issueKey: string;
  open: boolean;
  onClose: () => void;
}

/**
 * "Link issue", keyboard first: the search has focus on open, choosing an issue moves focus to
 * Link so Enter finishes, and Mod+Enter links from anywhere in the dialog.
 */
export function LinkIssueDialog({ issueKey, open, onClose }: LinkIssueDialogProps) {
  const [relation, setRelation] = useState('blocks');
  const [targetId, setTargetId] = useState('');
  const [targetKey, setTargetKey] = useState('');
  const search = useRef<HTMLButtonElement>(null);
  const linkId = useId();

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => search.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const [error, setError] = useState<string | null>(null);
  const { add } = useIssueLinks(issueKey);
  const suggestions = useIssueSuggestions(issueKey);
  const toast = useToast();

  const submit = () => {
    const chosen = KINDS.find((entry) => entry.value === relation);
    if (!targetId || !chosen) {
      setError('Choose the issue to link.');
      return;
    }
    add.mutate(
      { targetId, kind: chosen.kind, inverse: chosen.inverse },
      {
        onSuccess: () => {
          toast.show({ tone: 'ok', title: `Linked ${issueKey} to ${targetKey || 'the issue'}` });
          setTargetId('');
          setTargetKey('');
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
      title={`Link ${issueKey} to another issue`}
      description="Blocking links show on both issues; the board marks blocked cards."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            id={linkId}
            variant="primary"
            loading={add.isPending}
            onClick={submit}
            iconEnd={<Kbd keys="Mod+Enter" variant="plain" className="opacity-80 max-sm:hidden" />}
          >
            Link issue
          </Button>
        </>
      }
    >
      <div
        onKeyDown={onKeyDown}
        className="grid grid-cols-[160px_minmax(0,1fr)] gap-3.5 max-sm:grid-cols-1"
      >
        <Field label={issueKey}>
          <Select
            value={relation}
            options={KINDS.map(({ value, label }) => ({ value, label }))}
            onChange={(event) => setRelation(event.value)}
          />
        </Field>
        <Field label="Issue" error={error}>
          <Select
            ref={search}
            value={targetId}
            placeholder="Search by key or title"
            searchPlaceholder="PLT-211 or a few words"
            options={[]}
            loadOptions={suggestions}
            onChange={(event) => {
              setTargetId(event.value);
              setTargetKey(event.option.label.split(' ')[0] ?? '');
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
