import { CREATE_PARAM, useLoaded, withCreate } from '@bemmoly/core-web';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { MODULE_CREATES } from '../../lib/module-shell.ts';

/**
 * Opens the create dialog the address names (`?create=work.create-issue`) over whatever page is
 * showing. Closing removes the name again: a step back when the dialog was opened here, so Back
 * and Close agree, or a replace when the page was loaded with it (a shared link, a reload).
 */
export function CreateHost() {
  const router = useRouter();
  const href = useRouterState({ select: (state) => state.location.href });
  const id = new URL(href, 'http://local').searchParams.get(CREATE_PARAM);
  const entry = id ? MODULE_CREATES.resolve(id) : null;
  const ready = useLoaded(entry);
  // The first address this host saw: a dialog named there came with the page, not from a click.
  const [firstHref] = useState(href);

  if (!id || !entry || !ready) return null;
  const openedHere = firstHref !== href;
  const close = () => {
    if (openedHere) router.history.back();
    else void router.navigate({ href: withCreate(href, null), replace: true });
  };
  const created = (path: string) => void router.navigate({ href: path, replace: true });
  return <entry.Component entry={id} onClose={close} onCreated={created} />;
}
