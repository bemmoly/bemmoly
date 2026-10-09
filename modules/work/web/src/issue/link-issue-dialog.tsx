import type { IssueLinkKind } from '@bemmoly/module-work/shared';
import { Button, Field, Modal, Select, useToast } from '@bemmoly/ui';
import { useState } from 'react';
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

/** "Link issue": how this issue relates to another, found by key or title. */
export function LinkIssueDialog({ issueKey, open, onClose }: LinkIssueDialogProps) {
  const [relation, setRelation] = useState('blocks');
  const [targetId, setTargetId] = useState('');
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
          toast.show({ tone: 'ok', title: `Linked to ${issueKey}` });
          setTargetId('');
          onClose();
        },
        onError: (failure) => setError(failure.message),
      },
    );
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
          <Button variant="primary" loading={add.isPending} onClick={submit}>
            Link issue
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3.5">
        <Field label="This issue">
          <Select
            value={relation}
            options={KINDS.map(({ value, label }) => ({ value, label }))}
            onChange={(event) => setRelation(event.value)}
          />
        </Field>
        <Field label="Issue" error={error}>
          <Select
            value={targetId}
            placeholder="Search by key or title"
            searchPlaceholder="PLT-211 or a few words"
            options={[]}
            loadOptions={suggestions}
            onChange={(event) => {
              setTargetId(event.value);
              setError(null);
            }}
            className="w-full"
          />
        </Field>
      </div>
    </Modal>
  );
}
