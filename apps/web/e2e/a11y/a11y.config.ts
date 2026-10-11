/** The audit's switches, read once from the environment. */

/** CI runs one theme per runner (A11Y_THEME=pine); unset, every theme runs. */
export const A11Y_THEME = process.env['A11Y_THEME'] || undefined;

/** A11Y_REPORT=<file>: record findings as JSON lines instead of failing, for an audit. */
export const A11Y_REPORT = process.env['A11Y_REPORT'] || undefined;
