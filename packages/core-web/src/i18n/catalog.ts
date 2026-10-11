import source from './core.en.json' with { type: 'json' };
import { defineCatalog } from './runtime.ts';

/** The kernel UI's own words: the frame, the page header and the phone's bottom bar. */
export const core = defineCatalog('core', source);
