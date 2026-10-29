import { useT } from '@bemmoly/core-web';
import type { CloudConnection } from '@bemmoly/module-pipelines/shared';
import { Button, Input, useToast } from '@bemmoly/ui';
import { useState, type KeyboardEvent } from 'react';
import { useAccountWrites } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { registryValid } from './attached-form.ts';

/**
 * Where runners push the images they build, edited where it is shown. Clearing it happens at
 * once with Undo: nothing is lost, runners only keep their images until it is set again.
 */
export function RegistryRow({ connection }: { connection: CloudConnection }) {
  const t = useT(pipelinesText);
  const toast = useToast();
  const { registry } = useAccountWrites(connection.id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const valid = value.trim().length > 0 && registryValid(value);
  const edit = () => {
    registry.reset();
    setValue(connection.registry ?? '');
    setEditing(true);
  };
  const save = () => {
    if (!valid || registry.isPending) return;
    registry.mutate(value.trim(), { onSuccess: () => setEditing(false) });
  };
  const clear = () => {
    const previous = connection.registry;
    registry.mutate(null, {
      onSuccess: () =>
        toast.undo({
          title: t('pipelines.clouds.registryCleared'),
          body: t('pipelines.clouds.registryClearedBody'),
          onUndo: () => previous && registry.mutate(previous),
        }),
    });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setEditing(false);
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-12">
        <span id={`registry-${connection.id}`} className="text-tx-3">
          {t('pipelines.clouds.registry')}
        </span>
        {editing ? (
          <>
            <Input
              mono
              autoFocus
              value={value}
              aria-labelledby={`registry-${connection.id}`}
              placeholder={t('pipelines.clouds.registryExample')}
              wrapperClassName="min-w-60 flex-1"
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <Button
              size="xs"
              variant="secondary"
              disabled={!valid}
              loading={registry.isPending}
              onClick={save}
            >
              {t('pipelines.clouds.registrySave')}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
              {t('pipelines.common.cancel')}
            </Button>
          </>
        ) : (
          <>
            {connection.registry ? (
              <span className="min-w-0 truncate font-mono text-tx">{connection.registry}</span>
            ) : (
              <span className="text-tx-2">{t('pipelines.clouds.registryNone')}</span>
            )}
            <span className="flex gap-1">
              <Button size="xs" variant="ghost" onClick={edit}>
                {connection.registry
                  ? t('pipelines.clouds.registryEdit')
                  : t('pipelines.clouds.registrySet')}
              </Button>
              {connection.registry && (
                <Button size="xs" variant="ghost" loading={registry.isPending} onClick={clear}>
                  {t('pipelines.clouds.registryClear')}
                </Button>
              )}
            </span>
          </>
        )}
      </div>
      {editing && value.trim() && !registryValid(value) && (
        <span className="text-12 text-red-tx">{t('pipelines.clouds.registryInvalid')}</span>
      )}
      <ActionError error={registry.error} />
    </div>
  );
}
