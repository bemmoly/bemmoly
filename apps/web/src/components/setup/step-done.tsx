import { Button, buttonClassName, Card } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { useSetupDone } from '../../hooks/use-setup-done.ts';
import { FormError, Loading } from '../form.tsx';
import { StatusCircle } from './health-list.tsx';

/** Step 6: what was set up, from what was saved, and the two ways out. */
export function StepDone() {
  const { rows, loading, complete, retry, actions, leave } = useSetupDone();
  return (
    <>
      {loading ? (
        <Loading label="Loading the summary" lines={6} />
      ) : (
        <Card aria-label="Setup summary" className="flex flex-col px-4 py-1.5 text-12h">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center gap-2.5 border-b border-br-row py-2.5 last:border-b-0"
            >
              <StatusCircle status="ok" />
              <span className="w-40 shrink-0 font-medium">{row.label}</span>
              <span className="min-w-0 text-tx3">{row.value}</span>
            </div>
          ))}
        </Card>
      )}
      {complete.isError ? (
        <div className="flex flex-col items-start gap-2.5">
          <FormError error={complete.error} />
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : null}
      <div className="flex gap-2.5">
        <Link
          to={actions.open.to}
          onClick={leave}
          className={buttonClassName({ variant: 'primary', size: 'lg' })}
        >
          {actions.open.label}
        </Link>
        <Link
          to={actions.invite.to}
          onClick={leave}
          className={buttonClassName({ variant: 'secondary', size: 'lg' })}
        >
          {actions.invite.label}
        </Link>
      </div>
    </>
  );
}
