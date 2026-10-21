import type { AskReportResponse } from '@bemmoly/module-work/shared';
import { AiActionButton, AiBrief, AiNotUseful, Button, Input, Kbd, Skeleton } from '@bemmoly/ui';
import { useRef, useState, type FormEvent } from 'react';
import { ExportMenu } from './report-actions.tsx';
import { ReportFigure } from './report-figure.tsx';
import { describeSpec } from './report-spec-text.ts';
import { useAskReport, usePinnedReports } from './use-ask-report.ts';

/*
 * "Ask for a report" at the top of Reports, only with AI on. A question becomes a report the
 * server builds from the project's issues; the person sees how it was read, can pin it to
 * this view (where it is rebuilt live each visit) and export it. AI suggests; pinning is the
 * person's choice.
 */

export const EXAMPLE_QUESTIONS = [
  'What is the average time to fix a bug?',
  'How loaded is each person?',
  'Which epics are in the current sprint and how far along is each?',
] as const;

const errorText = (error: Error) => `${error.message.replace(/\.$/, '')}.`;

function AskedReport({
  answer,
  pinned,
  pinning,
  notUseful,
  onPin,
  onNotUseful,
}: {
  answer: AskReportResponse;
  pinned: boolean;
  pinning: boolean;
  notUseful: boolean;
  onPin: () => void;
  onNotUseful: () => void;
}) {
  const figure = useRef<HTMLDivElement>(null);
  const { result } = answer;
  return (
    <div className="flex flex-col gap-3 rounded-control border border-line bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 mr-auto text-14 font-semibold text-tx">{result.spec.title}</h3>
        <Button size="sm" variant="secondary" onClick={onPin} disabled={pinned} loading={pinning}>
          {pinned ? 'Pinned' : 'Pin to reports'}
        </Button>
        <ExportMenu result={result} question={answer.question} figure={figure} />
      </div>
      <p className="m-0 text-12 text-tx-2">{describeSpec(result.spec)}</p>
      <div ref={figure}>
        <ReportFigure result={result} />
      </div>
      <div className="flex items-center gap-2 text-12 text-tx-2">
        <span className="mr-auto">by AI · built from {result.issues} issues you can see</span>
        <AiNotUseful onClick={onNotUseful} disabled={notUseful}>
          {notUseful ? 'Thanks' : 'Not useful'}
        </AiNotUseful>
      </div>
    </div>
  );
}

export function AskReport({ projectKey }: { projectKey: string }) {
  const { ask, notUseful, rateNotUseful } = useAskReport(projectKey);
  const { pin } = usePinnedReports(projectKey);
  const [question, setQuestion] = useState('');
  const [pinnedRun, setPinnedRun] = useState<string | null>(null);

  const submit = (value: string) => {
    const text = value.trim();
    if (text.length < 3 || ask.isPending) return;
    ask.mutate(text);
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(question);
  };
  const answer = ask.data;

  return (
    <AiBrief title="Ask for a report">
      <div className="flex flex-col gap-2.5">
        <form role="search" aria-label="Ask for a report" onSubmit={onSubmit}>
          <Input
            size="lg"
            value={question}
            maxLength={500}
            aria-label="Question about this project"
            placeholder="Ask a question about this project"
            onChange={(event) => setQuestion(event.target.value)}
            suffix={<Kbd keys="Enter" className="max-sm:hidden!" />}
            aria-busy={ask.isPending}
          />
        </form>
        {!answer && !ask.isPending && !ask.error && (
          <p className="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-12 text-tx-3">
            <span>Reports are built from this project’s issues. Try:</span>
            {EXAMPLE_QUESTIONS.map((example) => (
              <AiActionButton
                key={example}
                // A suggestion longer than a phone is wide wraps instead of running off the card.
                className="max-w-full text-left whitespace-normal!"
                onClick={() => {
                  setQuestion(example);
                  submit(example);
                }}
              >
                {example}
              </AiActionButton>
            ))}
          </p>
        )}
        {ask.isPending && <Skeleton height={160} className="rounded-control" />}
        {ask.error && !ask.isPending && (
          <p className="m-0 flex items-center gap-2 text-13 text-tx-2">
            <span>Couldn’t build that report: {errorText(ask.error)}</span>
            <Button size="sm" variant="ghost" onClick={() => submit(question)}>
              Try again
            </Button>
          </p>
        )}
        {answer && !ask.isPending && (
          <AskedReport
            answer={answer}
            pinned={pinnedRun === answer.runId}
            pinning={pin.isPending}
            notUseful={notUseful}
            onNotUseful={() => rateNotUseful(answer)}
            onPin={() =>
              pin.mutate(
                { question: answer.question, spec: answer.result.spec },
                { onSuccess: () => setPinnedRun(answer.runId) },
              )
            }
          />
        )}
        {pin.error && <p className="m-0 text-13 text-tx-2">{errorText(pin.error)}</p>}
      </div>
    </AiBrief>
  );
}
