import { accessActionSchema, type AccessAction } from '@bemmoly/module-pipelines/shared';
import type { LoadOptions, SelectOption } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { pipelinesKeys } from '../../../api/pipelines.ts';
import { useMe } from '../../../hooks/use-me.ts';
import { useSearchState, useSearchText } from '../../../hooks/use-search-state.ts';
import { api } from '../../../lib/api.ts';

export const ACTIONS: readonly AccessAction[] = accessActionSchema.options;

/** People by name for the checker, from the kernel's directory. */
export const searchPeople: LoadOptions = async (query, signal) => {
  const page = await api.users.list({ q: query || undefined, limit: 20 }, { signal });
  return page.items.map((user) => ({ value: user.id, label: user.name, description: user.email }));
};

/** Applications by name or key, as the catalog searches them. */
export const searchApplications: LoadOptions = async (query) => {
  const page = await api.pipelines.applications({ q: query || undefined, limit: 20 });
  return page.items.map((application) => ({
    value: application.key,
    label: application.name,
    description: `${application.domain.name} · ${application.group.name}`,
  }));
};

/**
 * The checker's question, kept in the address (?who=&action=&app=&env=) so an answer can be
 * linked. The person defaults to whoever is asking; names for ids in the address are looked
 * up so the selects show them after a reload.
 */
export function useCheckerInputs() {
  const me = useMe().data?.user;
  const [who, setWho] = useSearchText('who');
  const [action, setAction] = useSearchState<AccessAction>('action', ACTIONS, 'request_prod');
  const [app, setApp] = useSearchText('app');
  const [env, setEnv] = useSearchText('env');
  const person = who || me?.id || '';
  const personName = useQuery({
    queryKey: ['users', person],
    queryFn: () => api.users.get(person),
    enabled: Boolean(who) && who !== me?.id,
    staleTime: 10 * 60_000,
  });
  const application = useQuery({
    queryKey: pipelinesKeys.application(app),
    queryFn: () => api.pipelines.application(app),
    enabled: Boolean(app),
  });
  const personOption: SelectOption | null =
    person === me?.id && me
      ? { value: me.id, label: me.name }
      : personName.data
        ? { value: personName.data.id, label: personName.data.name }
        : null;
  const applicationOption: SelectOption | null = application.data
    ? { value: application.data.key, label: application.data.name }
    : null;
  return {
    person,
    personOption,
    setWho,
    action,
    setAction,
    app,
    applicationOption,
    setApp,
    env,
    setEnv,
    meId: me?.id ?? null,
  };
}
