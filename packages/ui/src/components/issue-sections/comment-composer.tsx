import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { Avatar } from '../avatar/avatar.tsx';
import type { ActivityPerson } from './activity.tsx';

export interface CommentComposerProps {
  viewer: ActivityPerson;
  /** The editor, or the collapsed placeholder line. */
  children: ReactNode;
  /** B, I, @, Link, Code: ComposerTools in a 12px tx4 row. */
  tools?: ReactNode;
  /** Content at the end of the tool row, such as the AI module's draft action. */
  end?: ReactNode;
  className?: string;
}

/**
 * The comment box at the top of Activity: the viewer's 28px avatar beside a br3-bordered 7px
 * box, 10px 12px inside, the editor over the tool row 10px below.
 */
export function CommentComposer({ viewer, children, tools, end, className }: CommentComposerProps) {
  return (
    <div className={cx('flex gap-2.5', className)}>
      <Avatar
        name={viewer.name}
        hue={viewer.hue}
        size={28}
        {...(viewer.initials ? { initials: viewer.initials } : {})}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-panel border border-br3 bg-sf px-3 py-2.5 text-13 text-tx">
        {children}
        {(tools || end) && (
          <div className="flex items-center gap-2.5 text-12 text-tx4">
            {tools}
            {end && <span className="ml-auto flex items-center">{end}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** The placeholder line of a collapsed composer: "Add a comment…" in tx5 with the mono key hint. */
export function ComposerPlaceholder({
  hint,
  children = 'Add a comment…',
}: {
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1 text-tx5">
      {children}
      {hint && <span className="font-mono text-11 font-medium">{hint}</span>}
    </span>
  );
}

export interface ComposerToolProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: the glyph alone does not name the action. */
  label: string;
}

/** One formatting tool: text in 12px tx4 (the mock's B, I, @, Link, Code). */
export function ComposerTool({ label, className, type = 'button', ...rest }: ComposerToolProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'cursor-pointer rounded-xs border-0 bg-transparent p-0 font-sans text-12 text-tx4 hover:text-tx2',
        focusRing,
        className,
      )}
      {...rest}
    />
  );
}
