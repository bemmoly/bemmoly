import { useEffect, useState } from 'react';
import type { PageEditor } from '../screen-context.ts';

/** Words a minute for reading, the common rule of thumb for prose on a screen. */
const READING_PACE = 230;
const SETTLE_MS = 300;

export interface DocStats {
  words: number;
  /** Whole minutes, at least one for any text at all. */
  minutes: number;
}

export function countWords(text: string): number {
  // "it’s", "auth_pg_sessions" and "0.5%" are one word each.
  const words = text.trim().match(/[\p{L}\p{N}](?:[\p{L}\p{N}'’_-]|[.,](?=\p{N}))*/gu);
  return words?.length ?? 0;
}

export function statsOf(words: number): DocStats {
  return { words, minutes: words === 0 ? 0 : Math.max(1, Math.round(words / READING_PACE)) };
}

/** "6 min read"; "Under a minute" for a short page and nothing for an empty one. */
export function readingTime({ words, minutes }: DocStats): string {
  if (words === 0) return '';
  return words < READING_PACE / 2 ? 'Under a minute' : `${minutes} min read`;
}

/**
 * Word count and reading time of the live document, so they follow typing (anyone's) rather
 * than the server's last extraction. Until the editor is up it is the stored count.
 */
export function useDocStats(editor: PageEditor | null, storedWords: number): DocStats {
  const [words, setWords] = useState<number | null>(null);
  useEffect(() => {
    if (!editor) {
      setWords(null);
      return undefined;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () =>
      setWords(
        countWords(editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ', ' ')),
      );
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(read, SETTLE_MS);
    };
    read();
    editor.on('update', later);
    return () => {
      clearTimeout(timer);
      editor.off('update', later);
    };
  }, [editor]);
  return statsOf(words ?? storedWords);
}
