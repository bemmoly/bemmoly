import { useT } from '@bemmoly/core-web';
import { AccessExplain, EntityTile, Field, Select, Skeleton } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import type { Ref } from 'react';
import { pipelinesKeys } from '../../../api/pipelines.ts';
import { useAccessCheck } from '../../../hooks/use-access.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { api } from '../../../lib/api.ts';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { ACTIONS, searchApplications, searchPeople, useCheckerInputs } from './checker-inputs.ts';

/**
 * "Can this person do this, and why": pick a person, an action and an application (and an
 * environment for deploys), and the decision arrives with every binding and policy that made
 * it. The same explanation answers a refusal anywhere else.
 */
export function Checker({ personRef }: { personRef: Ref<HTMLButtonElement> }) {
  const t = useT(pipelinesText);
  const input = useCheckerInputs();
  const environments = useQuery({
    queryKey: pipelinesKeys.environments(),
    queryFn: () => api.pipelines.environments(),
    staleTime: 5 * 60_000,
  });
  const ready = Boolean(input.person && input.app);
  const check = useAccessCheck(
    ready
      ? {
          user: input.person,
          action: input.action,
          application: input.app,
          ...(input.env ? { environment: input.env } : {}),
        }
      : null,
  );
  const decision = check.data;
  return (
    <Panel title={t('pipelines.access.check')}>
      <div className="flex flex-col gap-2.5 pt-1">
        <Field label={t('pipelines.access.checkPerson')}>
          <Select
            ref={personRef}
            value={input.person}
            options={input.personOption ? [input.personOption] : []}
            loadOptions={searchPeople}
            searchPlaceholder={t('pipelines.access.searchPeople')}
            onChange={(event) => input.setWho(event.value === input.meId ? '' : event.value)}
          />
        </Field>
        <Field label={t('pipelines.access.checkAction')}>
          <Select
            value={input.action}
            options={ACTIONS.map((action) => ({
              value: action,
              label: t(`pipelines.action.${action}`),
            }))}
            onChange={(event) => input.setAction(event.value as (typeof ACTIONS)[number])}
          />
        </Field>
        <Field label={t('pipelines.access.checkApplication')}>
          <Select
            value={input.app}
            placeholder={t('pipelines.access.searchApplications')}
            options={input.applicationOption ? [input.applicationOption] : []}
            loadOptions={searchApplications}
            searchPlaceholder={t('pipelines.access.searchApplications')}
            onChange={(event) => input.setApp(event.value)}
          />
        </Field>
        <Field label={t('pipelines.access.checkEnvironment')}>
          <Select
            value={input.env}
            options={[
              { value: '', label: t('pipelines.access.anyEnvironment') },
              ...(environments.data?.items.map((environment) => ({
                value: environment.key,
                label: environment.name,
              })) ?? []),
            ]}
            onChange={(event) => input.setEnv(event.value)}
          />
        </Field>
      </div>
      <div className="mt-4" aria-live="polite">
        {!ready ? (
          <p className="text-12 leading-body text-tx-3">{t('pipelines.access.checkHint')}</p>
        ) : check.isError ? (
          <LoadFailed bare size="sm" error={check.error} onRetry={() => void check.refetch()} />
        ) : !decision ? (
          <div aria-busy className="flex flex-col gap-2">
            <Skeleton height={56} />
            <Skeleton width="60%" height={10} />
            <Skeleton width="80%" height={10} />
          </div>
        ) : (
          <AccessExplain
            allowed={decision.allowed}
            verdict={t(
              decision.allowed ? 'pipelines.access.allowed' : 'pipelines.access.notAllowed',
            )}
            sentence={decision.sentence}
            traceLabel={t('pipelines.access.howDecided')}
            steps={decision.trace.map((step, index) => ({
              key: String(index),
              text: step.text,
              effect: step.effect,
            }))}
            action={
              decision.askWho ? (
                <span className="flex flex-wrap items-center gap-1.5 text-12 text-tx-2">
                  {decision.askWho.teams.map((team) => (
                    <EntityTile key={team.id} name={team.name} size={16} />
                  ))}
                  {decision.askWho.label}
                </span>
              ) : undefined
            }
          />
        )}
      </div>
    </Panel>
  );
}
