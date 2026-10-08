import { Button, buttonClassName, Card } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { useSetupDone } from '../../hooks/use-setup-done.ts';
import { FormError, Loading } from '../form.tsx';
import { StatusCircle } from './health-list.tsx';

/**
 * Step 6: what was set up, from what was saved, and the two ways out. A description list, so each
 * value is read with its label; a skipped step gets an empty circle and quieter text, not a tick.
 */
export function StepDone() {
  const { rows, loading, complete, retry, actions, leave } = useSetupDone();
  return (
    <>
      {loading ? (
        <Loading label="Loading the summary" lines={6} />
      ) : (
        <Card className="px-4 py-1.5 text-12h">
          <dl aria-label="Setup summary" className="m-0 flex flex-col">
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex items-center gap-2.5 border-b border-br-row py-2.5 last:border-b-0"
              >
                {/* The circle sits in the dt because a dl row may hold only dt and dd; 186px is
                    the mock's 16px circle, 10px gap and 160px label column. */}
                <dt className="flex w-46.5 shrink-0 items-center gap-2.5 font-medium text-tx">
                  <StatusCircle status={row.done ? 'ok' : 'pending'} label={null} />
                  {row.label}
                </dt>
                <dd className={`m-0 min-w-0 ${row.done ? 'text-tx3' : 'text-tx5'}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
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
