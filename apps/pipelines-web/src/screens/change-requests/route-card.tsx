import { useT } from '@bemmoly/core-web';
import type { ChangeRequestDetail, ChangeRequestStep } from '@bemmoly/module-pipelines/shared';
import { Avatar, Badge, Card, CardHeader, RelativeTime, RunGlyph } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { changeRequestsText } from '../../i18n/catalog.ts';
import { windowWords } from './words.ts';

/*
 * The approval route: each step in order with the people picked for it and where each one
 * stands, the steps the rule skipped at this risk, then the deploy that starts by itself.
 */

type Glyph = 'passed' | 'failed' | 'waiting' | 'queued' | 'running' | 'skipped';

const STEP_GLYPH: Record<ChangeRequestStep['state'], Glyph> = {
  approved: 'passed',
  rejected: 'failed',
  waiting: 'waiting',
  queued: 'queued',
};

function StepPeople({ step }: { step: ChangeRequestStep }) {
  const t = useT(changeRequestsText);
  if (step.picked.length === 0) {
    return (
      <span className="text-12 text-tx-3">{t('pipelinesChangeRequests.route.notPicked')}</span>
    );
  }
  return (
    <ul className="mt-1.5 flex flex-col gap-2">
      {step.picked.map((person) => {
        const decision = step.approvals.find((a) => a.by.id === person.id);
        return (
          <li key={person.id} className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-12">
              <Avatar name={person.name} size={20} />
              <span className="min-w-0 flex-1 truncate text-tx">{person.name}</span>
              {decision ? (
                <Badge
                  tone={
                    decision.decision === 'approved'
                      ? 'ok'
                      : decision.decision === 'rejected'
                        ? 'danger'
                        : 'warn'
                  }
                >
                  {t(`pipelinesChangeRequests.decision.${decision.decision}`)}{' '}
                  <RelativeTime iso={decision.at} />
                </Badge>
              ) : (
                <Badge tone="outline">
                  {t(
                    step.state === 'waiting'
                      ? 'pipelinesChangeRequests.route.waiting'
                      : 'pipelinesChangeRequests.route.notYet',
                  )}
                </Badge>
              )}
            </span>
            {decision?.note ? (
              <q className="ms-7 border-s-2 border-line ps-2 text-12 text-tx-2">{decision.note}</q>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function deployGlyph(status: ChangeRequestDetail['status']): Glyph {
  if (status === 'deployed') return 'passed';
  if (status === 'deploying') return 'running';
  if (status === 'failed' || status === 'rejected') return 'failed';
  if (status === 'withdrawn') return 'skipped';
  return 'queued';
}

export function RouteCard({ request }: { request: ChangeRequestDetail }) {
  const t = useT(changeRequestsText);
  const env = request.environment.name;
  const deploy = request.deploys[0];
  const deployLine =
    request.status === 'deployed'
      ? t('pipelinesChangeRequests.route.deployed')
      : request.status === 'deploying'
        ? t('pipelinesChangeRequests.route.deploying')
        : request.status === 'approved'
          ? t('pipelinesChangeRequests.route.waitingWindow', {
              window: windowWords(request.window, t),
            })
          : request.status === 'rejected' ||
              request.status === 'withdrawn' ||
              request.status === 'failed'
            ? t('pipelinesChangeRequests.route.notDeployed')
            : t('pipelinesChangeRequests.route.startsItself', {
                window: windowWords(request.window, t),
              });
  return (
    <Card>
      <CardHeader
        title={t('pipelinesChangeRequests.route.title')}
        hint={t('pipelinesChangeRequests.route.rule', { name: env })}
      />
      <ol className="flex flex-col gap-4 p-4">
        {request.emergencyReason ? (
          <li className="flex gap-3">
            <RunGlyph
              state="waiting"
              size={16}
              label={t('pipelinesChangeRequests.route.emergency')}
            />
            <span className="flex min-w-0 flex-col text-13">
              <b className="font-semibold">{t('pipelinesChangeRequests.route.emergency')}</b>
              <span className="text-12 text-tx-2">{request.emergencyReason}</span>
            </span>
          </li>
        ) : null}
        {request.steps.map((step, index) => {
          const got = step.approvals.filter((a) => a.decision === 'approved').length;
          return (
            <li key={step.position} className="flex gap-3">
              <RunGlyph
                state={STEP_GLYPH[step.state]}
                size={16}
                label={t(`pipelinesChangeRequests.stepState.${step.state}`)}
              />
              <span className="flex min-w-0 flex-1 flex-col text-13">
                <b className="font-semibold">
                  {t('pipelinesChangeRequests.route.step', {
                    index: index + 1,
                    name: step.group.name,
                  })}
                </b>
                <span className="text-12 text-tx-3">
                  {t('pipelinesChangeRequests.route.needed', { got, needed: step.count })}
                </span>
                <StepPeople step={step} />
              </span>
            </li>
          );
        })}
        {request.skipped.map((step) => (
          <li key={step.group.id} className="flex gap-3">
            <RunGlyph
              state="skipped"
              size={16}
              label={t('pipelinesChangeRequests.route.skippedLabel')}
            />
            <span className="flex min-w-0 flex-col text-13">
              <b className="font-semibold text-tx-3">{step.group.name}</b>
              <span className="text-12 text-tx-3">
                {t('pipelinesChangeRequests.route.skipped')}
              </span>
            </span>
          </li>
        ))}
        <li className="flex gap-3">
          <RunGlyph state={deployGlyph(request.status)} size={16} label={deployLine} />
          <span className="flex min-w-0 flex-col text-13">
            <b className="font-semibold">
              {t('pipelinesChangeRequests.route.deployTo', { name: env })}
            </b>
            <span className="text-12 text-tx-2">
              {deployLine}
              {deploy ? (
                <>
                  {' · '}
                  <Link
                    to="/releases/$releaseId/promote"
                    params={{ releaseId: deploy.releaseId }}
                    search={{ promotion: deploy.promotionId } as never}
                    className="text-acc hover:underline"
                  >
                    {t('pipelinesChangeRequests.route.openDeploy')}
                  </Link>
                </>
              ) : null}
            </span>
          </span>
        </li>
      </ol>
    </Card>
  );
}
