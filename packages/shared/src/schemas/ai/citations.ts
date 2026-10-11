import type { AiAnswerSource } from './answers.ts';

/*
 * Citations are written by the model as tokens like "[c3]" or "[c1, c4]" right after the claim
 * they support. The server reports which ones an answer used; the web app renders them as
 * links while the answer streams. Both read the text with these functions, so a sentence the
 * server calls unsourced is the one the panel marks.
 */

const TOKEN = /\[\s*(c\d+(?:\s*,\s*c\d+)*)\s*\]/g;

/** The citation ids in the text, in first-use order, keeping only the ones offered. */
export function citedIds(text: string, offered: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(TOKEN)) {
    for (const id of match[1]!.split(',').map((part) => part.trim())) {
      if (offered.has(id)) seen.add(id);
    }
  }
  return [...seen];
}

export interface AnswerSentence {
  /** The sentence with its citation tokens taken out. */
  text: string;
  citations: string[];
  /** A factual claim with no citation: shown with a visible "Unsourced" marker. */
  unsourced: boolean;
}

export interface AnswerBlock {
  kind: 'paragraph' | 'item';
  sentences: AnswerSentence[];
}

/** Sentences end at . ! or ? followed by a space, or a citation group, then a space. */
const SENTENCE_END = /(?<=[.!?](?:\s*\[[^\]]*\])*)\s+(?=\S)/;

function isClaim(sentence: string): boolean {
  const words = sentence.split(/\s+/).filter(Boolean);
  return words.length >= 4 && !sentence.trim().endsWith('?');
}

function readSentence(raw: string, offered: ReadonlySet<string>): AnswerSentence {
  const citations = citedIds(raw, offered);
  const text = raw
    .replace(TOKEN, '')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { text, citations, unsourced: citations.length === 0 && isClaim(text) };
}

/**
 * The text of a "- ", "* ", "• ", "1. " or "1) " list line, or null for any other line. The
 * marker is matched on its own and the rest is trimmed, so no pattern backtracks over spaces.
 */
function listItemText(line: string): string | null {
  const trimmed = line.trimStart();
  const marker = /^(?:[-*•]|\d+[.)])/.exec(trimmed);
  if (!marker) return null;
  const rest = trimmed.slice(marker[0].length);
  if (!/^\s/.test(rest)) return null;
  return rest.trim();
}

/**
 * The answer as blocks of sentences with their citations. Paragraphs split on blank lines and
 * "- " or "1. " lines become items. A partial answer (still streaming) reads the same way.
 */
export function readAnswer(text: string, offered: ReadonlySet<string>): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  for (const chunk of text.split(/\n\s*\n/)) {
    const lines = chunk.split('\n').filter((line) => line.trim() !== '');
    let paragraph: string[] = [];
    const flush = () => {
      if (paragraph.length === 0) return;
      blocks.push({ kind: 'paragraph', sentences: sentencesOf(paragraph.join(' '), offered) });
      paragraph = [];
    };
    for (const line of lines) {
      const item = listItemText(line);
      if (item !== null) {
        flush();
        blocks.push({ kind: 'item', sentences: sentencesOf(item, offered) });
      } else {
        paragraph.push(line.trim());
      }
    }
    flush();
  }
  return blocks;
}

function sentencesOf(text: string, offered: ReadonlySet<string>): AnswerSentence[] {
  return text
    .split(SENTENCE_END)
    .map((raw) => readSentence(raw, offered))
    .filter((sentence) => sentence.text !== '' || sentence.citations.length > 0);
}

/** "3 pages, 2 issues": the distinct records the cited sources come from, per kind. */
export function describeSources(
  sources: readonly AiAnswerSource[],
  cited?: readonly string[],
): string {
  const used = cited ? new Set(cited) : null;
  const byKind = new Map<string, { noun: AiAnswerSource['noun']; targets: Set<string> }>();
  for (const source of sources) {
    if (used && !used.has(source.id)) continue;
    const entry = byKind.get(source.kind) ?? { noun: source.noun, targets: new Set<string>() };
    entry.targets.add(source.targetId);
    byKind.set(source.kind, entry);
  }
  return [...byKind.values()]
    .map(({ noun, targets }) => `${targets.size} ${targets.size === 1 ? noun.one : noun.other}`)
    .join(', ');
}
