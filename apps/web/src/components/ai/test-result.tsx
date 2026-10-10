import type { AiProviderTestResponse } from '@bemmoly/shared';
import { Icon } from '@bemmoly/ui/icons';
import { testLine } from '../../hooks/use-ai-connection.ts';

/**
 * What "Test connection" found, in plain words: a green line with the latency and the models
 * found, or the provider's own error in red with what to check. Announced as it changes.
 */
export function TestResult({
  result,
  error,
}: {
  result: AiProviderTestResponse | null;
  error: string | null;
}) {
  if (!result && !error) return null;
  const ok = Boolean(result?.ok) && !error;
  const text = error ?? (result ? testLine(result) : '');
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`flex items-start gap-2 rounded-control px-3 py-2.5 text-13 leading-body ${
        ok ? 'bg-green-50 text-green-tx' : 'bg-red-50 text-red-tx'
      }`}
    >
      <Icon name={ok ? 'check' : 'warning'} className="mt-0.5 shrink-0" />
      <span className="min-w-0 break-words">{text}</span>
    </div>
  );
}
