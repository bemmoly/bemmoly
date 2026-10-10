import { PageLayout, useFrameLink } from '@bemmoly/core-web';
import { Button, buttonClassName } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { describeError } from '../lib/errors.ts';

/** A calm, centred notice: a muted icon, what happened in plain words, and the way on. */
export function PageNotice({
  icon,
  eyebrow,
  title,
  children,
  actions,
  role,
}: {
  icon: 'alert' | 'search';
  eyebrow?: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  role?: 'alert';
}) {
  return (
    <div
      role={role}
      className="mx-auto flex max-w-110 flex-col items-center gap-3 py-16 text-center"
    >
      <span className="grid size-11 place-items-center rounded-card bg-sunken text-tx-3 shadow-e1">
        <Icon name={icon} size={20} />
      </span>
      {eyebrow ? <p className="m-0 font-mono text-11 text-tx-3">{eyebrow}</p> : null}
      <h1 className="m-0 text-20 font-semibold tracking-title text-tx">{title}</h1>
      <div className="flex flex-col gap-1 text-13 leading-body text-tx-2">{children}</div>
      <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
    </div>
  );
}

function HomeLink() {
  const home = useFrameLink('/');
  return (
    <a {...home} className={buttonClassName({ variant: 'ghost' })}>
      Go to Home
    </a>
  );
}

/**
 * What a page shows when it throws: plain words, the request id, and a retry. `framed` draws it
 * as a page of its own (the header with Home), for failures that took the whole page down.
 */
export function PageFailure({
  error,
  onRetry,
  framed = false,
}: {
  error: unknown;
  onRetry?: () => void;
  framed?: boolean;
}) {
  const { message, requestId } = describeError(error);
  const notice = (
    <PageNotice
      role="alert"
      icon="alert"
      title="This page did not load"
      actions={
        <>
          {onRetry ? (
            <Button variant="primary" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          {framed ? <HomeLink /> : null}
        </>
      }
    >
      <p className="m-0">{message}</p>
      {requestId ? <p className="m-0 font-mono text-11 text-tx-3">Request id {requestId}</p> : null}
    </PageNotice>
  );
  if (!framed) return notice;
  return (
    <PageLayout
      layout="contained"
      header={{ crumbs: [{ label: 'Home', path: '/', icon: <Icon name="home" size={15} /> }] }}
      title={['Something went wrong']}
    >
      {notice}
    </PageLayout>
  );
}
