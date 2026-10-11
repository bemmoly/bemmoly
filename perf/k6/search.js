/*
 * §20: search autocomplete, p95 under 100 ms. One iteration is a person typing a term into
 * ⌘K, a keystroke at a time from the third letter: each keystroke asks Work's suggestions
 * and every module's search, as the palette does. Full issue search is measured alongside.
 *
 *   k6 run -e BASE_URL=… -e CREDENTIALS=… -e DATASET=… perf/k6/search.js   (RATE default 4/s)
 */
import { issueSearch, paletteTyping } from './lib/actions.js';
import { personForIteration } from './lib/config.js';
import { budgetOptions } from './lib/scenarios.js';

export { floor } from './lib/actions.js';

export const options = budgetOptions({
  rate: 4,
  endpoints: ['search_suggest', 'palette_search', 'issue_search'],
});

export default function () {
  const person = personForIteration();
  paletteTyping(person, undefined, 0.12);
  issueSearch(person);
}
