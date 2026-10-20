import { Badge, Button } from '@bemmoly/ui';
import { useState } from 'react';
import { useIssueArchive } from '../hooks/issue-archive.ts';

/** Under the title of an archived issue: why it is missing from the board, and the way back. */
export function ArchivedNote({ issueKey }: { issueKey: string }) {
  const archive = useIssueArchive();
  const [pending, setPending] = useState(false);
  const unarchive = () => {
    setPending(true);
    void archive([issueKey], false).finally(() => setPending(false));
  };
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 text-13 text-tx-2">
      <Badge>Archived</Badge>
      <span>Off the board and lists. It still opens by its key.</span>
      <Button size="xs" variant="ghost" loading={pending} onClick={unarchive}>
        Unarchive
      </Button>
    </div>
  );
}
