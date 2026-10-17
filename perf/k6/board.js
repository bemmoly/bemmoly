/*
 * §20: board view API on a 500-issue board, p95 under 80 ms on the reference VM.
 * Every response is checked to account for all the board project's cards, a page per column.
 *
 *   k6 run -e BASE_URL=… -e CREDENTIALS=… -e DATASET=… perf/k6/board.js   (RATE default 10/s)
 */
import { boardView } from './lib/actions.js';
import { boardProject, personForIteration } from './lib/config.js';
import { budgetOptions } from './lib/scenarios.js';

export { floor } from './lib/actions.js';

export const options = budgetOptions({ rate: 10, endpoints: ['board_view'] });

export default function () {
  boardView(personForIteration(), { verifyCards: boardProject.issues });
}
