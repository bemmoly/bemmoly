import { Avatar, Button } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AuthHeading, AuthShell, useAuthWorkspace } from '../../components/auth/auth-layout.tsx';
import { AuthAlt, TextButton } from '../../components/auth/auth-parts.tsx';
import { meQuery } from '../../hooks/use-session.ts';
import { useSetupLeft, type LeftStep } from '../../hooks/use-setup-left.ts';

function StepRow({ step, onContinue }: { step: LeftStep; onContinue: () => void }) {
  const tone =
    step.state === 'done'
      ? 'bg-acc-fill text-on-acc'
      : step.state === 'next'
        ? 'text-acc shadow-[inset_0_0_0_1.5px_var(--acc)]'
        : 'text-tx-3 shadow-[inset_0_0_0_1.5px_var(--line)]';
  return (
    <li
      className={`flex items-center gap-3 border-t border-line px-3.5 py-3 first:border-t-0 ${
        step.state === 'next' ? 'bg-acc-50' : ''
      }`}
    >
      <span
        className={`grid size-5.5 shrink-0 place-items-center rounded-full text-11 font-semibold ${tone}`}
      >
        {step.state === 'done' ? <Icon name="check" size={12} label="Done" /> : step.n}
      </span>
      <div className="min-w-0">
        <b className={`block text-14 font-semibold ${step.state === 'done' ? 'text-tx-2' : ''}`}>
          {step.name}
        </b>
        <span className="block text-13 text-tx-3">
          {step.state === 'skipped' ? 'Skipped for now' : step.sub}
        </span>
      </div>
      {step.state === 'next' ? (
        <Button
          variant="primary"
          size="sm"
          className="ml-auto"
          autoFocus
          iconEnd={<Icon name="arrow-right" size={14} />}
          onClick={onContinue}
        >
          Continue
        </Button>
      ) : null}
    </li>
  );
}

/**
 * What an admin sees on signing in while setup is unfinished: who they are, the steps that
 * are left, and either way forward. Continue resumes the wizard where it was left; "Skip setup"
 * opens the workspace, and Home keeps the remaining steps as a checklist.
 */
export function WelcomeStep({ onContinue }: { onContinue: (step: number) => void }) {
  const me = useQuery(meQuery);
  const { name } = useAuthWorkspace();
  const left = useSetupLeft();
  const navigate = useNavigate();
  const workspace = name ?? 'your workspace';
  const person = me.data?.user;
  const first = person?.name.split(' ')[0] ?? '';
  const skip = () => {
    left.skip();
    void navigate({ to: '/' });
  };
  return (
    <AuthShell title="Welcome" wide>
      {person ? <Avatar name={person.name} size={40} /> : null}
      <AuthHeading
        title={first ? `Welcome back, ${first}` : 'Welcome back'}
        lede={`${workspace} is set up. ${left.remaining} short ${
          left.remaining === 1 ? 'step is' : 'steps are'
        } left. Each can be skipped and finished later in Settings.`}
      />
      <ol className="m-0 flex list-none flex-col overflow-hidden rounded-card p-0 shadow-[inset_0_0_0_1px_var(--line)]">
        {left.steps.map((step) => (
          <StepRow key={step.n} step={step} onContinue={() => onContinue(left.resume)} />
        ))}
      </ol>
      <AuthAlt>
        <TextButton onClick={skip}>Skip setup and open {workspace}</TextButton>
      </AuthAlt>
    </AuthShell>
  );
}
