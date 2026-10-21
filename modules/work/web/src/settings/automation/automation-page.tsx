import { isApiError } from '@bemmoly/api-client';
import { HeaderActions } from '@bemmoly/core-web';
import type { AutomationRule } from '@bemmoly/module-work/shared';
import { Button, EmptyState, PageTitle, SegmentedControl } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { setSearchParams, useSearchParam } from '../../shared/url-state.ts';
import { RuleBuilder } from './rule-builder.tsx';
import { RunDialog, TestRunDialog } from './run-dialogs.tsx';
import { RulesSection } from './rules-section.tsx';
import { RUN_FILTERS } from './run-filters.ts';
import { RunsTable } from './runs-table.tsx';
import { useAutomation, useAutomationAccess } from './use-automation.ts';
import { useAutomationRuns } from './use-automation-runs.ts';
import { useRuleOptions } from './use-rule-options.ts';

type View = 'rules' | 'runs';

/**
 * Project settings › Automation: the rules that act on this project's issues (its own, then
 * the global ones), the builder, a test run against one issue, and the run log.
 */
export function AutomationPage({ projectKey }: { projectKey: string | undefined }) {
  const automation = useAutomation(projectKey);
  const access = useAutomationAccess(projectKey);
  const view: View = useSearchParam('view') === 'runs' ? 'runs' : 'rules';
  const runs = useAutomationRuns(automation.projectId, view === 'runs');
  const options = useRuleOptions(projectKey, automation.projectId);
  const ruleParam = useSearchParam('rule');
  const [testing, setTesting] = useState<AutomationRule | null>(null);
  const openRule = (id: string | null) => setSearchParams({ rule: id }, { push: id !== null });
  const editing = ruleParam === 'new' ? null : automation.byId(ruleParam);
  const builderOpen = ruleParam === 'new' || editing !== undefined;
  const readOnly = (rule: AutomationRule | null) =>
    rule && !access.canChange(rule)
      ? rule.projectId === null
        ? 'A global rule. Only workspace admins can change it.'
        : 'You need “Edit automation” to change this rule.'
      : null;
  const count = automation.projectRules.length + automation.globalRules.length;

  if (automation.projectMissing) {
    return (
      <EmptyState
        title="No such project"
        description={`There is no project ${projectKey ?? ''}.`}
      />
    );
  }
  const failure = automation.error;
  return (
    <div className="flex flex-col gap-6">
      <HeaderActions>
        <Button
          variant="primary"
          icon={<Icon name="plus" />}
          disabled={!access.editRules}
          title={access.editRules ? undefined : 'You need “Edit automation” to add rules.'}
          onClick={() => openRule('new')}
        >
          New rule
        </Button>
      </HeaderActions>
      <PageTitle
        variant="settings"
        title="Automation"
        description="Rules that act on this project’s issues by themselves: when something happens, if the issue matches, do these things."
      />
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          aria-label="Automation view"
          className="w-64"
          options={[
            { value: 'rules', label: `Rules · ${count}` },
            { value: 'runs', label: 'Run log' },
          ]}
          value={view}
          onChange={(next) => setSearchParams({ view: next === 'runs' ? 'runs' : null, run: null })}
        />
        {view === 'runs' ? (
          <SegmentedControl
            size="sm"
            aria-label="Show runs"
            options={RUN_FILTERS}
            value={runs.status}
            onChange={runs.setStatus}
          />
        ) : null}
      </div>
      {failure ? (
        <EmptyState
          icon={<Icon name="warning" />}
          title="Automation didn’t load"
          description={`${isApiError(failure) ? failure.message : 'Check your connection.'} Nothing was changed.`}
          action={<Button onClick={() => void automation.rules.refetch()}>Try again</Button>}
        />
      ) : view === 'rules' ? (
        <RulesSection
          automation={automation}
          access={access}
          onOpen={(rule) => openRule(rule.id)}
          onNew={() => openRule('new')}
          onTest={setTesting}
        />
      ) : (
        <RunsTable runs={runs} />
      )}
      {builderOpen ? (
        <RuleBuilder
          key={ruleParam ?? 'none'}
          rule={editing ?? null}
          projectId={automation.projectId}
          catalog={automation.catalog.data}
          options={options}
          readOnly={readOnly(editing ?? null)}
          onClose={() => openRule(null)}
        />
      ) : null}
      {testing ? (
        <TestRunDialog
          rule={testing}
          busy={automation.test.isPending}
          error={automation.test.error}
          onClose={() => {
            automation.test.reset();
            setTesting(null);
          }}
          onRun={(issueKey) =>
            automation.test.mutate(
              { rule: testing, issueKey },
              {
                onSuccess: (run) => {
                  setTesting(null);
                  setSearchParams({ view: 'runs', status: null, run: run.id });
                },
              },
            )
          }
        />
      ) : null}
      <RunDialog
        run={runs.open}
        catalog={automation.catalog.data}
        onClose={() => runs.setOpen(null)}
      />
    </div>
  );
}
