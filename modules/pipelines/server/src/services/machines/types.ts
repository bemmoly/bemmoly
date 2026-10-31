import type { SqlClient } from '@bemmoly/core';
import type { RunOutcome } from '../orchestrator/advance.ts';
import type { ProviderRegistry } from '../providers/registry.ts';

/** What starting and following build machines needs. */
export interface MachinesDeps {
  sql: SqlClient;
  providers: () => Promise<ProviderRegistry>;
  /** Bemmoly's address, which a machine's runner calls in on; nothing starts without it. */
  publicUrl?: string;
  /** Tells listeners about runs a failed machine finished. */
  announce: (outcomes: readonly RunOutcome[]) => Promise<void>;
}
