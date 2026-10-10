import { Fragment, type ReactNode } from 'react';
import { Icon, type IconName } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { Tag } from '../tag/tag.tsx';
import { AiDot } from './ai-parts.tsx';

export interface AiAnswerSentence {
  text: string;
  /** Source ids this sentence rests on, as the model cited them ("c3"). */
  citations: readonly string[];
  /** A factual claim no source backs: shown with a visible "Unsourced" marker. */
  unsourced: boolean;
}

export interface AiAnswerBlock {
  kind: 'paragraph' | 'item';
  sentences: readonly AiAnswerSentence[];
}

export interface AiAnswerSourceItem {
  id: string;
  /** The record: "RFC: Move sessions to Postgres", "PLT-204 Session store migration". */
  title: string;
  /** Where in it: a heading, "Description", "Comment". */
  label: string;
  /** Opens the record at that place. */
  href: string;
  icon?: IconName;
}

export interface AiAnswerProps {
  /** The answer read into blocks of sentences; partial text while streaming reads the same. */
  blocks: readonly AiAnswerBlock[];
  /** Every source offered; a citation shows its 1-based place in this list. */
  sources: readonly AiAnswerSourceItem[];
  /** What the answer drew on, e.g. "from 3 pages, 2 issues". */
  source?: ReactNode;
  title?: ReactNode;
  /** Still arriving: a caret follows the text and the sources wait until it ends. */
  streaming?: boolean;
  /** An AiNotUseful, an Ask again. */
  actions?: ReactNode;
  /** panel: the ⌘K palette (12.5px rhythm). page: a screen such as the Docs home. */
  variant?: 'panel' | 'page';
  className?: string;
}

function Citation({ n, source }: { n: number; source: AiAnswerSourceItem }) {
  return (
    <a
      href={source.href}
      aria-label={`Source ${n}: ${source.title}, ${source.label}`}
      title={`${source.title} › ${source.label}`}
      className={cx(
        'ml-0.5 inline-flex min-w-4 items-center justify-center rounded-chip border border-ai-100 bg-card px-1 align-baseline text-11 font-medium text-ai-600 no-underline hover:bg-ai-50',
        focusRing,
      )}
    >
      {n}
    </a>
  );
}

function Sentence({
  sentence,
  numbers,
  sources,
}: {
  sentence: AiAnswerSentence;
  numbers: ReadonlyMap<string, number>;
  sources: ReadonlyMap<string, AiAnswerSourceItem>;
}) {
  return (
    <>
      {sentence.text}
      {sentence.citations.map((id) => {
        const source = sources.get(id);
        return source ? <Citation key={id} n={numbers.get(id)!} source={source} /> : null;
      })}
      {sentence.unsourced && (
        <Tag className="ml-1 align-baseline" title="No source in your workspace backs this">
          Unsourced
        </Tag>
      )}{' '}
    </>
  );
}

/**
 * An AI answer with its citations: numbered links after the sentences they support, an
 * "Unsourced" marker on any factual sentence without one, and the cited places listed once the
 * answer is complete. The body stays in content colour; the AI marks are the dot, the title
 * and the citation chips.
 */
export function AiAnswer({
  blocks,
  sources,
  source,
  title = 'Answer',
  streaming = false,
  actions,
  variant = 'page',
  className,
}: AiAnswerProps) {
  const numbers = new Map(sources.map((item, index) => [item.id, index + 1]));
  const byId = new Map(sources.map((item) => [item.id, item]));
  const cited = new Set(blocks.flatMap((block) => block.sentences.flatMap((s) => s.citations)));
  const listed = sources.filter((item) => cited.has(item.id));
  const groups: { kind: AiAnswerBlock['kind']; blocks: AiAnswerBlock[] }[] = [];
  for (const block of blocks) {
    const last = groups.at(-1);
    if (last && last.kind === 'item' && block.kind === 'item') last.blocks.push(block);
    else groups.push({ kind: block.kind, blocks: [block] });
  }
  const lastBlock = blocks.at(-1);
  const sentences = (block: AiAnswerBlock) =>
    block.sentences.map((sentence, index) => {
      // The sentence still being written has not reached its citation yet.
      const writing = streaming && block === lastBlock && index === block.sentences.length - 1;
      return (
        <Sentence
          key={index}
          sentence={writing ? { ...sentence, unsourced: false } : sentence}
          numbers={numbers}
          sources={byId}
        />
      );
    });
  const page = variant === 'page';
  const caret = (
    <span
      aria-hidden
      className="inline-block h-3.5 w-1.5 rounded-tick bg-ai align-middle motion-safe:animate-pulse"
    />
  );
  return (
    <section
      aria-label="AI answer"
      aria-busy={streaming}
      className={cx(
        'flex flex-col gap-2 border border-ai-100 bg-ai-50',
        page
          ? 'rounded-card px-4 py-3.5 leading-brief'
          : 'rounded-control px-3.5 py-3 text-13 leading-body',
        className,
      )}
    >
      <div className="flex items-center gap-1.75 font-semibold text-ai-600">
        <AiDot />
        {title}
        {source && <span className="ml-auto text-12 font-normal text-ai-600">{source}</span>}
      </div>
      <div className="flex flex-col gap-2 text-tx" aria-live="polite">
        {groups.map((group, index) => {
          const end = streaming && index === groups.length - 1 ? caret : null;
          return group.kind === 'item' ? (
            <ul key={index} className="m-0 flex list-disc flex-col gap-1 pl-5">
              {group.blocks.map((block, item) => (
                <li key={item}>
                  {sentences(block)}
                  {item === group.blocks.length - 1 && end}
                </li>
              ))}
            </ul>
          ) : (
            <p key={index} className="m-0">
              {group.blocks.map((block, part) => (
                <Fragment key={part}>{sentences(block)}</Fragment>
              ))}
              {end}
            </p>
          );
        })}
        {streaming && groups.length === 0 && caret}
      </div>
      {!streaming && listed.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-ai-100 pt-2">
          <span className="text-12 font-medium text-tx-3">Sources</span>
          <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
            {listed.map((item) => (
              <li key={item.id} className="flex min-w-0 items-center gap-1.5 text-13">
                <span className="w-4 shrink-0 text-right text-12 text-tx-3">
                  {numbers.get(item.id)}
                </span>
                <Icon name={item.icon ?? 'doc'} size={13} className="shrink-0 text-tx-3" />
                <a
                  href={item.href}
                  className={cx('min-w-0 truncate text-tx-2 no-underline hover:text-tx', focusRing)}
                >
                  {item.title}
                  {item.label && item.label !== item.title && (
                    <span className="text-tx-3"> › {item.label}</span>
                  )}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
      {actions && <div className="flex flex-wrap gap-1.5 pt-0.5">{actions}</div>}
    </section>
  );
}
