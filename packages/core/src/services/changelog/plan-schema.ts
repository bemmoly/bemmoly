import type { PreconditionCheck } from '../../contracts/changelog.ts';

/**
 * The schema objects earlier pending changesets in a plan create or drop,
 * read from the DDL they would run. `db plan` never executes that DDL, so
 * without this a precondition such as "users exists" is checked against a
 * schema that update would already have changed by the time it gets there.
 */
export interface PlannedSchema {
  record(statement: string): void;
  /** The simulated answer, or undefined when the plan does not touch the object. */
  answer(check: PreconditionCheck): boolean | undefined;
}

const IDENT = String.raw`(?:"[^"]+"|[\w$]+)`;
const NAME = String.raw`(${IDENT}(?:\.${IDENT})?)`;
const IF_NOT_EXISTS = String.raw`(?:if\s+not\s+exists\s+)?`;
const IF_EXISTS = String.raw`(?:if\s+exists\s+)?`;
const CREATE_TABLE = new RegExp(
  String.raw`^create\s+(?:(?:global\s+|local\s+)?(?:temporary|temp|unlogged)\s+)?table\s+${IF_NOT_EXISTS}${NAME}\s*\(`,
  'i',
);
const CREATE_INDEX = new RegExp(
  String.raw`^create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?${IF_NOT_EXISTS}${NAME}\s+on\s+(?:only\s+)?${NAME}`,
  'i',
);
const DROP = new RegExp(
  String.raw`^drop\s+(table|index)\s+(?:concurrently\s+)?${IF_EXISTS}([^;]+?)(?:\s+(?:cascade|restrict))?$`,
  'i',
);
const ALTER_TABLE = new RegExp(
  String.raw`^alter\s+table\s+${IF_EXISTS}(?:only\s+)?${NAME}\s+([\s\S]+)$`,
  'i',
);
const ADD_COLUMN = new RegExp(String.raw`^add\s+(?:column\s+)?${IF_NOT_EXISTS}(${IDENT})`, 'i');
const DROP_COLUMN = new RegExp(String.raw`^drop\s+(?:column\s+)?${IF_EXISTS}(${IDENT})`, 'i');
const RENAME_COLUMN = new RegExp(
  String.raw`^rename\s+(?:column\s+)?(${IDENT})\s+to\s+(${IDENT})$`,
  'i',
);
const RENAME_TABLE = new RegExp(String.raw`^rename\s+to\s+(${IDENT})$`, 'i');
const NOT_A_COLUMN = new Set(['constraint', 'primary', 'unique', 'check', 'foreign', 'exclude']);

function identifier(part: string): string {
  return part.startsWith('"') ? part.slice(1, -1) : part.toLowerCase();
}

/** Schema-qualified names in `public` compare equal to bare ones. */
function normalize(name: string): string {
  const parts = (name.trim().match(new RegExp(IDENT, 'g')) ?? []).map(identifier);
  return parts.length === 2 && parts[0] === 'public' ? (parts[1] ?? '') : parts.join('.');
}

function bare(name: string): string {
  return normalize(name).split('.').pop() ?? '';
}

/** Calls `visit` for each character outside quotes, comments and dollar-quoted bodies. */
function scan(text: string, visit: (char: string, index: number) => boolean | void): void {
  for (let i = 0; i < text.length; i++) {
    const char = text[i] ?? '';
    if (char === "'" || char === '"') {
      i = text.indexOf(char, i + 1);
    } else if (char === '$' && /^\$\w*\$/.test(text.slice(i))) {
      const tag = /^\$\w*\$/.exec(text.slice(i))?.[0] ?? '$$';
      const end = text.indexOf(tag, i + tag.length);
      i = end === -1 ? -1 : end + tag.length - 1;
    } else if (char === '-' && text[i + 1] === '-') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end;
    } else if (visit(char, i) === false) return;
    if (i === -1) return;
  }
}

/** Splits on a separator outside quotes, parentheses and dollar-quoted bodies. */
export function splitTopLevel(text: string, separator: ',' | ';'): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  scan(text, (char, index) => {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  });
  parts.push(text.slice(start));
  return parts.map((part) => part.replace(/^(\s*--[^\n]*(\n|$))*/, '').trim()).filter(Boolean);
}

