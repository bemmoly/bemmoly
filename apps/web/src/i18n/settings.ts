import { defineCatalog } from '@bemmoly/core-web';
import source from './settings.en.json' with { type: 'json' };

/** Settings' words, in the settings chunk. Profile is the first page extracted (ADR 0024). */
export const settings = defineCatalog('settings', source);
