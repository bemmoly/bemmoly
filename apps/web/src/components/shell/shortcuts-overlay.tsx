import { useShortcutGroups, type ShortcutGroup } from '@bemmoly/core-web';
import { Kbd, Modal } from '@bemmoly/ui';
import { useUiStore } from '../../store/ui.ts';

/**
 * "?": every shortcut that works here, grouped. Opened from Help and shortcuts in the sidebar,
 * from ⌘K's footer, and by the key itself.
 */
export function ShortcutsOverlay({ groups }: { groups: readonly ShortcutGroup[] }) {
  const open = useUiStore((state) => state.shortcutsOpen);
  const setOpen = useUiStore((state) => state.setShortcutsOpen);
  const screen = useShortcutGroups();
  const all = [...groups, ...screen];
  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Keyboard shortcuts"
      description="Single keys never fire while you are typing in a field."
      width="lg"
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-4 py-4 sm:grid-cols-2">
        {all.map((group) => (
          <section key={group.id} aria-label={group.label} className="flex flex-col gap-1">
            <h3 className="m-0 mb-1 text-12 font-semibold text-tx-3">{group.label}</h3>
            {group.keys.map((entry) => (
              <div
                key={entry.keys + entry.label}
                className="flex min-h-7 items-center gap-3 text-13"
              >
                <span className="min-w-0 flex-1 text-tx-2">{entry.label}</span>
                <span className="flex shrink-0 gap-1">
                  {entry.keys.split(' ').map((key, index) => (
                    <Kbd key={index} keys={key} />
                  ))}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  );
}
