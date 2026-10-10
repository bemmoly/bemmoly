import { Badge } from '@bemmoly/ui';
import type { DnsCheckView, TestResultView } from '../../hooks/use-email-results.ts';
import { Notice } from '../form.tsx';

function DnsRow({ check }: { check: DnsCheckView }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-line-2 py-2.5 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="w-14 font-medium">{check.name}</span>
        <Badge tone={check.ok ? 'ok' : 'warn'}>{check.status.toUpperCase()}</Badge>
        {check.found ? (
          <span className="min-w-0 truncate font-mono text-11 text-tx-3">{check.found}</span>
        ) : null}
      </div>
      {check.toAdd ? (
        <div className="flex flex-col gap-1">
          <span className="text-12 text-tx-3">Add this DNS record:</span>
          <code className="rounded-chip bg-side px-2 py-1.5 font-mono text-11 break-all text-tx">
            {check.toAdd}
          </code>
        </div>
      ) : null}
    </div>
  );
}

/** The test send's outcome: where it went, or the failed stage and the server's own words. */
export function TestResult({ result }: { result: TestResultView }) {
  return (
    <div role="status" className="flex flex-col gap-3">
      {result.sent ? (
        <Notice>{result.headline}</Notice>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-control border border-red bg-side px-3 py-2.5 text-13 leading-body">
          <span className="text-red-tx">{result.headline}</span>
          {result.stage ? (
            <span className="text-tx-3">
              Failed while: <span className="font-medium text-tx-2">{result.stage}</span>
            </span>
          ) : null}
          {result.serverResponse ? (
            <code className="font-mono text-11 break-all text-tx-2">{result.serverResponse}</code>
          ) : null}
        </div>
      )}
      {result.dns.length ? (
        <div className="flex flex-col">
          <span className="text-12 text-tx-3">
            Deliverability for {result.domain ?? 'the from domain'}
          </span>
          {result.dns.map((check) => (
            <DnsRow key={check.name} check={check} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
