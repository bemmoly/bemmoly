import { AiBrief, Input, Kbd } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import { useAskDocs } from '../hooks/use-ask-docs.ts';
import { AskDocsResult } from './ask-docs-result.tsx';

/** At most this many suggested questions under the box. */
const MOST_EXAMPLES = 2;

/**
 * Questions to try, about pages this workspace really has: the most recently touched, by
 * title. A workspace without titled pages yet gets none rather than made-up ones.
 */
export function exampleQuestions(pages: readonly { title: string }[]): string[] {
  const titles = [...new Set(pages.map((page) => page.title.trim()).filter(Boolean))];
  return titles.slice(0, MOST_EXAMPLES).map((title) => `What does “${title}” say?`);
}

export interface AskDocsPanelProps {
  /** Admins are told where AI is configured; nobody else is. */
  isAdmin: boolean;
  /** The pages touched most recently, newest first; the examples are about them. */
  recentPages: readonly { title: string }[];
}

/**
 * "Ask your docs" on the Docs home: a question, then a streamed answer that cites the pages
 * and issues it came from. Drawn only with AI on (the caller decides); the page around it
 * works whatever the model does.
 */
export function AskDocsPanel({ isAdmin, recentPages }: AskDocsPanelProps) {
  const { state, ask, reset, notUseful, rateNotUseful } = useAskDocs();
  const [question, setQuestion] = useState('');
  const busy = state.phase === 'thinking' || state.phase === 'streaming';
  const examples = exampleQuestions(recentPages);

  const submit = (value: string) => {
    void ask(value);
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(question);
  };
  const askExample = (example: string) => {
    setQuestion(example);
    submit(example);
  };

  return (
    <AiBrief title="Ask your docs">
      <div className="flex flex-col gap-2.5">
        <form role="search" aria-label="Ask your docs" onSubmit={onSubmit}>
          <Input
            size="lg"
            value={question}
            maxLength={500}
            aria-label="Question about your docs"
            placeholder="Ask a question your pages can answer"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && state.phase !== 'idle') {
                event.preventDefault();
                reset();
              }
            }}
            suffix={<Kbd keys="Enter" className="max-sm:hidden!" />}
            aria-busy={busy}
          />
        </form>
        {state.phase === 'idle' ? (
          <p className="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-12 text-tx-3">
            <span>Answers cite the pages they came from.{examples.length > 0 ? ' Try:' : ''}</span>
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => askExample(example)}
                className="cursor-pointer border-0 bg-transparent p-0 font-sans text-12 text-tx-2 underline decoration-line underline-offset-2 hover:text-tx"
              >
                {example}
              </button>
            ))}
          </p>
        ) : (
          <AskDocsResult
            state={state}
            isAdmin={isAdmin}
            notUseful={notUseful}
            onRetry={() => submit(state.question)}
            onNotUseful={rateNotUseful}
          />
        )}
      </div>
    </AiBrief>
  );
}
