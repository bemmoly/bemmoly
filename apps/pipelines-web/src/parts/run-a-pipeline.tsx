import { useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { RunDialog } from '../screens/application/run-dialog.tsx';

/**
 * The seam for "Run a pipeline" (stream S4 owns the new dialog): `open` starts it for a
 * service, or with none lets the person choose one; `dialog` is mounted once by the screen.
 * Until then a service runs through the existing run form and no service opens Runs.
 */
export function useRunPipeline(): { open: (service?: string) => void; dialog: ReactNode } {
  const navigate = useNavigate();
  const [service, setService] = useState<string | null>(null);
  const open = (key?: string) => {
    if (key) setService(key);
    else void navigate({ to: '/runs' });
  };
  return {
    open,
    dialog: service ? (
      <RunDialog application={service} open onClose={() => setService(null)} />
    ) : null,
  };
}
