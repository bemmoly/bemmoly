import { useState, type ReactNode } from 'react';
import { RunPipelineDialog } from '../screens/runs/run-pipeline-dialog.tsx';

/**
 * "Run a pipeline" for any screen: `open` starts the dialog for a service, or with none lets
 * the person choose one; `dialog` is mounted once by the screen.
 */
export function useRunPipeline(): { open: (service?: string) => void; dialog: ReactNode } {
  const [state, setState] = useState<{ service?: string } | null>(null);
  return {
    open: (service?: string) => setState(service ? { service } : {}),
    dialog: state ? (
      <RunPipelineDialog
        {...(state.service ? { service: state.service } : {})}
        onClose={() => setState(null)}
      />
    ) : null,
  };
}
