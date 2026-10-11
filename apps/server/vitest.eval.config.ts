import { defineConfig } from 'vitest/config';
import { z } from 'zod';
import type { EvalMode } from './test/ai/mode.ts';

/*
 * `pnpm eval`: the AI evals in test/ai (tech design §11.2). By default they replay the
 * recordings checked in under test/ai/recordings, so CI needs no key and calls no provider.
 * With BEMMOLY_EVAL_LIVE=true they call the provider named here instead (the nightly job), and
 * with BEMMOLY_EVAL_RECORD=true as well they write what it answered over the recordings.
 */
const env = z
  .object({
    BEMMOLY_EVAL_LIVE: z.stringbool().default(false),
    BEMMOLY_EVAL_RECORD: z.stringbool().default(false),
    /** A models.dev provider id. */
    BEMMOLY_EVAL_PROVIDER: z.string().min(1).optional(),
    BEMMOLY_EVAL_MODEL: z.string().min(1).optional(),
    /** The provider's key; BEMMOLY_EVAL_CREDENTIALS takes a JSON object for cloud providers. */
    BEMMOLY_EVAL_API_KEY: z.string().min(1).optional(),
    BEMMOLY_EVAL_CREDENTIALS: z.string().min(2).optional(),
    BEMMOLY_EVAL_BASE_URL: z.url().optional(),
  })
  .parse(process.env);

function evalMode(): EvalMode {
  if (!env.BEMMOLY_EVAL_LIVE) {
    if (env.BEMMOLY_EVAL_RECORD)
      throw new Error('BEMMOLY_EVAL_RECORD needs BEMMOLY_EVAL_LIVE=true');
    return { live: null, record: false };
  }
  const credentials = env.BEMMOLY_EVAL_CREDENTIALS
    ? z.record(z.string(), z.string()).parse(JSON.parse(env.BEMMOLY_EVAL_CREDENTIALS))
    : env.BEMMOLY_EVAL_API_KEY
      ? { EVAL_API_KEY: env.BEMMOLY_EVAL_API_KEY }
      : null;
  if (!env.BEMMOLY_EVAL_PROVIDER || !env.BEMMOLY_EVAL_MODEL || !credentials) {
    throw new Error(
      'A live eval needs BEMMOLY_EVAL_PROVIDER, BEMMOLY_EVAL_MODEL and BEMMOLY_EVAL_API_KEY (or BEMMOLY_EVAL_CREDENTIALS)',
    );
  }
  return {
    live: {
      provider: env.BEMMOLY_EVAL_PROVIDER,
      model: env.BEMMOLY_EVAL_MODEL,
      credentials,
      baseUrl: env.BEMMOLY_EVAL_BASE_URL ?? null,
    },
    record: env.BEMMOLY_EVAL_RECORD,
  };
}

const mode = evalMode();

export default defineConfig({
  test: {
    include: ['test/ai/**/*.eval.ts'],
    provide: { evalMode: mode },
    // A live model takes seconds per call; a recording answers at once.
    testTimeout: mode.live ? 120_000 : 15_000,
    reporters: ['verbose'],
  },
});
