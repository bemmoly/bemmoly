import { Button, Logo } from '@bemmoly/ui';
import { useEffect, useRef } from 'react';
import { FormError, Loading } from '../../components/form.tsx';
import { SettleMark } from '../../components/setup/settle-mark.tsx';
import { SetupHeader } from '../../components/setup/setup-header.tsx';
import { SetupProgress, SetupStepper } from '../../components/setup/setup-stepper.tsx';
import { StepAccount } from '../../components/setup/step-account.tsx';
import { StepAi } from '../../components/setup/step-ai.tsx';
import { StepDone } from '../../components/setup/step-done.tsx';
import type { StepNav } from '../../components/setup/step-footer.tsx';
import { StepImport } from '../../components/setup/step-import.tsx';
import { StepLook } from '../../components/setup/step-look.tsx';
import { StepPeople } from '../../components/setup/step-people.tsx';
import { StepWorkspace } from '../../components/setup/step-workspace.tsx';
import { useSetupHealth, type HealthRow } from '../../hooks/use-setup-health.ts';
import { useSetupWizard } from '../../hooks/use-setup-wizard.ts';

function StepBody({ step, nav, rows }: { step: number; nav: StepNav; rows: readonly HealthRow[] }) {
  switch (step) {
    case 1:
      return <StepWorkspace nav={nav} rows={rows} />;
    case 2:
      return <StepAccount nav={nav} />;
    case 3:
      return <StepImport nav={nav} />;
    case 4:
      return <StepPeople nav={nav} />;
    case 5:
      return <StepAi nav={nav} />;
    case 6:
      return <StepLook nav={nav} />;
    default:
      return <StepDone nav={nav} />;
  }
}

/** The welcome and the finish get the mark; every other step goes straight to its question. */
function StepMark({ step, last }: { step: number; last: boolean }) {
  if (step === 1) return <Logo size={56} label="" className="mb-1" />;
  if (last) return <SettleMark size={56} />;
  return null;
}

/**
 * The first-run wizard: a quiet header, the stepper, and one step at a time in a 640px column.
 * The heading takes focus on every step change, so a screen reader hears where it is.
 */
export function SetupWizard({ requestedStep }: { requestedStep: number | undefined }) {
  const wizard = useSetupWizard(requestedStep);
  const health = useSetupHealth(wizard.signedIn);
  const { def } = wizard;
  const heading = useRef<HTMLHeadingElement>(null);
  const nav: StepNav = {
    label: def.nextLabel ?? '',
    counter: wizard.counter,
    canSkip: wizard.canSkip,
    canGoBack: wizard.canGoBack,
    next: wizard.next,
    skip: wizard.skip,
    back: wizard.back,
  };
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    // A step that focuses its first field keeps it; otherwise the heading says where we are.
    const active = document.activeElement;
    if (!active || active === document.body) heading.current?.focus({ preventScroll: true });
  }, [wizard.step]);
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-tx">
      <SetupHeader versionLabel={health.versionLabel} />
      <div className="mx-auto grid w-full max-w-[928px] flex-1 items-start gap-10 px-4 pt-6 pb-16 md:grid-cols-[200px_minmax(0,640px)] md:px-6 md:pt-10">
        <SetupStepper steps={wizard.steps} onVisit={wizard.goTo} />
        <main className="flex min-w-0 flex-col gap-6">
          {wizard.error ? (
            <div className="flex flex-col items-start gap-3">
              <FormError error={wizard.error} />
              <Button variant="secondary" onClick={wizard.retry}>
                Retry
              </Button>
            </div>
          ) : wizard.loading ? (
            <Loading label="Loading setup" lines={6} />
          ) : (
            <>
              <SetupProgress steps={wizard.steps} counter={wizard.counter} />
              <div key={wizard.step} className="flex flex-col gap-6 motion-safe:animate-rise">
                <div className="flex flex-col items-start gap-1.5">
                  <StepMark step={wizard.step} last={wizard.isLast} />
                  <h1
                    ref={heading}
                    tabIndex={-1}
                    className="m-0 text-24 font-semibold tracking-display text-tx outline-0"
                  >
                    {def.title}
                  </h1>
                  <p className="m-0 max-w-[60ch] text-14 leading-brief text-tx-3">{def.subtitle}</p>
                </div>
                <StepBody step={wizard.step} nav={nav} rows={health.rows} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
