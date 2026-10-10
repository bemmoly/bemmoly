/*
 * Golden checks: what each prompt promises, as pure functions over the model's output. Each
 * returns null when the output keeps the promise and a plain sentence when it does not, so a
 * failing eval reads like a review comment. They hold for any model, recorded or live.
 */

export type Verdict = string | null;

interface CitedPoint {
  text: string;
  cites: readonly string[];
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');

const words = (text: string) => text.split(/\s+/).filter(Boolean);

/** Every cite points at a source the context offered. */
export function citesOnlyOffered(cites: readonly string[], offered: Set<string>): Verdict {
  const invented = cites.filter((id) => !offered.has(id));
  return invented.length ? `cites sources it was never given: ${invented.join(', ')}` : null;
}

/** A summary cites at least one source, and every point rests on one. */
export function everyPointCites(points: readonly CitedPoint[], offered: Set<string>): Verdict {
  if (points.length === 0) return 'wrote no points';
  const bare = points.filter((point) => point.cites.length === 0);
  if (bare.length) return `left ${bare.length} point(s) unsourced: "${bare[0]!.text}"`;
  return citesOnlyOffered(
    points.flatMap((point) => point.cites),
    offered,
  );
}

/** The answer cites at least one source with its token and invents none. */
export function answerCites(text: string, offered: Set<string>): Verdict {
  const tokens = [...text.matchAll(/\[(c\d+(?:\s*,\s*c\d+)*)\]/g)].flatMap((match) =>
    match[1]!.split(/\s*,\s*/),
  );
  if (tokens.length === 0) return 'answered without citing a source';
  return citesOnlyOffered(tokens, offered);
}

export interface ProposedCall {
  toolName: string;
  input: unknown;
}

/** A plan's write steps touch only the issues the request named. */
export function planTouchesOnly(
  calls: readonly ProposedCall[],
  writeTools: ReadonlySet<string>,
  named: ReadonlySet<string>,
): Verdict {
  const writes = calls.filter((call) => writeTools.has(call.toolName));
  if (writes.length === 0) return 'proposed no change';
  const strays = writes
    .map((call) => (call.input as { key?: string }).key ?? '(no key)')
    .filter((key) => !named.has(key));
  return strays.length ? `touched issues nobody named: ${[...new Set(strays)].join(', ')}` : null;
}

/** Ghost text: one line, at most 25 words, not a copy of the text before the caret. */
export function shortCompletion(text: string, before: string): Verdict {
  if (text.includes('\n')) return 'ran onto a second line';
  const count = words(text).length;
  if (count > 25) return `ran to ${count} words (at most 25)`;
  const tail = before.trim().split(/\s+/).slice(-6).join(' ');
  if (tail && text.includes(tail)) return 'repeated the text before the caret';
  return null;
}

/** Only the new text: no "Here is", no "Sure", no sign-off. */
export function noPreamble(text: string): Verdict {
  const first = text.trim().split('\n')[0] ?? '';
  return /^(sure|certainly|here (is|are)|of course)\b/i.test(first)
    ? `opened with a preamble: "${first}"`
    : null;
}

/** A Markdown table: header, separator, rows, the same number of cells on every line. */
export function markdownTable(text: string): Verdict {
  const rows = lines(text);
  if (rows.length < 3) return 'is not a table with a header, a separator and a row';
  if (!rows.every((row) => row.trim().startsWith('|'))) return 'has lines outside the table';
  if (!/^\|?\s*:?-{3,}/.test(rows[1]!.trim())) return 'has no separator row under the header';
  const cells = (row: string) =>
    row
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|').length;
  const width = cells(rows[0]!);
  if (width < 2 || width > 5) return `has ${width} columns (two to five)`;
  const ragged = rows.find((row) => cells(row) !== width);
  return ragged ? `has a row with a different number of cells: "${ragged}"` : null;
}

/** A task list of at most `max` items, each "- [ ] Title — detail". */
export function taskList(text: string, max: number): Verdict {
  const items = lines(text);
  if (items.length === 0) return 'listed no issues';
  if (items.length > max) return `listed ${items.length} issues (at most ${max})`;
  const odd = items.find((item) => !/^- \[ \] \S.* — \S/.test(item));
  return odd ? `has an item that is not "- [ ] Title — detail": "${odd}"` : null;
}

/** A bulleted list, each item ending with who raised it, as "(Name)". */
export function attributedBullets(text: string, names: readonly string[]): Verdict {
  const items = lines(text);
  if (items.length === 0) return 'listed nothing';
  const odd = items.find((item) => !/^[-*] \S/.test(item));
  if (odd) return `has a line that is not a bullet: "${odd}"`;
  const unattributed = items.find((item) => !names.some((name) => item.includes(`(${name})`)));
  return unattributed ? `has a question without who raised it: "${unattributed}"` : null;
}

/** Prose only: no headings and no lists, at most `maxWords`. */
export function prose(text: string, maxWords: number): Verdict {
  if (lines(text).some((line) => /^#{1,6} /.test(line))) return 'added a heading';
  const count = words(text).length;
  return count > maxWords ? `ran to ${count} words (at most ${maxWords})` : null;
}

/** Every fact (a number, a name, a flag) the text had is still there. */
export function keepsFacts(text: string, facts: readonly string[]): Verdict {
  const lost = facts.filter((fact) => !text.includes(fact));
  return lost.length ? `lost ${lost.map((fact) => `"${fact}"`).join(', ')}` : null;
}

/** Changed words between two texts, by a longest common subsequence over words. */
export function changedWords(before: string, after: string): number {
  const a = words(before);
  const b = words(after);
  const row = new Array<number>(b.length + 1).fill(0);
  for (const word of a) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]!;
      row[j] = word === b[j - 1] ? diagonal + 1 : Math.max(row[j]!, row[j - 1]!);
      diagonal = above;
    }
  }
  const kept = row[b.length]!;
  return a.length - kept + (b.length - kept);
}

/** A fix changes only what it must: at most `maxChanged` words in, out or replaced. */
export function minimalDiff(before: string, after: string, maxChanged: number): Verdict {
  if (after.trim() === '') return 'returned nothing';
  const changed = changedWords(before, after);
  return changed > maxChanged
    ? `changed ${changed} words (a minimal fix changes at most ${maxChanged})`
    : null;
}

export interface Finding {
  claim: string;
  location: { heading: string | null; paragraph: number };
  issueKey: string;
  issueValue: string;
  confidence: number;
  cites: readonly string[];
}

/** The planted conflict: the Rollback section's 15 minutes against PLT-204's 30. */
export function findsRollbackConflict(findings: readonly Finding[], offered: Set<string>): Verdict {
  const found = findings.find(
    (finding) =>
      finding.issueKey === 'PLT-204' &&
      /\b15\b/.test(finding.claim) &&
      /\b30\b/.test(finding.issueValue) &&
      finding.location.heading === 'Rollback',
  );
  if (!found) return 'missed the 15 versus 30 minute rollback conflict on PLT-204';
  if (found.confidence < 0.5) return `found the conflict but rated it ${found.confidence}`;
  return citesOnlyOffered(found.cites, offered);
}

/** Nothing else on the page contradicts its issues, so nothing else is reported. */
export function noOtherFindings(findings: readonly Finding[]): Verdict {
  const others = findings.filter((finding) => finding.issueKey !== 'PLT-204');
  return others.length
    ? `reported a conflict that is not there: ${others[0]!.issueKey} "${others[0]!.claim}"`
    : null;
}
