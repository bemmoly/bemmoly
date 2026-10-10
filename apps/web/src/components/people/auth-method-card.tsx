import { Button, Card } from '@bemmoly/ui';
import { StatePill } from '../settings/state-pill.tsx';

export interface AuthMethod {
  id: string;
  initials: string;
  name: string;
  description: string;
  enabled: boolean;
}

/** One sign-in method: 32px initials tile, name, status badge, a sentence and its action. */
export function AuthMethodCard({ method }: { method: AuthMethod }) {
  return (
    <Card className={`flex flex-col gap-2.5 p-4 ${method.enabled ? 'border-acc-100!' : ''}`}>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-control bg-line-2 text-12 font-semibold text-tx-2"
        >
          {method.initials}
        </span>
        <span className="text-14 font-semibold">{method.name}</span>
        <span className="ml-auto">
          <StatePill tone={method.enabled ? 'ok' : 'neutral'}>
            {method.enabled ? 'Enabled' : 'Not available yet'}
          </StatePill>
        </span>
      </div>
      <p className="m-0 text-13 leading-body text-tx-3">{method.description}</p>
      {!method.enabled && (
        <div className="mt-auto flex gap-2">
          <Button size="sm" disabled title="Single sign-on arrives in a later release.">
            Set up
          </Button>
        </div>
      )}
    </Card>
  );
}
