import { formatDateTime } from '@bemmoly/core-web';
import { useState } from 'react';
import { BUTTON } from '../components/button-sizes.ts';
import { useDevMailbox } from '../hooks/use-dev-mailbox.ts';
import { Button, Card, CardHeader, EmptyState, PageHeader, Skeleton } from '../ui.ts';

/** Development only: mail the `log` provider captured, so invites and resets can be followed. */
export function DevMailboxPage() {
  const { items, isPending, enabled, clear } = useDevMailbox();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((item) => item.id === openId) ?? items[0];
  return (
    <div className="flex w-full max-w-280 flex-col gap-5 px-10 pt-7 pb-15">
      <PageHeader
        title="Dev mailbox"
        subtitle="Email the server would have sent. Shown only while the log email provider is in use."
        actions={
          enabled ? (
            <Button
              variant="secondary"
              className={BUTTON.secondary}
              disabled={items.length === 0 || clear.isPending}
              onClick={() => clear.mutate()}
            >
              Clear
            </Button>
          ) : undefined
        }
      />
      {isPending ? (
        <Skeleton rows={4} />
      ) : !enabled ? (
        <EmptyState
          title="The dev mailbox is off"
          body="This server delivers email through SMTP, or you do not manage email, so there is nothing to show."
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No mail yet"
          body="Invite someone or request a password reset and the message appears here."
        />
      ) : (
        <div className="grid grid-cols-[320px_minmax(0,1fr)] items-start gap-4">
          <Card>
            <ul className="m-0 list-none p-0" aria-label="Messages">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(item.id)}
                    aria-current={item.id === open?.id}
                    className={`flex w-full cursor-pointer flex-col gap-0.5 border-0 border-b border-row-line px-4 py-2.5 text-left font-sans ${
                      item.id === open?.id ? 'bg-ac-bg2' : 'bg-sf'
                    }`}
                  >
                    <span className="truncate font-medium text-tx">{item.subject}</span>
                    <span className="text-caption text-tx5">
                      {item.to} · {formatDateTime(item.capturedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {open ? (
            <Card>
              <CardHeader>{open.subject}</CardHeader>
              <div className="flex flex-col gap-2 px-4 py-3.5">
                <div className="text-caption text-tx5">
                  From {open.from} · to {open.to}
                </div>
                <pre className="m-0 font-mono text-small leading-normal whitespace-pre-wrap text-tx2">
                  {open.text ?? 'This message has an HTML body only.'}
                </pre>
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
