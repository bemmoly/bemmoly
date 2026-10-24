import { MenuItem } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useCreateFolder } from './use-create-folder.ts';
import { useCreatePage, type PagePlace } from './use-create-page.ts';
import { useUploadFilePage } from './use-upload-file-page.ts';

export interface AddActions {
  page: (place: PagePlace) => void;
  folder: (place: PagePlace) => void;
  file: (place: PagePlace) => void;
}

/**
 * What a + can add in a place: a page, a folder, or a file that becomes a page of its own
 * (ADR 0049). Kept by the component that draws the +, not by the menu, which unmounts as
 * soon as an item is chosen.
 */
export function useAddActions(): AddActions {
  const page = useCreatePage();
  const folder = useCreateFolder();
  const file = useUploadFilePage();
  return { page: page.create, folder: folder.create, file: file.upload };
}

/** The + menu's items for one place. */
export function AddMenuItems({ add, place }: { add: AddActions; place: PagePlace }) {
  return (
    <>
      <MenuItem icon={<Icon name="doc" />} onSelect={() => add.page(place)}>
        Page
      </MenuItem>
      <MenuItem icon={<Icon name="folder" />} onSelect={() => add.folder(place)}>
        Folder
      </MenuItem>
      <MenuItem icon={<Icon name="upload" />} onSelect={() => add.file(place)}>
        Upload file
      </MenuItem>
    </>
  );
}
