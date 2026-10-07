import {
  SETTING_SCHEMAS,
  settingResponseSchema,
  settingsListResponseSchema,
  type SettingKey,
  type SettingResponse,
  type SettingValue,
} from '@bemmoly/shared';
import { ApiError } from '../errors.ts';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

export interface SettingRead<K extends SettingKey> {
  key: K;
  /** Undefined for a secret, or a key the server does not hold. */
  value: SettingValue<K> | undefined;
  /** Secrets: whether one is stored. */
  isSet: boolean;
  isDefault: boolean;
}

function toRead<K extends SettingKey>(
  key: K,
  response: SettingResponse | undefined,
): SettingRead<K> {
  if (!response || response.value === undefined) {
    return {
      key,
      value: undefined,
      isSet: response?.isSet ?? false,
      isDefault: response?.isDefault ?? true,
    };
  }
  const parsed = SETTING_SCHEMAS[key].safeParse(response.value);
  if (!parsed.success)
    throw new ApiError(200, 'invalid_response', `Unexpected value for setting ${key}`);
  return {
    key,
    value: parsed.data as SettingValue<K>,
    isSet: response.isSet,
    isDefault: response.isDefault,
  };
}

/**
 * /api/v1/admin/settings: the list for reading several keys in one call, one
 * key per PUT. Secrets never come back, only `isSet`. A key the server does
 * not register reads as unset rather than failing the page.
 */
export function settingsEndpoints(http: Http) {
  return {
    get: async <K extends SettingKey>(key: K) =>
      toRead(key, await http.request(`/api/v1/admin/settings/${enc(key)}`, settingResponseSchema)),
    getMany: async <K extends SettingKey>(keys: readonly K[]) => {
      const { items } = await http.request('/api/v1/admin/settings', settingsListResponseSchema);
      const byKey = new Map(items.map((item) => [item.key, item]));
      return Object.fromEntries(keys.map((key) => [key, toRead(key, byKey.get(key))])) as {
        [P in K]: SettingRead<P>;
      };
    },
    /** Replaces the value; for a secret, sets the new secret. */
    put: async <K extends SettingKey>(key: K, value: SettingValue<K>) =>
      http.request(`/api/v1/admin/settings/${enc(key)}`, settingResponseSchema, {
        method: 'PUT',
        body: { value: validated(SETTING_SCHEMAS[key], value) },
      }),
    /** Returns the key to its default. */
    reset: async (key: SettingKey) =>
      http.send(`/api/v1/admin/settings/${enc(key)}`, { method: 'DELETE' }),
  };
}
