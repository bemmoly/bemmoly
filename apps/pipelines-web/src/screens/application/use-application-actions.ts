import { useScreenActions, useT } from '@bemmoly/core-web';
import type { EnvironmentStripItem } from '@bemmoly/module-pipelines/shared';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect } from 'react';
import { useScreenKeys } from '../../hooks/use-screen-keys.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { BASE_PATH } from '../../lib/sign-in.ts';
import { rollbackable } from './rollback-dialog.tsx';

type Search = Record<string, unknown>;

/**
 * The application page's three actions, on their keys and in the palette: R runs the
 * pipeline, P promotes the release one stop before Prod, Shift+B rolls back. Dialogs live in
 * the address (?dialog=run), so the palette can open one from any screen.
 */
export function useApplicationActions({
  name,
  ready,
  items,
  stripReady,
  dialogParam,
}: {
  name: string;
  ready: boolean;
  items: readonly EnvironmentStripItem[];
  stripReady: boolean;
  dialogParam: string | undefined;
}) {
  const t = useT(pipelinesText);
  const router = useRouter();
  const navigate = useNavigate();
  const firstProd = items.findIndex((item) => item.environment.class === 'prod');
  const candidate = firstProd > 0 ? items[firstProd - 1] : undefined;
  const canRollBack = rollbackable(items).length > 0;
  const dialog = dialogParam === 'run' || dialogParam === 'rollback' ? dialogParam : null;
  const setSearch = useCallback(
    (next: Record<string, string | undefined>) =>
      void navigate({
        to: '.',
        search: (previous: Search) => {
          const merged: Search = { ...previous, ...next };
          for (const key of Object.keys(next)) if (next[key] === undefined) delete merged[key];
          return merged;
        },
        replace: true,
      }),
    [navigate],
  );
  const setDialog = (next: 'run' | 'rollback' | null) => setSearch({ dialog: next ?? undefined });
  const promoteTo = candidate?.releaseId;
  const promote = () => {
    if (promoteTo) router.history.push(`${BASE_PATH}/releases/${promoteTo}/promote?to=prod`);
  };
  // "promote checkout-api" from the palette lands here and goes on once the strip names it.
  const wantsPromote = dialogParam === 'promote';
  useEffect(() => {
    if (!wantsPromote || !stripReady) return;
    if (promoteTo) router.history.replace(`${BASE_PATH}/releases/${promoteTo}/promote?to=prod`);
    else setSearch({ dialog: undefined });
  }, [wantsPromote, promoteTo, stripReady, router, setSearch]);

  useScreenKeys({
    p: promote,
    'shift+b': () => canRollBack && setDialog('rollback'),
    r: () => setDialog('run'),
  });
  useScreenActions(
    ready
      ? [
          {
            id: 'app.run',
            title: t('pipelines.application.runAction', { name }),
            keys: 'R',
            run: () => setDialog('run'),
          },
          ...(promoteTo
            ? [
                {
                  id: 'app.promote',
                  title: t('pipelines.application.promoteAction', { name }),
                  keys: 'P',
                  run: promote,
                },
              ]
            : []),
          ...(canRollBack
            ? [
                {
                  id: 'app.rollback',
                  title: t('pipelines.application.rollbackAction', { name }),
                  keys: 'Shift+B',
                  run: () => setDialog('rollback'),
                },
              ]
            : []),
        ]
      : null,
  );
  return { dialog, setDialog, setSearch, promote, candidate, canRollBack };
}
