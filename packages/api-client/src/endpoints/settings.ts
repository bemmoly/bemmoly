import {
  SETTING_SCHEMAS,
  settingEnvelopeSchema,
  type SettingKey,
  type SettingValue,
} from '@bemmoly/shared';
import { ApiError } from '../errors.ts';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

export interface SettingRead<K extends SettingKey> {
  key: K;
  /** Undefined for a secret, or a key with no stored value yet. */
  value: SettingValue<K> | undefined;
  /** Secrets: whether one is stored. */
  isSet: boolean;
}

/** One key per call on /api/v1/admin/settings/:key; values are checked per key. */
export function settingsEndpoints(http: Http) {
  async function get<K extends SettingKey>(key: K): Promise<SettingRead<K>> {
    const envelope = await http.request(
      `/api/v1/admin/settings/${enc(key)}`,
      settingEnvelopeSchema,
    );
    if (envelope.value === undefined || envelope.value === null) {
      return {
        key,
        value: envelope.value as SettingValue<K> | undefined,
        isSet: envelope.isSet ?? false,
      };
    }
    const parsed = SETTING_SCHEMAS[key].safeParse(envelope.value);
    if (!parsed.success) {
      throw new ApiError(200, 'invalid_response', `Unexpected value for setting ${key}`);
    }
    return { key, value: parsed.data as SettingValue<K>, isSet: true };
  }
  return {
    get,
    /** Reads several keys in parallel; a key the server does not know yet reads as unset. */
    getMany: async <K extends SettingKey>(keys: readonly K[]) => {
      const entries = await Promise.all(
        keys.map(async (key) => {
          try {
            return [key, await get(key)] as const;
          } catch (error) {
            if (error instanceof ApiError && error.code === 'not_found') {
              return [key, { key, value: undefined, isSet: false }] as const;
            }
            throw error;
          }
        }),
      );
      return Object.fromEntries(entries) as { [P in K]: SettingRead<P> };
    },
    put: async <K extends SettingKey>(key: K, value: SettingValue<K>) =>
      http.send(`/api/v1/admin/settings/${enc(key)}`, {
        method: 'PUT',
        body: { value: validated(SETTING_SCHEMAS[key], value) },
      }),
  };
}
