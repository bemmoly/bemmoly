import { ValidationError } from '@bemmoly/shared';
import type { Importer, ImportConnection } from '../../contracts/importer.ts';
import type { SecretBox } from '../settings/index.ts';

/** Bound as associated data, so a sealed credential cannot be moved to another column. */
const CREDENTIALS_CONTEXT = 'import_jobs.credentials';

export interface SplitConnection {
  /** What a client may read back: plain values, and true for each secret given. */
  shown: Record<string, string | boolean>;
  sealed: string | null;
  full: ImportConnection;
}

/**
 * Checks the form against the importer's fields (unknown names refused, required ones
 * present) and splits it: secrets are sealed with the install key and never stored in the
 * plain column. File contents are kept out of the shown values too; they are large and the
 * client already has them.
 */
export function splitConnection(
  importer: Importer,
  values: Readonly<Record<string, string>>,
  secrets: SecretBox,
): SplitConnection {
  const fields = new Map(importer.fields.map((field) => [field.name, field]));
  for (const name of Object.keys(values)) {
    if (!fields.has(name)) throw new ValidationError(`${name} is not a field of this source`);
  }
  const visible = (name: string) => {
    const when = fields.get(name)?.showWhen;
    return !when || when.values.includes(values[when.field] ?? '');
  };
  const missing = importer.fields.filter(
    (field) => field.required && visible(field.name) && !values[field.name]?.trim(),
  );
  if (missing.length) {
    throw new ValidationError(`${missing.map((field) => field.label).join(', ')} is required`, {
      details: {
        issues: missing.map((field) => ({
          path: field.name,
          code: 'required',
          message: 'Required',
        })),
      },
    });
  }
  const shown: Record<string, string | boolean> = {};
  const hidden: Record<string, string> = {};
  const full: Record<string, string> = {};
  for (const field of importer.fields) {
    const value = values[field.name];
    if (value === undefined || !visible(field.name)) continue;
    const kept = field.kind === 'secret' || field.kind === 'file' ? value : value.trim();
    full[field.name] = kept;
    if (field.kind === 'secret' || field.kind === 'file') {
      hidden[field.name] = kept;
      shown[field.name] = kept.length > 0;
    } else shown[field.name] = kept;
  }
  const sealed = Object.keys(hidden).length
    ? secrets.seal(JSON.stringify(hidden), CREDENTIALS_CONTEXT)
    : null;
  return { shown, sealed, full };
}

/** The connection as the importer needs it, with the sealed values opened. */
export function openConnection(
  row: { connection: unknown; credentials: string | null },
  secrets: SecretBox,
): ImportConnection {
  const plain: Record<string, string> = {};
  for (const [name, value] of Object.entries((row.connection ?? {}) as Record<string, unknown>)) {
    if (typeof value === 'string') plain[name] = value;
  }
  if (!row.credentials) return plain;
  const opened = JSON.parse(secrets.open(row.credentials, CREDENTIALS_CONTEXT)) as Record<
    string,
    string
  >;
  return { ...plain, ...opened };
}
