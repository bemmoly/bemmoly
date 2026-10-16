import { formatNumber, useT } from '@bemmoly/core-web';
import type { Job } from '@bemmoly/module-pipelines/shared';
import { Button, EmptyState, LogView, SearchInput, Switch } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { deliveryKeys } from '../../api/delivery.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { api } from '../../lib/api.ts';
import { useJobLog } from './use-job-log.ts';

const WRITING = new Set(['claimed', 'running']);

/**
 * The selected job's log: opens on the first error (or the line in the address), follows the
 * end while the job writes, and searches the whole log on the server. Enter steps through the
 * hits; F follows; a line number links the line.
 */
export function LogPanel({
  job,
  line,
  onLine,
  follow,
  onFollow,
  searchRef,
}: {
  job: Job;
  line: number | null;
  onLine: (line: number) => void;
  follow: boolean;
  onFollow: (follow: boolean) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const t = useT(pipelinesText);
  const writing = WRITING.has(job.state);
  const log = useJobLog(job.id, writing);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [jump, setJump] = useState<{ line: number; nonce: number } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const search = useQuery({
    queryKey: deliveryKeys.logSearch(job.id, query),
    queryFn: () => api.delivery.searchLog(job.id, query),
    enabled: query.length >= 2,
  });
  const hits = useMemo(
    () => (query.length >= 2 ? (search.data?.matches ?? []) : []),
    [query, search.data],
  );
  const matches = useMemo(() => new Map(hits.map((hit) => [hit.line, hit.ranges])), [hits]);
  const go = (to: number) => setJump((current) => ({ line: to, nonce: (current?.nonce ?? 0) + 1 }));

  // Open where it matters: the linked line, else the first error, else the end while the job
  // writes (the view follows by itself once it is at the end). Decided once, when lines land.
  const [opened, setOpened] = useState(false);
  if (!opened && log.status === 'ready') {
    setOpened(true);
    const target = line ?? log.firstErrorLine ?? (writing ? log.totalLines : null);
    if (target) setJump({ line: target, nonce: 1 });
  }

  const step = (by: number) => {
    if (!hits.length) return;
    const next = (active + by + hits.length) % hits.length;
    setActive(next);
    const hit = hits[next];
    if (hit) {
      onFollow(false);
      go(hit.line);
    }
  };
  const meta = [
    job.pool?.name,
    log.totalLines
      ? t('pipelines.log.lines', { count: log.totalLines, shown: formatNumber(log.totalLines) })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const waiting = job.state === 'pending' || job.state === 'ready';
  return (
    <section
      className="flex min-h-0 flex-col overflow-hidden rounded-card border border-line bg-card shadow-e1"
      aria-label={t('pipelines.log.region', { job: job.name })}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2">
        <span className="font-medium text-tx">{job.name}</span>
        <span className="truncate text-12 text-tx-3">{meta}</span>
        <div className="ms-auto flex items-center gap-3">
          <SearchInput
            ref={searchRef}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                step(event.shiftKey ? -1 : 1);
              }
              if (event.key === 'Escape') {
                setText('');
                searchRef.current?.blur();
              }
            }}
            placeholder={t('pipelines.log.search')}
            aria-label={t('pipelines.log.search')}
            hint="/"
            className="w-44 sm:w-56"
            suffix={
              hits.length ? (
                <span className="text-11 text-tx-3 tabular-nums">
                  {t('pipelines.log.hit', { at: active + 1, count: hits.length })}
                </span>
              ) : undefined
            }
          />
          <label className="flex items-center gap-2 text-12 text-tx-2">
            <Switch size="sm" checked={follow} onCheckedChange={onFollow} />
            {t('pipelines.log.follow')}
          </label>
        </div>
      </div>
      <div className="h-[min(62vh,640px)] min-h-80 bg-sunken">
        {waiting ? (
          <EmptyState
            size="sm"
            icon={<Icon name="clock" size={16} />}
            title={job.waitReason?.text ?? t('pipelines.log.notStarted')}
          />
        ) : log.status === 'error' ? (
          <EmptyState
            size="sm"
            icon={<Icon name="warning" size={16} />}
            title={t('pipelines.log.failed')}
            action={
              <Button size="sm" onClick={log.retry}>
                {t('pipelines.common.tryAgain')}
              </Button>
            }
          />
        ) : log.status === 'ready' && log.totalLines === 0 ? (
          <EmptyState
            size="sm"
            icon={<Icon name="list" size={16} />}
            title={t('pipelines.log.empty')}
          />
        ) : (
          <LogView
            totalLines={log.totalLines}
            getLine={log.getLine}
            onRangeNeeded={log.ensure}
            follow={follow}
            onFollowChange={onFollow}
            selectedLine={line}
            onSelectLine={onLine}
            scrollTo={jump}
            matches={matches}
            activeMatchLine={hits[active]?.line ?? null}
            ariaLabel={t('pipelines.log.label', { job: job.name })}
            lineLabel={(number) => t('pipelines.log.line', { number: formatNumber(number) })}
          />
        )}
      </div>
    </section>
  );
}
