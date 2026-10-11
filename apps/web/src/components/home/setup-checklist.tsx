import { buttonClassName } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { useSetupLeft } from '../../hooks/use-setup-left.ts';

/**
 * For an admin who skipped setup: the steps still open, each a link back into the wizard, until
 * the wizard is finished. Nobody else sees it.
 */
export function SetupChecklist() {
  const left = useSetupLeft();
  if (!left.unfinished) return null;
  const open = left.steps.filter((step) => step.state !== 'done');
  return (
    <section
      aria-labelledby="setup-left-title"
      className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-e1"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 id="setup-left-title" className="m-0 text-13 font-semibold">
            Finish setting up
          </h2>
          <p className="m-0 text-13 text-tx-3">
            {open.length} {open.length === 1 ? 'step is' : 'steps are'} left. Each takes a minute.
          </p>
        </div>
        <Link
          to="/setup"
          search={{ step: left.resume }}
          className={buttonClassName({ variant: 'primary', className: 'ml-auto' })}
        >
          Continue setup
        </Link>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {open.map((step) => (
          <li key={step.n}>
            <Link
              to="/setup"
              search={{ step: step.n }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-13 text-tx-2 hover:text-tx"
            >
              <Icon name="dot" size={14} className="text-tx-3" />
              {step.name}
              {step.state === 'skipped' ? <span className="text-tx-3">· skipped</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
