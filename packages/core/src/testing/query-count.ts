/**
 * The query-count assertion of tech design §20: a test declares how many statements an
 * operation may run, and fails when it runs more. It is how "no N+1 anywhere" is enforced.
 *
 *   const counter = createQueryCounter();
 *   const sql = createSqlClient(url, { onQuery: counter.record });
 *   await expectMaxQueries(counter, 1, () => boardView(sql, projectId));
 */

/** BEGIN, COMMIT and friends are bookkeeping, not work; they never count. */
const TRANSACTION_CONTROL =
  /^\s*(begin|start\s+transaction|commit|end|rollback|savepoint|release)\b/i;

export interface QueryCounter {
  /** Pass as `onQuery` to createSqlClient. */
  readonly record: (statement: string) => void;
  /** Statements counted since creation or the last reset. */
  readonly count: number;
  readonly statements: readonly string[];
  reset(): void;
}

export function createQueryCounter(): QueryCounter {
  const statements: string[] = [];
  return {
    record(statement) {
      if (!TRANSACTION_CONTROL.test(statement)) statements.push(statement);
    },
    get count() {
      return statements.length;
    },
    get statements() {
      return [...statements];
    },
    reset() {
      statements.length = 0;
    },
  };
}

export class QueryBudgetExceededError extends Error {
  override readonly name = 'QueryBudgetExceededError';
  readonly budget: number;
  readonly statements: readonly string[];

  constructor(budget: number, statements: readonly string[]) {
    const list = statements
      .map((statement, index) => `  ${index + 1}. ${statement.replace(/\s+/g, ' ').trim()}`)
      .join('\n');
    super(`Expected at most ${budget} queries, ran ${statements.length}:\n${list}`);
    this.budget = budget;
    this.statements = statements;
  }
}

/**
 * Runs `operation` and throws QueryBudgetExceededError, failing the test, when it
 * ran more than `budget` statements on clients that report to `counter`. Budgets on
 * one counter must not overlap in time.
 */
export async function expectMaxQueries<T>(
  counter: QueryCounter,
  budget: number,
  operation: () => Promise<T>,
): Promise<T> {
  if (!Number.isInteger(budget) || budget < 0) {
    throw new RangeError(`A query budget is a whole number of statements, got ${budget}`);
  }
  const before = counter.count;
  const result = await operation();
  const ran = counter.statements.slice(before);
  if (ran.length > budget) throw new QueryBudgetExceededError(budget, ran);
  return result;
}
