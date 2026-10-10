import type { ComponentType } from 'react';
import { navigateInApp } from '../modules/navigation.ts';
import { preloadable, type Preloadable } from '../modules/preloadable.ts';

/**
 * Creating happens in place: the New button, a section's "+" and ⌘K open the module's create
 * dialog over the page the person is on, named in the address (`?create=work.create-issue`) so
 * Back closes it and a reload brings it back. Nothing navigates to a page that draws another
 * screen behind the dialog.
 */
export const CREATE_PARAM = 'create';

export interface CreateOverlayProps {
  /** Closes the dialog and leaves the page as it was. */
  onClose: () => void;
  /** After creating: moves to the new thing, replacing the dialog's history entry. */
  onCreated: (path: string) => void;
}

/** A module's `web/src/create.tsx`: one dialog per create entry id it registers. */
export type ModuleCreateDialogs = Readonly<Record<string, ComponentType<CreateOverlayProps>>>;
export type ModuleCreateLoader = () => Promise<{ default: ModuleCreateDialogs }>;

/** The current address with the create dialog named, or without it. */
export function withCreate(href: string, id: string | null): string {
  const url = new URL(href, 'http://local');
  if (id) url.searchParams.set(CREATE_PARAM, id);
  else url.searchParams.delete(CREATE_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Opens a create dialog over the page on show. */
export function openCreate(id: string): void {
  const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  navigateInApp(withCreate(here, id));
}

/** Loads each module's create dialogs on first use, then keeps them. */
export function createDialogRegistry(loaders: Readonly<Record<string, ModuleCreateLoader>>) {
  const cache = new Map<string, Preloadable<{ entry: string } & CreateOverlayProps>>();
  return {
    /** The module that registered the entry id, by its namespace: "work.create-issue" → work. */
    has: (entryId: string) => (entryId.split('.')[0] ?? '') in loaders,
    resolve(entryId: string) {
      const moduleId = entryId.split('.')[0] ?? '';
      const loader = loaders[moduleId];
      if (!loader) return null;
      let dialogs = cache.get(moduleId);
      if (!dialogs) {
        dialogs = preloadable(async () => {
          const { default: byId } = await loader();
          function ModuleCreate({ entry, ...props }: { entry: string } & CreateOverlayProps) {
            const Dialog = byId[entry];
            return Dialog ? <Dialog {...props} /> : null;
          }
          return { default: ModuleCreate };
        });
        cache.set(moduleId, dialogs);
      }
      return dialogs;
    },
  };
}

export type CreateDialogRegistry = ReturnType<typeof createDialogRegistry>;
