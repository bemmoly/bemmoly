import type { LqlOperator } from './ast.ts';

export const LQL_FIELD_KINDS = ['text', 'number', 'date', 'user', 'enum', 'option', 'key'] as const;

export type LqlFieldKind = (typeof LQL_FIELD_KINDS)[number];

/**
 * One queryable field. The module that owns the data describes its fields with
 * this shape; the parser, validator and autocomplete never know what an issue is.
 */
export interface LqlField {
  key: string;
  label: string;
  kind: LqlFieldKind;
  operators: readonly LqlOperator[];
  /**
   * Name of the value source the filter bar asks the module for when it
   * completes a value (`users`, `statuses`, ...). Absent for free text and
   * numbers.
   */
  values?: string;
  /** Fixed values for fields whose set is known up front, used to validate and complete. */
  options?: readonly string[];
  /** Zero-argument functions this field accepts as a value, such as `currentSprint()`. */
  functions?: readonly string[];
}

export interface LqlFieldCatalog {
  fields: readonly LqlField[];
  /** Resolves a field as written in a query: by key or label, ignoring case. */
  resolve(name: string): LqlField | undefined;
}

export const DATE_FUNCTIONS = [
  'now',
  'startOfDay',
  'endOfDay',
  'startOfWeek',
  'endOfWeek',
  'startOfMonth',
  'endOfMonth',
] as const;

export const EQUALITY: readonly LqlOperator[] = ['=', '!='];
export const MEMBERSHIP: readonly LqlOperator[] = ['IN', 'NOT IN'];
export const EMPTINESS: readonly LqlOperator[] = ['IS EMPTY', 'IS NOT EMPTY'];
export const ORDERING: readonly LqlOperator[] = ['<', '<=', '>', '>='];
export const MATCHING: readonly LqlOperator[] = ['~', '!~'];

/** The operators a field of each kind takes unless its definition narrows them. */
export const DEFAULT_OPERATORS: Record<LqlFieldKind, readonly LqlOperator[]> = {
  text: [...EQUALITY, ...MATCHING, ...EMPTINESS],
  number: [...EQUALITY, ...ORDERING, ...MEMBERSHIP, ...EMPTINESS],
  date: [...EQUALITY, ...ORDERING, ...EMPTINESS],
  user: [...EQUALITY, ...MEMBERSHIP, ...EMPTINESS],
  enum: [...EQUALITY, ...MEMBERSHIP],
  option: [...EQUALITY, ...MEMBERSHIP, ...EMPTINESS],
  key: [...EQUALITY, ...MEMBERSHIP, ...EMPTINESS],
};

export const STATUS_CATEGORIES = ['todo', 'in_progress', 'done'] as const;

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'] as const;

type FieldSpec = Omit<LqlField, 'operators'> & { operators?: readonly LqlOperator[] };

function field(spec: FieldSpec): LqlField {
  return { ...spec, operators: spec.operators ?? DEFAULT_OPERATORS[spec.kind] };
}

/** The issue fields every Work install has, in the order the filter bar lists them. */
export const ISSUE_FIELDS: readonly LqlField[] = [
  field({
    key: 'project',
    label: 'Project',
    kind: 'key',
    values: 'projects',
    operators: [...EQUALITY, ...MEMBERSHIP],
  }),
  field({
    key: 'key',
    label: 'Key',
    kind: 'key',
    values: 'issues',
    operators: [...EQUALITY, ...MEMBERSHIP],
  }),
  field({ key: 'type', label: 'Type', kind: 'enum', values: 'issueTypes' }),
  field({ key: 'status', label: 'Status', kind: 'enum', values: 'statuses' }),
  field({
    key: 'statusCategory',
    label: 'Status category',
    kind: 'enum',
    options: STATUS_CATEGORIES,
  }),
  field({
    key: 'priority',
    label: 'Priority',
    kind: 'enum',
    options: PRIORITIES,
    operators: [...EQUALITY, ...ORDERING, ...MEMBERSHIP],
  }),
  field({ key: 'assignee', label: 'Assignee', kind: 'user', values: 'users' }),
  field({ key: 'reporter', label: 'Reporter', kind: 'user', values: 'users' }),
  field({ key: 'parent', label: 'Parent', kind: 'key', values: 'issues' }),
  field({ key: 'epic', label: 'Epic', kind: 'key', values: 'epics' }),
  field({
    key: 'sprint',
    label: 'Sprint',
    kind: 'option',
    values: 'sprints',
    functions: ['currentSprint'],
  }),
  field({ key: 'estimate', label: 'Estimate', kind: 'number' }),
  field({ key: 'due', label: 'Due', kind: 'date' }),
  field({ key: 'created', label: 'Created', kind: 'date' }),
  field({ key: 'updated', label: 'Updated', kind: 'date' }),
  field({ key: 'fixVersion', label: 'Fix version', kind: 'option', values: 'versions' }),
  field({ key: 'label', label: 'Label', kind: 'option', values: 'labels' }),
  field({ key: 'text', label: 'Text', kind: 'text', operators: MATCHING }),
];

export const CUSTOM_FIELD_PREFIX = 'cf.';

export interface CustomFieldSpec {
  /** The field's own key; the catalog exposes it as `cf.<key>`. */
  key: string;
  label: string;
  kind: LqlFieldKind;
  options?: readonly string[];
}

/**
 * Custom fields are addressed as `cf.<key>` so they can never shadow a built-in
 * field, and by their label in quotes (`"spec doc" IS EMPTY`) because that is
 * how people know them.
 */
export function customField(spec: CustomFieldSpec): LqlField {
  const base = field({ ...spec, key: `${CUSTOM_FIELD_PREFIX}${spec.key}` });
  return spec.kind === 'option' && spec.options === undefined
    ? { ...base, values: base.key }
    : base;
}

/**
 * Earlier fields win a name: built-ins are listed before custom fields, so an
 * admin naming a custom field "Status" cannot capture the built-in status
 * filter. The custom field stays reachable through its `cf.` key.
 */
export function createFieldCatalog(fields: readonly LqlField[]): LqlFieldCatalog {
  const byName = new Map<string, LqlField>();
  for (const entry of fields) {
    for (const name of [entry.key.toLowerCase(), entry.label.toLowerCase()]) {
      if (!byName.has(name)) byName.set(name, entry);
    }
  }
  return { fields, resolve: (name) => byName.get(name.toLowerCase()) };
}

export function createIssueFieldCatalog(
  customFields: readonly CustomFieldSpec[] = [],
): LqlFieldCatalog {
  return createFieldCatalog([...ISSUE_FIELDS, ...customFields.map(customField)]);
}
