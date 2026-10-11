import { defineCatalog } from '@bemmoly/core-web';
import source from './auth.en.json' with { type: 'json' };

/** The pages before sign-in, in their own lazy chunks with the words they draw (ADR 0025). */
export const authText = defineCatalog('auth', source);