function closingParen(text: string, open: number): number {
  let depth = 0;
  let close = -1;
  scan(text, (char, index) => {
    if (index >= open && char === '(') depth++;
    if (index >= open && char === ')' && --depth === 0) close = index;
    return close === -1;
  });
  return close;
}

function columnsOf(statement: string, open: number): string[] | undefined {
  const close = closingParen(statement, open);
  if (close === -1) return undefined;
  const columns: string[] = [];
  for (const element of splitTopLevel(statement.slice(open + 1, close), ',')) {
    const first = new RegExp(`^${IDENT}`).exec(element)?.[0] ?? '';
    if (first.toLowerCase() === 'like') return undefined;
    if (!NOT_A_COLUMN.has(first.toLowerCase())) columns.push(identifier(first));
  }
  return columns;
}

export function createPlannedSchema(): PlannedSchema {
  const known = new Map<string, boolean>();
  /** Tables created in the plan whose full column list is known. */
  const complete = new Set<string>();
  const indexTables = new Map<string, string>();

  const setTable = (table: string, exists: boolean) => {
    known.set(`table:${table}`, exists);
    for (const key of [...known.keys()]) {
      if (key.startsWith(`column:${table}.`)) known.delete(key);
    }
    complete.delete(table);
    if (!exists) {
      for (const [index, owner] of indexTables) {
        if (owner === bare(table)) known.set(`index:${index}`, false);
      }
    }
  };

  const alter = (table: string, action: string) => {
    const added = ADD_COLUMN.exec(action)?.[1];
    if (added && !NOT_A_COLUMN.has(added.toLowerCase())) {
      known.set(`column:${table}.${identifier(added)}`, true);
      return;
    }
    const dropped = DROP_COLUMN.exec(action)?.[1];
    if (dropped && !NOT_A_COLUMN.has(dropped.toLowerCase())) {
      known.set(`column:${table}.${identifier(dropped)}`, false);
      return;
    }
    const renamed = RENAME_COLUMN.exec(action);
    if (renamed?.[1] && renamed[2]) {
      known.set(`column:${table}.${identifier(renamed[1])}`, false);
      known.set(`column:${table}.${identifier(renamed[2])}`, true);
      return;
    }
    const target = RENAME_TABLE.exec(action)?.[1];
    if (target) {
      setTable(table, false);
      setTable(normalize(target), true);
    }
  };

  const recordOne = (statement: string) => {
    const table = CREATE_TABLE.exec(statement);
    if (table?.[1]) {
      const name = normalize(table[1]);
      setTable(name, true);
      const columns = columnsOf(statement, table[0].length - 1);
      if (!columns) return;
      complete.add(name);
      for (const column of columns) known.set(`column:${name}.${column}`, true);
      return;
    }
    const index = CREATE_INDEX.exec(statement);
    if (index?.[1] && index[2]) {
      const name = bare(index[1]);
      known.set(`index:${name}`, true);
      indexTables.set(name, bare(index[2]));
      return;
    }
    const drop = DROP.exec(statement);
    if (drop?.[1] && drop[2]) {
      for (const name of splitTopLevel(drop[2], ',')) {
        if (drop[1].toLowerCase() === 'table') setTable(normalize(name), false);
        else known.set(`index:${bare(name)}`, false);
      }
      return;
    }
    const altered = ALTER_TABLE.exec(statement);
    if (altered?.[1] && altered[2]) {
      for (const action of splitTopLevel(altered[2], ',')) alter(normalize(altered[1]), action);
    }
  };

  const answer = (check: PreconditionCheck): boolean | undefined => {
    if ('not' in check) {
      const inner = answer(check.not);
      return inner === undefined ? undefined : !inner;
    }
    if ('tableExists' in check) return known.get(`table:${normalize(check.tableExists.table)}`);
    if ('columnExists' in check) {
      const table = normalize(check.columnExists.table);
      const column = known.get(`column:${table}.${check.columnExists.column}`);
      if (column !== undefined) return column;
      if (known.get(`table:${table}`) === false) return false;
      return complete.has(table) ? false : undefined;
    }
    if ('indexExists' in check) {
      const exists = known.get(`index:${check.indexExists.index}`);
      if (!exists || check.indexExists.table === undefined) return exists;
      return indexTables.get(check.indexExists.index) === bare(check.indexExists.table);
    }
    return undefined;
  };

  return {
    record(statement) {
      for (const part of splitTopLevel(statement, ';')) recordOne(part);
    },
    answer,
  };
}
