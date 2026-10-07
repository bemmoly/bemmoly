import type { SettingsReader } from '../../modules/registries.ts';

export interface SettingsReaderHandle extends SettingsReader {
  bind(reader: SettingsReader): void;
}

/**
 * Handed to loadModules before the settings service exists (the catalog needs
 * the loaded modules), and bound to it afterwards.
 */
export function createSettingsReaderHandle(): SettingsReaderHandle {
  let target: SettingsReader | undefined;
  return {
    bind(reader) {
      target = reader;
    },
    read(key) {
      if (!target) throw new Error(`Cannot read "${key}": the settings service has not started`);
      return target.read(key);
    },
  };
}
