import { useT } from '@bemmoly/core-web';
import { Button, Input } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState, type KeyboardEvent } from 'react';
import { pipelinesText } from '../../../i18n/catalog.ts';
import type { VariableRow } from './rows.ts';

/**
 * A value as the table shows it. A plain one edits where it is shown: Enter saves, Escape
 * leaves it. A secret shows that it is set and never what it is; one still waiting to move into
 * the store says why.
 */
export function ValueCell({
  row,
  canChange,
  saving,
  onSave,
  onReplace,
}: {
  row: VariableRow;
  canChange: boolean;
  saving: boolean;
  onSave: (value: string) => void;
  onReplace: () => void;
}) {
  const t = useT(pipelinesText);
  const [editing, setEditing] = useState<string | null>(null);
  const { variable } = row;
  if (variable.kind === 'secret') {
    if (variable.state === 'moving') {
      return (
        <span className="flex min-w-0 flex-col text-12 leading-card">
          <span className="flex items-center gap-1.5 text-amber-tx">
            <Icon name="warning" size={12} />
            {t('pipelines.variables.moving')}
          </span>
          {variable.problem && <span className="text-tx-3">{variable.problem}</span>}
        </span>
      );
    }
    return (
      <span className="flex min-w-0 items-center gap-2 text-12">
        <span className="flex items-center gap-1.5 text-tx-2">
          <Icon name="lock" size={12} />
          {t('pipelines.variables.writeOnly')}
        </span>
        {/* On a phone the row's menu replaces it; the cell keeps room for the words. */}
        {canChange && !row.inherited && (
          <Button size="xs" variant="ghost" className="max-sm:hidden" onClick={onReplace}>
            {t('pipelines.variables.replaceShort')}
          </Button>
        )}
      </span>
    );
  }
  if (editing !== null) {
    const save = () => {
      if (editing.length > 0 && !saving) onSave(editing);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        save();
        setEditing(null);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setEditing(null);
      }
    };
    return (
      <Input
        mono
        autoFocus
        value={editing}
        aria-label={t('pipelines.variables.valueOf', { name: row.name })}
        wrapperClassName="w-full"
        onChange={(event) => setEditing(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setEditing(null)}
      />
    );
  }
  const text = (
    <span className="min-w-0 truncate font-mono text-12 text-tx">{variable.value ?? ''}</span>
  );
  if (!canChange || row.inherited) return text;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {text}
      <Button
        size="xs"
        variant="ghost"
        aria-label={t('pipelines.variables.editValue', { name: row.name })}
        onClick={() => setEditing(variable.value ?? '')}
      >
        {t('pipelines.variables.edit')}
      </Button>
    </span>
  );
}
