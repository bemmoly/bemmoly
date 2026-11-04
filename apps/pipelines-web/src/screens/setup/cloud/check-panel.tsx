import { useT } from '@bemmoly/core-web';
import { Button, ProvisionChecklist, type ProvisionState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useId } from 'react';
import { setupText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import type { ConnectCloud } from './use-connect-cloud.ts';
import { ProjectsTable } from './projects-table.tsx';

/**
 * Check: signs in the chosen way, then says per step what is done and, for the first that is
 * not, what to run; Google Cloud's own words follow as the detail. Connect appears once
 * everything checked holds.
 */
export function CheckPanel({ flow }: { flow: ConnectCloud }) {
  const t = useT(setupText);
  const titleId = useId();
  const { guide, report, checked } = flow;
  const need =
    guide.signIn === 'workload_identity_file' && !guide.credentialFile
      ? t('pipelinesSetup.guide.check.needFile')
      : guide.mode === 'managed'
        ? t('pipelinesSetup.guide.check.needFolder')
        : t('pipelinesSetup.guide.check.needReach');
  const stateLabel = (state: ProvisionState) =>
    state === 'done'
      ? t('pipelinesSetup.guide.check.done')
      : state === 'failed'
        ? t('pipelinesSetup.guide.check.failed')
        : t('pipelinesSetup.guide.check.todo');
  const problems =
    checked && (!checked.signedIn || guide.mode === 'managed') ? checked.problems : [];
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 id={titleId} className="font-semibold text-tx">
            {t('pipelinesSetup.guide.check.title')}
          </h3>
          <p className="text-13 text-tx-2">
            {flow.canCheck
              ? t('pipelinesSetup.guide.check.text')
              : t('pipelinesSetup.guide.check.notYet', { need })}
          </p>
        </div>
        <Button
          variant={report?.ready ? 'secondary' : 'primary'}
          icon={<Icon name="refresh" size={14} />}
          loading={flow.checking}
          disabled={!flow.canCheck}
          onClick={flow.check}
        >
          {checked ? t('pipelinesSetup.cloud.checkAgain') : t('pipelinesSetup.cloud.check')}
        </Button>
      </div>
      <ActionError error={flow.checkError} />
      {report && (
        <ProvisionChecklist
          ariaLabel={t('pipelinesSetup.guide.check.reportLabel')}
          stateLabel={stateLabel}
          steps={report.steps.map((step, index) => ({
            key: step.key,
            title: t('pipelinesSetup.guide.stepTitle', {
              number: index + 1,
              title: t(`pipelinesSetup.guide.step.${step.key}`),
            }),
            state: step.state,
            ...(step.note
              ? { description: t(`pipelinesSetup.guide.report.${step.note}`, step.params) }
              : {}),
          }))}
        />
      )}
      {problems.length > 0 && (
        <div role="status" className="rounded-control bg-amber-50 px-3 py-2 text-12 text-amber-tx">
          <b className="block font-semibold">{t('pipelinesSetup.guide.check.detail')}</b>
          <ul className="flex flex-col gap-0.5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      {checked?.signedIn && guide.mode === 'attached' && checked.projects.length > 0 && (
        <ProjectsTable projects={checked.projects} />
      )}
      {flow.stillMissing.length > 0 && (
        <div role="status" className="rounded-control bg-amber-50 px-3 py-2 text-12 text-amber-tx">
          <b className="block font-semibold">{t('pipelinesSetup.guide.check.stillMissing')}</b>
          <ul className="flex flex-col gap-0.5">
            {flow.stillMissing.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      {report?.ready && (
        <>
          <ActionError error={flow.connectError} />
          <div className="flex justify-end">
            <Button variant="primary" loading={flow.connecting} onClick={flow.connect}>
              {t('pipelinesSetup.cloud.connect')}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
