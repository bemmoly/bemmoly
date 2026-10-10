import { useFrame, type CreateOverlayProps, type ModuleCreateDialogs } from '@bemmoly/core-web';
import { CreatePageDialog } from './create/create-page-dialog.tsx';
import { CreateSpaceDialog } from './create/create-space-dialog.tsx';
import { useSpaces } from './hooks/queries.ts';
import { docsPaths } from './shared/navigation.ts';

/** The space the address is in, so a new page starts there: /docs/s/ENG. */
function spaceKeyIn(pathname: string): string | undefined {
  const [, area, screen, key] = pathname.split('/');
  return area === 'docs' && screen === 's' ? key : undefined;
}

/** A new page over whatever is showing, in the space on show; then the page itself. */
function NewPage({ onClose, onCreated }: CreateOverlayProps) {
  const spaces = useSpaces();
  const key = spaceKeyIn(useFrame().pathname);
  const space = spaces.data?.find((item) => item.key === key);
  if (spaces.isPending) return null;
  return (
    <CreatePageDialog
      open
      spaceId={space?.id ?? null}
      parentId={null}
      templateId={null}
      onClose={onClose}
      onCreated={(page) => onCreated(docsPaths.page(page.id))}
    />
  );
}

/** A new space, then the space. */
function NewSpace({ onClose, onCreated }: CreateOverlayProps) {
  return (
    <CreateSpaceDialog open onClose={onClose} onCreated={(space) => onCreated(docsPaths.space(space.key))} />
  );
}

/** Docs' create dialogs by the create entry ids module.ts registers. */
const dialogs: ModuleCreateDialogs = {
  'docs.create-page': NewPage,
  'docs.create-space': NewSpace,
};

export default dialogs;
