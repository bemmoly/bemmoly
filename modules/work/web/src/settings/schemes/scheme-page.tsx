import { isApiError } from '@bemmoly/api-client';
import type { SchemeKind } from '@bemmoly/module-work/shared';
import { Button, ConfirmChange, PageTitle } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { NO_PROJECT_PERMISSION } from '../../hooks/settings-access.ts';
import type { SchemeFlow } from '../../hooks/settings-scheme-flow.ts';
import { DiffDialog, invertDiff } from '../diff-dialog.tsx';
import { InheritanceNote } from '../inheritance-note.tsx';
import { OrgDefaultNote } from '../org-default-note.tsx';

const failure = (error: unknown) =>
  error ? (
    <p className="m-0 text-13 text-red">
      {isApiError(error) ? error.message : 'The change was not saved.'}
    </p>
  ) : undefined;

export interface SchemePageProps {
  title: string;
  description: string;
  kind: SchemeKind;
  /** A project's override and reset; null on the org default page, which has neither. */
  flow: SchemeFlow | null;
  canConfigure: boolean;
  /** The org default's page, for the project note's link; set for workspace admins only. */
  defaultHref?: string | undefined;
  children: ReactNode;
}

/**
 * The frame of a scheme page (Issue types, Fields). In a project: the header with Override or
 * Reset, the "Based on" note with its diff, and the asks. On the org default: the header and
 * which projects the default reaches.
 */
export function SchemePage({
  title,
  description,
  kind,
  flow,
  canConfigure,
  defaultHref,
  children,
}: SchemePageProps) {
  if (!flow) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle variant="settings" title={title} description={description} />
        <OrgDefaultNote kind={kind} enabled={canConfigure} />
        {children}
      </div>
    );
  }
  const overridden = flow.status?.overridden ?? false;
  const origin = flow.status?.originName ?? 'the org default';
  const locked = canConfigure ? undefined : NO_PROJECT_PERMISSION;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        variant="settings"
        title={title}
        description={description}
        actions={
          overridden ? (
            <Button disabled={!canConfigure} title={locked} onClick={flow.startReset}>
              Reset to org default
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!canConfigure}
              title={locked}
              onClick={flow.startOverride}
            >
              Override for this project
            </Button>
          )
        }
      />
      <InheritanceNote
        origin={origin}
        overridden={overridden}
        changes={flow.status?.overrideCount ?? 0}
        onCompare={flow.viewDiff}
        defaultHref={defaultHref}
      />
      {children}
      <DiffDialog
        open={flow.step === 'view'}
        title={`${title} overridden on this project`}
        description={`Compared with the org default, ${origin}.`}
        entries={flow.diff.data?.entries ?? []}
        empty={
          flow.diff.isPending
            ? 'Loading the diff…'
            : `The ${title.toLowerCase()} match the org default.`
        }
        onClose={flow.close}
      />
      <DiffDialog
        open={flow.step === 'reset'}
        title="Reset to the org default"
        description={`Everything below goes back to ${origin}.`}
        entries={invertDiff(flow.diff.data?.entries ?? [])}
        empty={flow.diff.isPending ? 'Loading the diff…' : 'Nothing differs from the org default.'}
        confirmLabel="Continue"
        onConfirm={flow.continueReset}
        onClose={flow.close}
      />
      <ConfirmChange
        {...flow.overrideAsk}
        open={flow.step === 'confirm-override'}
        busy={flow.override.isPending}
        error={failure(flow.override.error)}
        onConfirm={flow.confirmOverride}
        onCancel={flow.close}
      />
      <ConfirmChange
        {...flow.resetAsk}
        open={flow.step === 'confirm-reset'}
        busy={flow.reset.isPending}
        error={failure(flow.reset.error)}
        onConfirm={flow.confirmReset}
        onCancel={flow.close}
      />
    </div>
  );
}
