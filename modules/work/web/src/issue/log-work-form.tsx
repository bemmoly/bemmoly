import { Button, Input, useToast } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import { useLogWork } from '../hooks/issue-activity.ts';
import { formatMinutes, parseDuration } from './vocabulary.ts';

/** "Log work" under the Work log tab: a duration such as 2h 30m and an optional note. */
export function LogWorkForm({ issueKey }: { issueKey: string }) {
  const [open, setOpen] = useState(false);
  const [spent, setSpent] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const log = useLogWork(issueKey);
  const toast = useToast();

  if (!open) {
    return (
      <Button size="xs" className="self-start" onClick={() => setOpen(true)}>
        Log work
      </Button>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const minutes = parseDuration(spent);
    if (!minutes) {
      setError('Write the time as 2h, 45m or 1h 30m.');
      return;
    }
    log.mutate(
      { minutes, ...(note.trim() ? { note: note.trim() } : {}) },
      {
        onSuccess: () => {
          toast.show({ tone: 'ok', title: `Logged ${formatMinutes(minutes)} on ${issueKey}` });
          setSpent('');
          setNote('');
          setOpen(false);
        },
        onError: (failure) =>
          toast.show({ tone: 'danger', title: 'The time was not logged', body: failure.message }),
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5" aria-label="Log work">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Time spent"
          placeholder="2h 30m"
          autoFocus
          value={spent}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setSpent(event.target.value);
            setError(null);
          }}
          wrapperClassName="w-28"
        />
        <Input
          aria-label="What you worked on"
          placeholder="What you worked on (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          wrapperClassName="flex-1"
        />
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" type="submit" loading={log.isPending}>
          Log
        </Button>
      </div>
      {error && <span className="text-12 text-danger">{error}</span>}
    </form>
  );
}
