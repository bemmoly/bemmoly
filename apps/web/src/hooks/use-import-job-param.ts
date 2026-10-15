import { useEffect, useRef } from 'react';
import type { ImportFlow } from './use-import-flow.ts';
import { useSearchParam } from './use-search-param.ts';

/**
 * `?job=<id>` opens that import at its own step: the Inbox's "import finished" link lands
 * here, and opening a recent import writes it so reload and Back keep it. Leaving the job
 * (a new source, Start over) takes it out of the address.
 */
export function useImportJobParam(flow: ImportFlow): ImportFlow {
  const [jobParam, setJobParam] = useSearchParam('job');
  const opened = useRef<string | null>(null);
  const { open } = flow;
  useEffect(() => {
    if (!jobParam || jobParam === opened.current) return;
    opened.current = jobParam;
    open(jobParam);
  }, [jobParam, open]);
  const leave = () => {
    opened.current = null;
    if (jobParam) setJobParam(null, true);
  };
  return {
    ...flow,
    open: (id: string) => {
      opened.current = id;
      flow.open(id);
      setJobParam(id, true);
    },
    pick: (id: string) => {
      leave();
      flow.pick(id);
    },
    backToConnect: () => {
      leave();
      flow.backToConnect();
    },
    startOver: () => {
      leave();
      flow.startOver();
    },
  };
}
