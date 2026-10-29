import { AiDot, Kbd } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState, type FormEvent } from 'react';
import { useUiStore } from '../../store/ui.ts';

/**
 * The start page's one question box. It hands the words to ⌘K, which already answers from
 * the person's products with citations and proposes actions they confirm. With AI off it is a
 * plain search box: no lilac, no promise of answers.
 */
export function AskBox({ aiEnabled }: { aiEnabled: boolean }) {
  const openPalette = useUiStore((state) => state.openPalette);
  const [words, setWords] = useState('');
  const label = aiEnabled
    ? 'Ask anything, or tell Bemmoly what you need…'
    : 'Search issues, pages and people…';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    openPalette('all', words.trim());
    setWords('');
  };
  return (
    <form
      role="search"
      onSubmit={submit}
      className="flex h-11 items-center gap-2.5 rounded-card bg-card px-3.5 shadow-e1 focus-within:shadow-e1h"
    >
      {aiEnabled ? <AiDot size={9} /> : <Icon name="search" size={16} className="text-tx-3" />}
      <input
        value={words}
        onChange={(event) => setWords(event.target.value)}
        aria-label={label}
        placeholder={label}
        data-testid="start-ask"
        className="h-full min-w-0 flex-1 border-0 bg-transparent font-sans text-14 text-tx outline-none placeholder:text-tx-3"
      />
      <span className="max-sm:hidden">
        <Kbd keys="Mod+K" />
      </span>
    </form>
  );
}
