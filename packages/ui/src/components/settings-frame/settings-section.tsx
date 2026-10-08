import { useId, type FormEvent, type ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { Button } from '../button/button.tsx';
import { Card } from '../card/card.tsx';

export type SettingsSectionMode = 'read' | 'edit';

export interface SettingsSectionProps {
  title: ReactNode;
  /** Light text after the title ("Select Custom above to edit"). */
  hint?: ReactNode;
  children: ReactNode;
  /** rows: SettingsRow or SettingsValue list (6px 16px). block: free content (16px). */
  layout?: 'rows' | 'block';
  /** Anchor for the unsaved-changes bar's links. */
  id?: string;
  className?: string;
  /**
   * Turns on the read-then-edit pattern: "read" shows values and an Edit action, "edit" shows
   * the fields with Cancel and Save. Leave it out for a plain panel.
   */
  mode?: SettingsSectionMode;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  /** Something differs from the stored values; Save stays disabled until it does. */
  dirty?: boolean;
  saving?: boolean;
  /** Why this section cannot be edited now (no permission, maintenance); disables Edit. */
  locked?: string;
  /** Right-aligned header actions shown in both modes. */
  actions?: ReactNode;
  /** A line beside Cancel and Save, such as what a change takes effect on. */
  note?: ReactNode;
}

/**
 * A settings panel: the Theme, Custom theme and Policy cards of the Appearance mock. With a
 * mode it is also the edit pattern no mock shows: a calm read view, Edit per section, and a
 * footer with Cancel and Save while editing.
 */
export function SettingsSection({
  title,
  hint,
  children,
  layout = 'block',
  id,
  className,
  mode,
  onEdit,
  onSave,
  onCancel,
  dirty = false,
  saving = false,
  locked,
  actions,
  note,
}: SettingsSectionProps) {
  const titleId = useId();
  const editing = mode === 'edit';
  const body = (
    <div className={layout === 'rows' ? 'flex flex-col px-4 py-1.5' : 'flex flex-col gap-4 p-4'}>
      {children}
    </div>
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (dirty && !saving) onSave?.();
  };
  return (
    <Card
      id={id}
      role="region"
      aria-labelledby={titleId}
      className={cx('scroll-mt-6', editing && 'border-ac-br2 shadow-ring', className)}
    >
      <div
        className={cx(
          'flex items-center gap-2 border-b border-br2 px-4 font-semibold',
          mode ? 'min-h-11 py-2' : 'py-3',
        )}
      >
        <span id={titleId}>{title}</span>
        {hint && <span className="text-12 font-normal text-tx5">{hint}</span>}
        {editing && (
          <span className="rounded-chip bg-ac-bg px-1.5 py-0.5 text-11 font-semibold tracking-caps text-ac uppercase">
            Editing
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-12h font-medium">
          {actions}
          {mode === 'read' && onEdit && (
            <Button
              size="xs"
              icon={<Icon name="edit" />}
              disabled={Boolean(locked)}
              title={locked}
              aria-label={typeof title === 'string' ? `Edit ${title}` : undefined}
              onClick={onEdit}
            >
              Edit
            </Button>
          )}
        </span>
      </div>
      {editing ? (
        <form onSubmit={submit} noValidate>
          {body}
          <div className="flex items-center gap-3 border-t border-br2 bg-sf2 px-4 py-2.5">
            <span className="min-w-0 flex-1 text-12h text-tx4">
              {note ?? (dirty ? 'You have unsaved changes.' : 'No changes yet.')}
            </span>
            <Button onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!dirty} loading={saving}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        body
      )}
    </Card>
  );
}
