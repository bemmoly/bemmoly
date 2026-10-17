import {
  APPLICATION_FILE_PATH,
  applicationFileSchema,
  pipelineTemplateSchema,
} from '@bemmoly/module-pipelines/shared';
import { isMap, isNode, isScalar, LineCounter, parseDocument, type Document } from 'yaml';
import { z } from 'zod';

/*
 * bp lint: `.bemmoly/application.yaml` and pipeline template files checked offline against
 * the same zod schemas the server reads them with, so a pull request finds a mistake before
 * a push does. Unknown keys are reported too: a typo such as "ownr" would otherwise be
 * dropped silently and the application would land without an owner.
 */

export interface LintProblem {
  file: string;
  line: number;
  column: number;
  path: string;
  message: string;
}

export type LintKind = 'application' | 'template';

const strictApplication = z.strictObject(applicationFileSchema.shape);
const strictTemplate = z.strictObject(pipelineTemplateSchema.shape);

/** application.yaml by name; any other YAML file is read as a pipeline template. */
export function kindOf(file: string): LintKind {
  const normalised = file.replaceAll('\\', '/');
  return normalised.endsWith(APPLICATION_FILE_PATH) || /(^|\/)application\.ya?ml$/.test(normalised)
    ? 'application'
    : 'template';
}

function positionOf(
  doc: Document,
  counter: LineCounter,
  path: readonly PropertyKey[],
): { line: number; column: number } {
  // The deepest node that exists: a missing key points at the map that should hold it.
  for (let depth = path.length; depth >= 0; depth -= 1) {
    const node: unknown = depth === 0 ? doc.contents : doc.getIn(path.slice(0, depth), true);
    if (isNode(node) && node.range) {
      const { line, col } = counter.linePos(node.range[0]);
      return { line, column: col };
    }
  }
  return { line: 1, column: 1 };
}

/** Where an unknown key is written: the key itself, not its value. */
function positionOfKey(
  doc: Document,
  counter: LineCounter,
  parent: readonly PropertyKey[],
  key: string,
): { line: number; column: number } | null {
  const map: unknown = parent.length === 0 ? doc.contents : doc.getIn(parent, true);
  if (!isMap(map)) return null;
  const pair = map.items.find((item) => isScalar(item.key) && item.key.value === key);
  if (!pair || !isScalar(pair.key) || !pair.key.range) return null;
  const { line, col } = counter.linePos(pair.key.range[0]);
  return { line, column: col };
}

const pathText = (path: readonly PropertyKey[]) =>
  path.reduce<string>(
    (text, part) =>
      typeof part === 'number'
        ? `${text}[${part}]`
        : text
          ? `${text}.${String(part)}`
          : String(part),
    '',
  );

export function lintText(file: string, text: string, kind: LintKind = kindOf(file)): LintProblem[] {
  const counter = new LineCounter();
  const doc = parseDocument(text, { lineCounter: counter, prettyErrors: false });
  if (doc.errors.length > 0) {
    return doc.errors.map((error) => {
      const { line, col } = counter.linePos(error.pos[0]);
      return { file, line, column: col, path: '', message: error.message.split('\n', 1)[0] ?? '' };
    });
  }
  const schema = kind === 'application' ? strictApplication : strictTemplate;
  const result = schema.safeParse(doc.toJS());
  if (result.success) return [];
  const problems = result.error.issues.map((issue) => {
    const keys = issue.code === 'unrecognized_keys' ? issue.keys : [];
    const path = keys[0] === undefined ? issue.path : [...issue.path, keys[0]];
    const message =
      issue.code === 'unrecognized_keys'
        ? `Unknown ${keys.length === 1 ? 'key' : 'keys'} ${keys.map((key) => `"${key}"`).join(', ')}`
        : issue.message;
    const position =
      (keys[0] !== undefined && positionOfKey(doc, counter, issue.path, keys[0])) ||
      positionOf(doc, counter, path);
    return { file, ...position, path: pathText(issue.path), message };
  });
  return problems.sort((a, b) => a.line - b.line || a.column - b.column);
}

/** "app/.bemmoly/application.yaml:4:8 owner: Owners look like "team/payments"". */
export function formatProblem(problem: LintProblem): string {
  const where = `${problem.file}:${problem.line}:${problem.column}`;
  return problem.path
    ? `${where} ${problem.path}: ${problem.message}`
    : `${where} ${problem.message}`;
}
