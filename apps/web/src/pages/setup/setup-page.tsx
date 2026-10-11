import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { setupStatusQuery } from '../../hooks/use-session.ts';
import { SetupWizard } from './setup-wizard.tsx';
import { WelcomeStep } from './welcome-step.tsx';

export function SetupPage() {
  const { step, welcome } = useSearch({ from: '/setup' });
  const navigate = useNavigate();
  const status = useQuery(setupStatusQuery);
  // The welcome is for an admin who exists; before that the wizard starts at the workspace.
  if (welcome && status.data?.initialized) {
    return (
      <WelcomeStep onContinue={(next) => void navigate({ to: '/setup', search: { step: next } })} />
    );
  }
  return <SetupWizard requestedStep={step} />;
}
