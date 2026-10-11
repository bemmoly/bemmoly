import { useId, type FormEvent, type ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { Button } from '../button/button.tsx';

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
    <section
      id={id}
      aria-labelledby={titleId}
      className={cx(
        'scroll-mt-6 overflow-hidden rounded-card bg-card shadow-e1',
        editing && 'outline-2 outline-acc-100',
        className,
      )}
    >
      <div
        className={cx(
          'flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line-2 px-4 text-13 font-semibold text-tx',
          mode ? 'min-h-11 py-2' : 'py-3',
        )}
      >
        <h2 id={titleId} className="m-0 text-13 font-semibold">
          {title}
        </h2>
        {hint && <span className="text-12 font-normal text-tx-3">{hint}</span>}
        {editing && (
          <span className="inline-flex h-5 items-center rounded-chip bg-acc-50 px-1.75 text-12 font-medium text-acc">
            Editing
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-13 font-medium">
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
          <div className="flex flex-wrap items-center gap-3 border-t border-line-2 bg-sunken px-4 py-2.5">
            <span className="min-w-0 flex-1 text-12 text-tx-2">
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
    </section>
  );
}
