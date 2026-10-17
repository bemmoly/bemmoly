import { useShortcutGroups, useT, type ShortcutGroup } from '@bemmoly/core-web';
import { Kbd, Modal } from '@bemmoly/ui';
import { pipelinesText } from '../i18n/catalog.ts';
import { useUiStore } from '../store/ui.ts';
import { PLACES, SETTINGS } from './places.ts';

function Group({ group }: { group: ShortcutGroup }) {
  return (
    <section aria-label={group.label} className="flex flex-col gap-1">
      <h3 className="mb-1 text-12 font-semibold text-tx-3">{group.label}</h3>
      {group.keys.map((entry) => (
        <div key={entry.keys + entry.label} className="flex min-h-7 items-center gap-3 text-13">
          <span className="min-w-0 flex-1 text-tx-2">{entry.label}</span>
          <span className="flex shrink-0 gap-1">
            {entry.keys.split(' ').map((key, index) => (
              <Kbd key={index} keys={key} />
            ))}
          </span>
        </div>
      ))}
    </section>
  );
}

/**
 * "?": every key that works here. The screen on show lists its own (useShortcutHelp); the
 * shell's come after, so the screen's are what the eye meets first.
 */
export function KeysDialog() {
  const t = useT(pipelinesText);
  const open = useUiStore((state) => state.keysOpen);
  const setOpen = useUiStore((state) => state.setKeysOpen);
  const screen = useShortcutGroups();
  const shell: ShortcutGroup = {
    id: 'pipelines.shell',
    label: t('pipelines.keys.everywhere'),
    keys: [
      { keys: 'Mod+K', label: t('pipelines.shell.helpCommands') },
      { keys: 'T', label: t('pipelines.shell.helpMode') },
      { keys: '?', label: t('pipelines.shell.helpKeys') },
      ...[...PLACES, SETTINGS].map((place) => ({
        keys: place.keys,
        label: t('pipelines.keys.goTo', { place: t(`pipelines.shell.place.${place.id}`) }),
      })),
    ],
  };
  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={t('pipelines.shell.helpKeys')}
      description={t('pipelines.keys.description')}
      width="lg"
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
        {[...screen, shell].map((group) => (
          <Group key={group.id} group={group} />
        ))}
      </div>
    </Modal>
  );
}
