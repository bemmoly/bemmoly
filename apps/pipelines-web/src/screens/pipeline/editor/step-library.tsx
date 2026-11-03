import { useT } from '@bemmoly/core-web';
import { Drawer, Field, Select, Tag } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { editorText } from '../../../i18n/catalog.ts';
import type { EditorEnvironment, NewStep } from './model.ts';

type ItemId = 'buildImage' | 'script' | 'integration' | 'deployService' | 'kubernetes' | 'aws';

interface LibraryItem {
  id: ItemId;
  kind: NewStep | null;
  icon: IconName;
  /** Steps that need an environment to deploy to. */
  environment?: boolean;
}

/** The steps Bemmoly can add today, by what they are for; later clouds are marked Soon. */
const LIBRARY: ReadonlyArray<{
  category: 'build' | 'test' | 'deploy';
  items: readonly LibraryItem[];
}> = [
  { category: 'build', items: [{ id: 'buildImage', kind: 'build', icon: 'box' }] },
  {
    category: 'test',
    items: [
      { id: 'script', kind: 'script', icon: 'code' },
      { id: 'integration', kind: 'integration', icon: 'checklist' },
    ],
  },
  {
    category: 'deploy',
    items: [
      { id: 'deployService', kind: 'deploy', icon: 'rocket', environment: true },
      { id: 'kubernetes', kind: null, icon: 'server' },
      { id: 'aws', kind: null, icon: 'cloud' },
    ],
  },
];

/** "Add a step": pick where it runs, then what it is. */
export function StepLibrary({
  open,
  onClose,
  environments,
  hasBuild,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  environments: readonly EditorEnvironment[];
  hasBuild: boolean;
  onAdd: (kind: NewStep, name: string, environment: string | null) => void;
}) {
  const t = useT(editorText);
  const [where, setWhere] = useState('');
  return (
    <Drawer
      open={open}
      onClose={onClose}
      label={t('pipelinesEditor.library.title')}
      variant="overlay"
      header={
        <span className="text-14 font-semibold text-tx">{t('pipelinesEditor.library.title')}</span>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <Field label={t('pipelinesEditor.library.where')}>
          <Select
            value={where}
            onChange={(event) => setWhere(event.value)}
            options={[
              { value: '', label: t('pipelinesEditor.library.whereBuild') },
              ...environments.map((environment) => ({
                value: environment.key,
                label: environment.name,
              })),
            ]}
          />
        </Field>
        {LIBRARY.map((section) => (
          <div key={section.category} className="flex flex-col gap-1.5">
            <span className="text-11 font-semibold tracking-wide text-tx-3 uppercase">
              {t(`pipelinesEditor.library.category.${section.category}`)}
            </span>
            {section.items.map((item) => {
              const soon = item.kind === null;
              const needsEnvironment = item.environment === true && where === '';
              const taken = item.kind === 'build' && hasBuild;
              const disabled = soon || needsEnvironment || taken;
              const name = t(`pipelinesEditor.library.item.${item.id}`);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    item.kind &&
                    onAdd(item.kind, name, item.kind === 'build' ? null : where || null)
                  }
                  className="flex items-start gap-3 rounded-card border border-line bg-card px-3 py-2.5 text-start hover:shadow-e1h focus-ring disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <span className="mt-0.5 text-tx-2">
                    <Icon name={item.icon} size={16} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-13 font-medium text-tx">
                      {name}
                      {soon ? <Tag>{t('pipelinesEditor.library.soon')}</Tag> : null}
                    </span>
                    <span className="text-12 text-tx-3">
                      {needsEnvironment && !soon
                        ? t('pipelinesEditor.library.pickEnvironment')
                        : taken
                          ? t('pipelinesEditor.library.hasBuild')
                          : t(`pipelinesEditor.library.item.${item.id}Hint`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Drawer>
  );
}
