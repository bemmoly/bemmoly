import type { AiFacade } from '../../contracts/ai.ts';
import { aiEnabledFor } from './policy.ts';
import { createDisabledAi } from './refusals.ts';

/**
 * The facade before and after the server builds it. Modules register first and identity is
 * wired early, so both hold this handle; until `bind`, every call refuses with 'ai_off'.
 */
export interface AiHandle {
  /** The bound facade, or one that refuses everything. */
  current(): AiFacade;
  bind(facade: AiFacade): void;
  /** For ctx.ai: undefined until bound. */
  bound(): AiFacade | undefined;
  /** /me's aiEnabled for one person. */
  enabledFor(actor: Parameters<AiFacade['policy']>[0]): Promise<boolean>;
}

export function createAiHandle(): AiHandle {
  const disabled = createDisabledAi();
  let facade: AiFacade | undefined;
  return {
    current: () => facade ?? disabled,
    bind(next) {
      facade = next;
    },
    bound: () => facade,
    async enabledFor(actor) {
      if (!facade) return false;
      return aiEnabledFor(await facade.policy(actor));
    },
  };
}
