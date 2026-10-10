import { isApiError } from '@bemmoly/api-client';
import { Button, ConfirmChange, PageTitle, SettingsContent, SettingsFrame } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { NO_PROJECT_PERMISSION } from '../../hooks/settings-access.ts';
import type { SchemeFlow } from '../../hooks/settings-scheme-flow.ts';
import { DiffDialog, invertDiff } from '../diff-dialog.tsx';
import { InheritanceNote } from '../inheritance-note.tsx';

const failure = (error: unknown) =>
  error ? (
    <p className="m-0 text-13 text-red">
      {isApiError(error) ? error.message : 'The change was not saved.'}
    </p>
  ) : undefined;

export interface SchemePageProps {
  title: string;
  description: string;
  flow: SchemeFlow;
  canConfigure: boolean;
  children: ReactNode;
}

/**
 * The frame of a scheme page (Issue types, Fields): the header with Override
 * or Reset, the "Inherits from" banner with its diff, and the asks.
 */
export function SchemePage({ title, description, flow, canConfigure, children }: SchemePageProps) {
  const overridden = flow.status?.overridden ?? false;
  const origin = flow.status?.originName ?? 'the org default';
  const locked = canConfigure ? undefined : NO_PROJECT_PERMISSION;
  return (
    <SettingsFrame nav={null}>
      <SettingsContent width="narrow">
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
        />
        {children}
      </SettingsContent>
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
    </SettingsFrame>
  );
}
