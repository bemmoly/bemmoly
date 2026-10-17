/** The import screenshots' switch, read once from the environment. */

/** BEMMOLY_IMPORT_SHOTS=1 writes the importer's screenshots to ~/.cache; unset, none run. */
export const IMPORT_SHOTS = Boolean(process.env['BEMMOLY_IMPORT_SHOTS']);
