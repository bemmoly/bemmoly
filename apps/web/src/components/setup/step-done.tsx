import { EntityTile, type EntityTone } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { Link, useNavigate } from '@tanstack/react-router';
import { useSetupDone, type SummaryRow } from '../../hooks/use-setup-done.ts';
import { Loading } from '../form.tsx';
import { StepCircle } from './setup-stepper.tsx';
import { StepFooter, StepForm, type StepNav } from './step-footer.tsx';

/** Each summary row: a tick when it is set, an empty circle when it was skipped. */
function Summary({ rows, leave }: { rows: readonly SummaryRow[]; leave: () => void }) {
  return (
    <dl
      aria-label="Setup summary"
      className="m-0 flex flex-col rounded-card border border-line bg-card px-3.5 text-13"
    >
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex min-h-10 flex-wrap items-center gap-x-2.5 gap-y-0.5 border-b border-line py-2 last:border-b-0"
        >
          {/* The circle sits in the dt because a dl row may hold only dt and dd. */}
          <dt className="flex w-32 shrink-0 items-center gap-2.5 font-medium text-tx">
            <StepCircle state={row.done ? 'done' : 'skipped'} size={16} />
            {row.label}
          </dt>
          <dd className={`m-0 min-w-0 flex-1 ${row.done ? 'text-tx-2' : 'text-tx-3'}`}>
            {row.value}
          </dd>
          {row.later ? (
            <Link
              to={row.later.to}
              onClick={leave}
              className="shrink-0 rounded-chip text-13 font-medium text-acc hover:underline focus-ring"
            >
              {row.later.label}
            </Link>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

interface ActionCardProps {
  to: string;
  title: string;
  body: string;
  icon: IconName;
  tone: EntityTone;
  onClick: () => void;
}

function ActionCard({ to, title, body, icon, tone, onClick }: ActionCardProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-card border border-line bg-card p-3.5 text-tx no-underline hover:border-line-2 hover:shadow-e1 focus-ring motion-safe:transition-shadow"
    >
      <span className="flex items-center justify-between">
        <EntityTile name={title} icon={icon} tone={tone} size={26} />
        <span className="flex text-tx-3 group-hover:text-tx">
          <Icon name="arrow" size={14} />
        </span>
      </span>
      <span className="text-13 font-semibold">{title}</span>
      <span className="text-12 leading-body text-tx-3">{body}</span>
    </Link>
  );
}

/**
 * Done, as a launchpad: the mark settles once, the summary says what is set and links what was
 * skipped, and three cards lead on. Arriving marks setup finished; a failure says so with Retry.
 */
export function StepDone({ nav }: { nav: StepNav }) {
  const { rows, loading, complete, retry, actions, projectAction, leave } = useSetupDone();
  const navigate = useNavigate();
  const open = () => {
    leave();
    void navigate({ to: actions.open.to });
  };
  return (
    <StepForm label="Done" onSubmit={complete.isError ? retry : open} busy={complete.isPending}>
      {loading ? (
        <Loading label="Loading the summary" lines={6} />
      ) : (
        <Summary rows={rows} leave={leave} />
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <ActionCard
          to={projectAction.to}
          title={projectAction.label}
          body={
            projectAction === actions.project
              ? 'A board and backlog for your team, with your first sprint.'
              : 'Work is off. Turn it on in Settings, then create a project.'
          }
          icon="project"
          tone="work"
          onClick={leave}
        />
        <ActionCard
          to={actions.invite.to}
          title={actions.invite.label}
          body="Add people by email, pick their role, put them in teams."
          icon="people"
          tone="accent"
          onClick={leave}
        />
        <ActionCard
          to={actions.open.to}
          title={actions.open.label}
          body="Go to Home. Everything here can be changed in Settings."
          icon="home"
          tone="ink"
          onClick={leave}
        />
      </div>
      <StepFooter
        nav={nav}
        label={actions.open.label}
        disabled={complete.isError}
        loading={complete.isPending}
        error={complete.error}
      />
    </StepForm>
  );
}
