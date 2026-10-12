import { queryKeys } from '@bemmoly/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { codeHostsApi } from '../lib/code-hosts-api.ts';
import { toast } from '../lib/toast.ts';

/** What GitHub adds to the address on its way back; cleared once read. */
const RETURN_PARAMS = ['code', 'state', 'installed', 'installation_id', 'setup_action'];

export interface GithubAppReturn {
  /** "Saving the GitHub App…" while a step runs; null otherwise. */
  working: string | null;
  error: unknown;
  /** Something to tell the admin that is not an error, such as an approval GitHub asked for. */
  notice: string | null;
}

type Trip =
  | { step: 'created'; code: string; state: string }
  | { step: 'installed'; id: string; installationId: string }
  | { step: 'requested' };

/** Read raw, once: GitHub's code works a single time and must reach the server as sent. */
function readTrip(): Trip | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (code && state) return { step: 'created', code, state };
  const id = params.get('installed');
  if (!id) return null;
  const installationId = params.get('installation_id');
  return installationId ? { step: 'installed', id, installationId } : { step: 'requested' };
}

const first = (trip: Trip | null): GithubAppReturn => ({
  working:
    trip?.step === 'created'
      ? 'Saving the GitHub App…'
      : trip?.step === 'installed'
        ? 'Reading the repositories GitHub gave access to…'
        : null,
  error: null,
  notice:
    trip?.step === 'requested'
      ? 'GitHub asked an organization owner to approve the app. Once they do, choose its repositories from its card.'
      : null,
});

/**
 * Finishes connecting GitHub when the admin comes back from it: after creating the app
 * (`code` and `state`) the app is stored and the admin goes straight on to install it; after
 * installing it (`installed` and `installation_id`) its repositories are read and the
 * backfill starts.
 */
export function useGithubAppReturn(enabled: boolean): GithubAppReturn {
  const navigate = useNavigate();
  const client = useQueryClient();
  const handled = useRef(false);
  const [trip] = useState(() => (enabled ? readTrip() : null));
  const [result, setResult] = useState<GithubAppReturn>(() => first(trip));

  useEffect(() => {
    if (!trip || handled.current) return;
    handled.current = true;
    // Replaced, so Back from GitHub's install page never replays a spent code.
    const clear = () =>
      navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => {
          const rest = { ...previous };
          for (const name of RETURN_PARAMS) delete rest[name];
          return rest;
        },
        replace: true,
      } as never);
    const fail = async (error: unknown) => {
      setResult({ working: null, error, notice: null });
      await clear();
    };

    if (trip.step === 'requested') {
      void clear();
    } else if (trip.step === 'created') {
      codeHostsApi
        .completeGithubApp({ code: trip.code, state: trip.state })
        .then(async ({ installUrl }) => {
          await clear();
          window.location.assign(installUrl);
        })
        .catch(fail);
    } else {
      codeHostsApi
        .installGithubApp(trip.id, { installationId: trip.installationId })
        .then(async (host) => {
          const count = host.repositories.length;
          toast(
            count === 0
              ? `${host.name} connected`
              : `${host.name} connected to ${count} ${count === 1 ? 'repository' : 'repositories'}; backfill started`,
          );
          setResult(first(null));
          await client.invalidateQueries({ queryKey: queryKeys.codeHosts.all() });
          await clear();
        })
        .catch(fail);
    }
  }, [trip, navigate, client]);

  return result;
}
