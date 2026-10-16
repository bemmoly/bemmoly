import { RunsList } from '../runs/runs-list.tsx';

/** The application's Runs tab: the Runs screen's list, narrowed to this application. */
export function ApplicationRuns({ application }: { application: string }) {
  return <RunsList fixed={{ application }} />;
}
