import { queryKeys, type SettingRead } from '@bemmoly/api-client';
import type { SettingKey, SettingValue } from '@bemmoly/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';

export type SettingReads<K extends SettingKey> = { [P in K]: SettingRead<P> };
export type SettingValues<K extends SettingKey> = { [P in K]?: SettingValue<P> };

export const settingsQuery = <const K extends SettingKey>(keys: readonly K[]) =>
  queryOptions({
    queryKey: queryKeys.settings.many(keys),
    queryFn: () => api.settings.getMany(keys) as Promise<SettingReads<K>>,
  });

/**
 * Several settings keys read together and saved together. Only keys whose
 * value is given are written, so a blank secret field keeps the stored secret.
 */
export function useSettings<const K extends SettingKey>(
  keys: readonly K[],
  savedMessage = 'Saved',
) {
  const queryClient = useQueryClient();
  const query = useQuery(settingsQuery(keys));
  const save = useMutation({
    mutationFn: async (values: SettingValues<K>) => {
      for (const key of keys) {
        const value = values[key];
        if (value !== undefined) await api.settings.put(key, value as SettingValue<K>);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() });
      toast(savedMessage);
    },
    onError: (error) => toast(describeError(error).message, 'danger'),
  });
  return { ...query, reads: query.data, save };
}

/** Values of a read, for seeding a form; secrets come back undefined. */
export function valuesOf<K extends SettingKey>(
  reads: SettingReads<K> | undefined,
): SettingValues<K> {
  if (!reads) return {};
  const values: SettingValues<K> = {};
  for (const key of Object.keys(reads) as K[]) values[key] = reads[key].value;
  return values;
}

/**
 * A local draft for a form: starts from the stored values, tracks whether it
 * changed, and resets on Discard. Stored values stay in the query cache.
 */
export function useDraft<T>(stored: T | undefined) {
  const [draft, setDraft] = useState<T | undefined>(undefined);
  const value = draft ?? stored;
  const dirty = draft !== undefined && JSON.stringify(draft) !== JSON.stringify(stored);
  const update = (patch: Partial<T>) => setDraft({ ...(value as T), ...patch });
  return { value, dirty, update, replace: setDraft, discard: () => setDraft(undefined) };
}
