import type { AutomationRule } from '@bemmoly/module-work/shared';
import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { RulesSkeleton, RulesTable } from './rules-table.tsx';
import type { useAutomation, useAutomationAccess } from './use-automation.ts';

interface RulesSectionProps {
  automation: ReturnType<typeof useAutomation>;
  access: ReturnType<typeof useAutomationAccess>;
  onOpen: (rule: AutomationRule) => void;
  onNew: () => void;
  onTest: (rule: AutomationRule) => void;
}

/** The project's own rules, then the global ones that also act here, each with who may change them. */
export function RulesSection({ automation, access, onOpen, onNew, onTest }: RulesSectionProps) {
  if (automation.isPending) return <RulesSkeleton />;
  const shared = {
    canChange: access.canChange,
    onOpen,
    onTest,
    onEnabled: (rule: AutomationRule, enabled: boolean) =>
      automation.setEnabled.mutate({ rule, enabled }),
    onDelete: (rule: AutomationRule) => automation.remove.mutate(rule),
  };
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="project-rules" className="flex flex-col gap-2">
        <h2 id="project-rules" className="m-0 text-14 font-semibold text-tx">
          This project
        </h2>
        {access.editRules ? null : (
          <p className="m-0 text-12 text-tx-3">
            You can read these rules. Changing them needs “Edit automation”.
          </p>
        )}
        <RulesTable
          {...shared}
          label="Project rules"
          rules={automation.projectRules}
          empty={
            <EmptyState
              icon={<Icon name="zap" />}
              title="No rules yet"
              description="Rules move issues, assign people and tell other tools when something happens."
              action={
                access.editRules ? (
                  <Button variant="primary" icon={<Icon name="plus" />} onClick={onNew}>
                    New rule
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </section>
      <section aria-labelledby="global-rules" className="flex flex-col gap-2">
        <h2 id="global-rules" className="m-0 text-14 font-semibold text-tx">
          Global rules
        </h2>
        <p className="m-0 text-12 text-tx-3">
          {access.orgAdmin
            ? 'They run in every project. You can change them as a workspace admin.'
            : 'They run in every project. Only workspace admins can change them.'}
        </p>
        <RulesTable
          {...shared}
          label="Global rules"
          rules={automation.globalRules}
          empty={
            <EmptyState
              size="sm"
              title="No global rules"
              description="Nothing from outside this project acts on its issues."
            />
          }
        />
      </section>
    </div>
  );
}
