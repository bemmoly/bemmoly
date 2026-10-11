import { fieldErrors, isApiError } from '@bemmoly/api-client';
import type { AutomationCatalog, AutomationRule, AutomationRun } from '@bemmoly/module-work/shared';
import {
  Button,
  Field,
  formatAbsolute,
  Input,
  Modal,
  SettingsValue,
  SettingsValues,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { durationLabel, outcomeLabel, runResult, runTriggerLabel } from './describe.ts';
import { RunState } from './run-state.tsx';

interface RunDialogProps {
  run: AutomationRun | null;
  catalog: AutomationCatalog | undefined;
  onClose: () => void;
}

/** One run in full: why it ran, how deep in a chain, and each action's outcome in words. */
export function RunDialog({ run, catalog, onClose }: RunDialogProps) {
  const result = run ? runResult(run) : null;
  const actionLabel = (name: string) =>
    catalog?.actions.find((entry) => entry.name === name)?.label ?? name;
  return (
    <Modal
      open={run !== null}
      onClose={onClose}
      width="lg"
      title={run?.ruleName ?? 'Run'}
      description={
        run ? `${runTriggerLabel(run.trigger)} · ${formatAbsolute(run.createdAt)}` : undefined
      }
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {run ? (
        <div className="flex flex-col gap-4">
          <SettingsValues>
            <SettingsValue label="State">
              <RunState status={run.status} />
            </SettingsValue>
            <SettingsValue label="Issue" muted={!run.issueKey}>
              {run.issueKey ?? 'None'}
            </SettingsValue>
            <SettingsValue label="Depth" hint="How many rules in a row led to this run.">
              {run.depth}
            </SettingsValue>
            <SettingsValue label="Duration" muted={run.durationMs === null}>
              {durationLabel(run.durationMs) ?? 'Not finished'}
            </SettingsValue>
            <SettingsValue label="Outcome" muted={!outcomeLabel(run)}>
              {outcomeLabel(run) ?? 'No result yet'}
            </SettingsValue>
          </SettingsValues>
          {run.error ? (
            <p
              role="alert"
              className={`m-0 rounded-control px-3 py-2 text-13 ${run.status === 'failed' ? 'bg-red-50 text-red-tx' : 'bg-sunken text-tx-2'}`}
            >
              {run.error}
            </p>
          ) : null}
          {result && result.actions.length > 0 ? (
            <ol aria-label="Actions" className="m-0 flex list-none flex-col gap-2 p-0">
              {result.actions.map((action, index) => (
                <li key={`${action.name}-${index}`} className="flex items-start gap-2 text-13">
                  <Icon
                    name={action.ok ? 'circle-check' : 'warning'}
                    className={`mt-0.5 shrink-0 ${action.ok ? 'text-green-tx' : 'text-red-tx'}`}
                    label={action.ok ? 'Done' : 'Failed'}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium text-tx">{actionLabel(action.name)}</span>
                    <span className="text-tx-2">{action.message}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

interface TestRunDialogProps {
  rule: AutomationRule | null;
  busy: boolean;
  error: unknown;
  onRun: (issueKey: string) => void;
  onClose: () => void;
}

/** Test run: the saved rule, now, against one issue; the run lands in the log. */
export function TestRunDialog({ rule, busy, error, onRun, onClose }: TestRunDialogProps) {
  const [key, setKey] = useState('');
  const [missing, setMissing] = useState(false);
  const refused = isApiError(error) ? (fieldErrors(error)['issueKey'] ?? error.message) : null;
  const submit = () => {
    setMissing(!key.trim());
    if (key.trim()) onRun(key.trim().toUpperCase());
  };
  return (
    <Modal
      open={rule !== null}
      onClose={onClose}
      width="sm"
      title={`Test ${rule?.name ?? 'rule'}`}
      description="Runs the rule now against one issue, with its conditions and actions, as it would run for real."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="automation-test-form" loading={busy}>
            Run test
          </Button>
        </>
      }
    >
      <form
        id="automation-test-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field
          label="Issue key"
          hint="The actions really happen: a test that moves an issue moves it."
          error={missing ? 'Type the key of an issue, such as PLT-204' : (refused ?? undefined)}
        >
          <Input
            autoFocus
            className="font-mono"
            placeholder="PLT-204"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
