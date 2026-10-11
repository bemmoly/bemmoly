/*
 * The "Ask your docs" answer contract and citation reader, behind their own entry point:
 * the package barrel loads with the web shell, and only the screens that ask need these.
 */
export * from './schemas/ai/answers.ts';
export * from './schemas/ai/citations.ts';
