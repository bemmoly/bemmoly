import { useSearch } from '@tanstack/react-router';
import { SetupWizard } from './setup-wizard.tsx';

export function SetupPage() {
  const { step } = useSearch({ from: '/setup' });
  return <SetupWizard requestedStep={step} />;
}
