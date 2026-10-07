import { Badge } from '@bemmoly/ui';
import type { DnsCheckView, TestResultView } from '../../hooks/use-email-results.ts';
import { Notice } from '../form.tsx';

function DnsRow({ check }: { check: DnsCheckView }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-br-row py-2.5 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="w-14 font-medium">{check.name}</span>
        <Badge tone={check.ok ? 'ok' : 'warn'}>{check.status.toUpperCase()}</Badge>
        {check.found ? (
          <span className="min-w-0 truncate font-mono text-11 text-tx4">{check.found}</span>
        ) : null}
      </div>
      {check.toAdd ? (
        <div className="flex flex-col gap-1">
          <span className="text-12 text-tx4">Add this DNS record:</span>
          <code className="rounded-xs bg-sf2 px-2 py-1.5 font-mono text-11 break-all text-tx-body">
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
        <div className="flex flex-col gap-1.5 rounded-panel border border-danger bg-sf2 px-3 py-2.5 text-12h leading-body">
          <span className="text-danger-hi">{result.headline}</span>
          {result.stage ? (
            <span className="text-tx4">
              Failed while: <span className="font-medium text-tx2">{result.stage}</span>
            </span>
          ) : null}
          {result.serverResponse ? (
            <code className="font-mono text-11 break-all text-tx2">{result.serverResponse}</code>
          ) : null}
        </div>
      )}
      {result.dns.length ? (
        <div className="flex flex-col">
          <span className="text-12 text-tx5">
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
