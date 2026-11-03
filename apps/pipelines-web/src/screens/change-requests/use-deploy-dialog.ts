import { useMemo, useState } from 'react';
import { useShippingWrites } from '../../hooks/use-shipping.ts';
import { useChangeRequestOptions, useChangeRequestWrites } from './use-change-requests.ts';

/*
 * Deploy or promote's state: a version of one service and where it goes. An environment
 * without an approval rule deploys at once; one with a rule goes through a change request,
 * or, for a Platform admin who says why, an emergency deploy now that every approver hears of.
 */

export function useDeployDialog(input: {
  application: string;
  environment?: string;
  release?: string;
}) {
  const [environment, setEnvironment] = useState(input.environment ?? '');
  const [chosen, setRelease] = useState(input.release ?? '');
  const [emergency, setEmergency] = useState(false);
  const [reason, setReason] = useState('');
  const options = useChangeRequestOptions({
    application: input.application,
    ...(environment ? { environment } : {}),
  });
  const data = options.data;
  const service = data?.services.find((s) => s.key === input.application) ?? null;
  const versions = useMemo(() => service?.versions ?? [], [service]);
  // Until one is picked, the newest version that may go.
  const release = chosen || (versions.find((v) => v.allowed) ?? versions[0])?.releaseId || '';
  const version = versions.find((v) => v.releaseId === release) ?? null;
  const shipping = useShippingWrites();
  const changes = useChangeRequestWrites();
  return {
    options,
    data,
    service,
    versions,
    version,
    environment: data?.environment.key ?? environment,
    setEnvironment,
    release,
    setRelease,
    emergency,
    setEmergency,
    reason,
    setReason,
    deploying: shipping.request.isPending || changes.create.isPending,
    /** A deploy straight away, to an environment without an approval rule. */
    deployNow: (callbacks: { onSuccess: () => void; onError: (error: unknown) => void }) =>
      shipping.request.mutate(
        { release, to: data?.environment.key ?? environment, mode: 'continuous' },
        callbacks,
      ),
    /** An admin's emergency deploy: recorded as a change request with the reason. */
    deployEmergency: (callbacks: {
      title: string;
      onSuccess: (number: string) => void;
      onError: (error: unknown) => void;
    }) =>
      changes.create.mutate(
        {
          environment: data?.environment.key ?? environment,
          title: callbacks.title,
          why: reason,
          risk: 'high',
          when: { kind: 'asap' },
          rollback: '',
          items: [{ application: input.application, releaseId: release }],
          picks: [],
          send: true,
          emergency: { reason },
        },
        { onSuccess: (detail) => callbacks.onSuccess(detail.number), onError: callbacks.onError },
      ),
  };
}
