import { useT } from '@bemmoly/core-web';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  Modal,
  Radio,
  Skeleton,
  Textarea,
  useToast,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { changeRequestsText } from '../../i18n/catalog.ts';
import { LoadFailed, refusalOf } from '../../parts/load-failed.tsx';
import { useDeployDialog } from './use-deploy-dialog.ts';

const EMERGENCY_MIN = 10;

/**
 * Deploy or promote, opened from a service, a run or a version: pick a version and where it
 * goes. Where the environment has no approval rule it deploys now, unchanged; where it has
 * one the person writes a change request, and a Platform admin may deploy now without
 * approval, giving a reason every approver reads.
 */
export function DeployOrPromoteDialog(props: DeployOrPromoteProps) {
  // Each opening starts afresh from what it was opened on.
  return props.open ? <DeployOrPromote {...props} /> : null;
}

interface DeployOrPromoteProps {
  open: boolean;
  onClose: () => void;
  /** The service's key. */
  application: string;
  /** Start on this environment's key; absent, the first one with an approval rule. */
  environment?: string;
  /** Start on this version (a release id). */
  release?: string;
}

function DeployOrPromote({
  open,
  onClose,
  application,
  environment,
  release,
}: DeployOrPromoteProps) {
  const t = useT(changeRequestsText);
  const toast = useToast();
  const navigate = useNavigate();
  const state = useDeployDialog({
    application,
    ...(environment ? { environment } : {}),
    ...(release ? { release } : {}),
  });
  const { data, version } = state;
  const target = data?.environments.find((e) => e.key === state.environment) ?? null;
  const needsChange = Boolean(target?.needsChangeRequest);
  const failed = (error: unknown) =>
    toast.show({
      tone: 'danger',
      title: t('pipelinesChangeRequests.deploy.failed'),
      body: refusalOf(error)?.sentence ?? (error instanceof Error ? error.message : ''),
    });
  const writeChange = () => {
    onClose();
    void navigate({
      to: '/changes/new',
      search: { environment: state.environment, application, release: state.release } as never,
    });
  };
  const go = () => {
    if (!version || !target) return;
    if (needsChange && state.emergency) {
      state.deployEmergency({
        title: t('pipelinesChangeRequests.deploy.emergencyTitle', {
          application,
          version: version.version,
        }),
        onSuccess: (number) => {
          onClose();
          void navigate({ to: '/changes/$number', params: { number } });
        },
        onError: failed,
      });
      return;
    }
    if (needsChange) return writeChange();
    state.deployNow({
      onSuccess: () => {
        onClose();
        toast.show({
          tone: 'ok',
          title: t('pipelinesChangeRequests.deploy.started', {
            version: version.version,
            name: target.name,
          }),
        });
      },
      onError: failed,
    });
  };
  const ready =
    Boolean(version?.allowed) && (!state.emergency || state.reason.trim().length >= EMERGENCY_MIN);
  const label =
    !version || !target
      ? t('pipelinesChangeRequests.deploy.pick')
      : needsChange
        ? state.emergency
          ? t('pipelinesChangeRequests.deploy.emergencyNow')
          : t('pipelinesChangeRequests.deploy.writeChange')
        : t('pipelinesChangeRequests.deploy.deployTo', {
            version: version.version,
            name: target.name,
          });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('pipelinesChangeRequests.deploy.title', { application })}
      description={t('pipelinesChangeRequests.deploy.description')}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('pipelinesChangeRequests.common.cancel')}
          </Button>
          <Button
            variant={state.emergency ? 'danger' : 'primary'}
            disabled={!ready}
            loading={state.deploying}
            icon={
              needsChange && !state.emergency ? (
                <Icon name="checklist" size={14} />
              ) : (
                <Icon name="rocket" size={14} />
              )
            }
            onClick={go}
          >
            {label}
          </Button>
        </>
      }
    >
      {state.options.isError ? (
        <LoadFailed
          error={state.options.error}
          onRetry={() => void state.options.refetch()}
          bare
          size="sm"
        />
      ) : !data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="flex flex-col gap-4">
          <Field label={t('pipelinesChangeRequests.deploy.version')}>
            <div
              role="radiogroup"
              aria-label={t('pipelinesChangeRequests.deploy.version')}
              className="flex flex-col gap-1.5"
            >
              {state.versions.slice(0, 6).map((v) => (
                <div
                  key={v.releaseId}
                  className="flex items-center gap-2 rounded-control border border-line px-2.5 py-1.5"
                >
                  <Radio
                    name="deploy-version"
                    checked={v.releaseId === state.release}
                    disabled={!v.allowed}
                    onChange={() => state.setRelease(v.releaseId)}
                    label={
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-mono font-semibold">{v.version}</span>
                        <span className="min-w-0 flex-1 truncate text-12 text-tx-2">
                          {v.summary ?? v.commitSha.slice(0, 7)}
                        </span>
                      </span>
                    }
                  />
                  <span className="ms-auto flex flex-wrap gap-1">
                    {v.runningIn.map((key) => (
                      <Badge key={key} tone="outline">
                        {data.environments.find((e) => e.key === key)?.name ?? key}
                      </Badge>
                    ))}
                  </span>
                </div>
              ))}
              {state.versions.length === 0 ? (
                <span className="text-12 text-tx-3">
                  {t('pipelinesChangeRequests.deploy.noVersions')}
                </span>
              ) : null}
            </div>
          </Field>
          <Field label={t('pipelinesChangeRequests.deploy.to')}>
            <div
              role="radiogroup"
              aria-label={t('pipelinesChangeRequests.deploy.to')}
              className="grid grid-cols-2 gap-2 md:grid-cols-3"
            >
              {data.environments.map((env) => (
                <div key={env.key} className="rounded-control border border-line px-2.5 py-2">
                  <Radio
                    name="deploy-environment"
                    checked={env.key === state.environment}
                    onChange={() => state.setEnvironment(env.key)}
                    label={<span className="font-semibold">{env.name}</span>}
                    description={
                      env.needsChangeRequest
                        ? t('pipelinesChangeRequests.deploy.changeRequest')
                        : t('pipelinesChangeRequests.deploy.direct')
                    }
                  />
                </div>
              ))}
            </div>
          </Field>
          {version && !version.allowed && data.previousEnvironment ? (
            <p className="text-12 text-amber-tx">
              {t('pipelinesChangeRequests.deploy.notPassed', {
                previous: data.previousEnvironment.name,
              })}
            </p>
          ) : null}
          {needsChange ? (
            <>
              <p className="flex items-start gap-2 rounded-card border border-line bg-acc-50 px-3 py-2.5 text-13">
                <Icon name="checklist" size={16} className="mt-0.5 shrink-0 text-acc" />
                {t('pipelinesChangeRequests.deploy.needsChange', {
                  name: data.environment.name,
                  steps: data.steps
                    .filter((s) => s.applies)
                    .map((s) =>
                      t('pipelinesChangeRequests.deploy.stepWords', {
                        count: s.count,
                        name: s.group.name,
                      }),
                    )
                    .join(t('pipelinesChangeRequests.deploy.then')),
                  version: version?.version ?? '',
                })}
              </p>
              {data.canEmergencyDeploy ? (
                <>
                  <Checkbox
                    checked={state.emergency}
                    onChange={(e) => state.setEmergency(e.target.checked)}
                    label={t('pipelinesChangeRequests.deploy.emergency')}
                    description={t('pipelinesChangeRequests.deploy.emergencyHint')}
                  />
                  {state.emergency ? (
                    <Field
                      label={t('pipelinesChangeRequests.deploy.reason')}
                      hint={t('pipelinesChangeRequests.deploy.reasonHint', {
                        count: EMERGENCY_MIN,
                      })}
                    >
                      <Textarea
                        value={state.reason}
                        onChange={(e) => state.setReason(e.target.value)}
                      />
                    </Field>
                  ) : null}
                </>
              ) : null}
            </>
          ) : target ? (
            <p className="text-13 text-tx-2">
              {t('pipelinesChangeRequests.deploy.whatRuns', { name: target.name })}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
