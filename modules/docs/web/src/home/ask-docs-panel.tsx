import { AiBrief, Input, Kbd } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import { useAskDocs } from '../hooks/use-ask-docs.ts';
import { AskDocsResult } from './ask-docs-result.tsx';

const EXAMPLES = [
  'How do we roll back the auth service cutover?',
  'What happened in the checkout outage?',
];

export interface AskDocsPanelProps {
  /** Admins are told where AI is configured; nobody else is. */
  isAdmin: boolean;
}

/**
 * "Ask your docs" on the Docs home: a question, then a streamed answer that cites the pages
 * and issues it came from. Drawn only with AI on (the caller decides); the page around it
 * works whatever the model does.
 */
export function AskDocsPanel({ isAdmin }: AskDocsPanelProps) {
  const { state, ask, reset, notUseful, rateNotUseful } = useAskDocs();
  const [question, setQuestion] = useState('');
  const busy = state.phase === 'thinking' || state.phase === 'streaming';

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
            placeholder="How do we roll back the auth service cutover?"
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
            <span>Answers cite the pages they came from. Try:</span>
            {EXAMPLES.map((example) => (
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
