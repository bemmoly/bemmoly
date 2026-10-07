import { Logo } from '@bemmoly/ui';
import { FormError, Loading } from '../../components/form.tsx';
import { SetupRail } from '../../components/setup/setup-rail.tsx';
import { StepAi } from '../../components/setup/step-ai.tsx';
import { StepAppearance } from '../../components/setup/step-appearance.tsx';
import { StepDone } from '../../components/setup/step-done.tsx';
import type { StepNav } from '../../components/setup/step-footer.tsx';
import { StepImport } from '../../components/setup/step-import.tsx';
import { StepPeople } from '../../components/setup/step-people.tsx';
import { StepServer } from '../../components/setup/step-server.tsx';
import { useSetupHealth, type HealthRow } from '../../hooks/use-setup-health.ts';
import { RAIL_NOTE, useSetupWizard } from '../../hooks/use-setup-wizard.ts';

function StepBody({
  step,
  nav,
  adminExists,
  rows,
}: {
  step: number;
  nav: StepNav;
  adminExists: boolean;
  rows: readonly HealthRow[];
}) {
  switch (step) {
    case 1:
      return <StepServer nav={nav} adminExists={adminExists} rows={rows} />;
    case 2:
      return <StepImport nav={nav} />;
    case 3:
      return <StepPeople nav={nav} />;
    case 4:
      return <StepAi nav={nav} />;
    case 5:
      return <StepAppearance nav={nav} />;
    default:
      return <StepDone />;
  }
}

/** The first-run wizard: header, the step rail, and the current step with its footer. */
export function SetupWizard({ requestedStep }: { requestedStep: number | undefined }) {
  const wizard = useSetupWizard(requestedStep);
  const health = useSetupHealth(wizard.signedIn);
  const { def } = wizard;
  const nav: StepNav = {
    label: def.nextLabel ?? '',
    counter: wizard.counter,
    canSkip: wizard.canSkip,
    next: wizard.next,
  };
  // Step 1 leads with what the checks actually found, as the mock's subtitle does.
  const subtitle =
    wizard.step === 1
      ? [health.headline, wizard.adminExists ? null : def.subtitle].filter(Boolean).join(' ')
      : def.subtitle;
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-br bg-sf px-8">
        <Logo variant="lockup" size={26} />
        <span className="text-tx5">Setup</span>
        <span className="ml-auto font-mono text-12 font-medium text-tx4">{health.serverLabel}</span>
      </header>
      <div className="mx-auto grid w-full max-w-310 flex-1 grid-cols-[300px_minmax(0,1fr)] items-start gap-12 px-8 pt-10 pb-20">
        <SetupRail steps={wizard.steps} onVisit={wizard.goTo} note={RAIL_NOTE} />
        <main className="flex max-w-180 flex-col gap-5">
          {wizard.error ? (
            <FormError error={wizard.error} />
          ) : wizard.loading ? (
            <Loading label="Loading setup" lines={6} />
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <h1 className="m-0 text-26 font-semibold tracking-display text-tx">{def.title}</h1>
                <p className="m-0 text-14 leading-brief text-tx4">{subtitle}</p>
              </div>
              <StepBody
                key={wizard.step}
                step={wizard.step}
                nav={nav}
                adminExists={wizard.adminExists}
                rows={health.rows}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
