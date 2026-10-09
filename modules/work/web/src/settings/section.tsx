import { Button, Card, SettingsRow, Switch, type SettingsSectionMode } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { isApiError } from '@bemmoly/api-client';
import type { ReactNode } from 'react';

/*
 * The parts every Board settings tab shares: the heading of the mock (15px
 * title, its description, actions on the right) carrying the read-then-edit
 * controls, the footer that saves while a tab is open, and the toggle list.
 */

export interface SectionHeadingProps {
  title: string;
  description: ReactNode;
  mode: SettingsSectionMode;
  /** Why Edit is shut: no permission. */
  locked?: string | undefined;
  onEdit: () => void;
  /** Shown while editing, before the Editing mark: "+ Add column". */
  actions?: ReactNode;
}

export function SectionHeading({
  title,
  description,
  mode,
  locked,
  onEdit,
  actions,
}: SectionHeadingProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-1 flex-col gap-1">
        <h2 className="m-0 flex items-center gap-2 text-15 font-semibold">
          {title}
          {mode === 'edit' && (
            <span className="rounded-chip bg-ac-bg px-1.5 py-0.5 text-11 font-semibold tracking-caps text-ac uppercase">
              Editing
            </span>
          )}
        </h2>
        <p className="m-0 leading-body text-tx4">{description}</p>
      </div>
      {mode === 'edit' ? (
        actions
      ) : (
        <Button
          icon={<Icon name="edit" size={14} />}
          disabled={Boolean(locked)}
          title={locked}
          aria-label={`Edit ${title}`}
          onClick={onEdit}
        >
          Edit
        </Button>
      )}
    </div>
  );
}

export interface EditFooterProps {
  dirty: boolean;
  saving: boolean;
  /** What stops a save, one line each. */
  problems?: readonly string[];
  error?: unknown;
  /** Replaces "You have unsaved changes." */
  note?: ReactNode;
  onCancel: () => void;
  onSave: () => void;
}

/** SettingsSection's edit footer for a tab: the state of the draft, Cancel and Save. */
export function EditFooter({
  dirty,
  saving,
  problems = [],
  error,
  note,
  onCancel,
  onSave,
}: EditFooterProps) {
  const failure = error
    ? isApiError(error)
      ? error.message
      : 'The settings were not saved.'
    : null;
  const blocked = problems.length > 0;
  return (
    <div className="flex flex-col gap-2 rounded-card border border-ac-br2 bg-sf2 px-4 py-2.5 shadow-ring">
      {(blocked || failure) && (
        <ul role="alert" className="m-0 flex list-none flex-col gap-1 p-0 text-12h text-danger">
          {failure && <li>{failure}</li>}
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 text-12h text-tx4">
          {note ?? (dirty ? 'You have unsaved changes.' : 'No changes yet.')}
        </span>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!dirty || blocked} loading={saving} onClick={onSave}>
          Review and save
        </Button>
      </div>
    </div>
  );
}

export interface ToggleSpec {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** The mock's toggle card: SettingsRows 10px apart with a switch each; read mode only shows. */
export function ToggleCard({ toggles, readOnly }: { toggles: ToggleSpec[]; readOnly: boolean }) {
  return (
    <Card className="px-4 py-1.5">
      {toggles.map((toggle) => (
        <SettingsRow
          key={toggle.title}
          title={toggle.title}
          {...(toggle.description ? { description: toggle.description } : {})}
          control={
            <Switch
              aria-label={toggle.title}
              aria-readonly={readOnly}
              checked={toggle.checked}
              {...(readOnly ? {} : { onCheckedChange: toggle.onChange })}
            />
          }
        />
      ))}
    </Card>
  );
}
