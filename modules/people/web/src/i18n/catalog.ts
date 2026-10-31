import { defineCatalog } from '@bemmoly/core-web';
import source from './people.en.json' with { type: 'json' };

/** People's own words (ADR 0025), loaded with its chunk. */
export const peopleText = defineCatalog('people', source);
