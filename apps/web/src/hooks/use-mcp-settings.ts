import { queryKeys } from '@bemmoly/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { useModules } from './use-modules.ts';
import { settingsQuery, type SettingReads } from './use-setting.ts';

const KEYS = ['mcp.enabled', 'mcp.modules'] as const;
type Keys = (typeof KEYS)[number];

export interface McpPatch {
  enabled?: boolean;
  modules?: string[] | null;
}

/** The URL clients connect to: every exposed module, or one module's own endpoint. */
export const mcpEndpoint = (origin: string, moduleId?: string) =>
  moduleId ? `${origin}/mcp/${moduleId}` : `${origin}/mcp`;

/** A client configuration for the streamable HTTP transport, the shape most clients read. */
export function mcpSnippet(url: string): string {
  const config = {
    mcpServers: {
      bemmoly: {
        type: 'http',
        url,
        headers: { Authorization: 'Bearer <your token>' },
      },
    },
  };
  return JSON.stringify(config, null, 2);
}

/**
 * Settings › MCP server: whether clients may connect and which enabled modules they see. Each
 * change applies at once, optimistically, and rolls back if the server refuses it.
 */
export function useMcpSettings() {
  const queryClient = useQueryClient();
  const options = settingsQuery(KEYS);
  const query = useQuery(options);
  const modules = useModules();
  const enabled = query.data?.['mcp.enabled'].value ?? false;
  const exposed = query.data?.['mcp.modules'].value ?? null;

  const mutation = useMutation({
    mutationFn: async (patch: McpPatch) => {
      if (patch.enabled !== undefined) await api.settings.put('mcp.enabled', patch.enabled);
      if (patch.modules !== undefined) await api.settings.put('mcp.modules', patch.modules);
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey });
      const before = queryClient.getQueryData<SettingReads<Keys>>(options.queryKey);
      if (before) {
        queryClient.setQueryData<SettingReads<Keys>>(options.queryKey, {
          'mcp.enabled': { ...before['mcp.enabled'], value: patch.enabled ?? enabled },
          'mcp.modules': {
            ...before['mcp.modules'],
            value: patch.modules === undefined ? exposed : patch.modules,
          },
        });
      }
      return { before };
    },
    onError: (error, _, context) => {
      if (context?.before) queryClient.setQueryData(options.queryKey, context.before);
      toast(`Couldn’t save the change. ${describeError(error).message}`, 'danger');
    },
    onSuccess: (_, patch) => {
      if (patch.enabled !== undefined)
        toast(patch.enabled ? 'MCP server turned on' : 'MCP server turned off');
      else toast('Exposed modules saved');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() }),
  });

  const available = (modules.data ?? []).map((module) => ({
    id: module.id,
    name: module.name ?? module.id,
  }));
  const isExposed = (id: string) => exposed === null || exposed.includes(id);
  const setAll = (all: boolean) =>
    mutation.mutate({ modules: all ? null : available.map((module) => module.id) });
  const toggleModule = (id: string, on: boolean) => {
    const current = exposed ?? available.map((module) => module.id);
    const next = on ? [...new Set([...current, id])] : current.filter((entry) => entry !== id);
    if (next.length === 0) {
      toast('Keep at least one module exposed, or turn the MCP server off.', 'danger');
      return;
    }
    mutation.mutate({ modules: next });
  };

  return {
    query,
    loading: query.isPending || modules.isPending,
    error: query.error ?? modules.error,
    enabled,
    exposed,
    available,
    isExposed,
    setEnabled: (on: boolean) => mutation.mutate({ enabled: on }),
    setAll,
    toggleModule,
    pending: mutation.isPending,
  };
}
