import { existsSync } from 'node:fs';
import { bundledCatalog } from '../catalog/bundled.ts';
import { NO_ROLE_DEFAULTS } from '../runtime/dependencies.ts';
import { loadProvider } from '../runtime/loader.ts';
import { createRecordedModelSource, readRecording } from '../runtime/recorded.ts';
import type { AiModelSource } from '../runtime/registry.ts';

/**
 * Where an eval's answers come from. CI replays recordings checked in beside the evals; the
 * nightly run calls a live provider named by its models.dev id, so no file names a vendor and
 * the key only ever comes from the environment.
 */
export type EvalProvider =
  | { mode: 'recorded'; recording: string }
  | {
      mode: 'live';
      /** A models.dev provider id, as Settings › AI stores it. */
      provider: string;
      /** The model id every language role uses. */
      model: string;
      /** By the catalog's env names (or any name ending _API_KEY, _TOKEN...), never logged. */
      credentials: Readonly<Record<string, string>>;
      /** Overrides the catalog's API base URL (a gateway, a local server). */
      baseUrl?: string | null;
    };

export class EvalSetupError extends Error {
  override readonly name = 'EvalSetupError';
}

/**
 * Replays one case's recording. A case without one fails, with how to make it, only when it
 * asks for a model; a case that must not reach one needs no file.
 */
function recordedSource(path: string): AiModelSource {
  if (existsSync(path)) return createRecordedModelSource(readRecording(path));
  const missing = async (): Promise<never> => {
    throw new EvalSetupError(
      `No recording at ${path}. Re-record the evals against a live provider (docs/ai-evals.md).`,
    );
  };
  return { language: missing, embedding: async () => null, invalidate: () => undefined };
}

async function liveSource(provider: Extract<EvalProvider, { mode: 'live' }>) {
  const entry = (await bundledCatalog())[provider.provider];
  if (!entry && !provider.baseUrl) {
    throw new EvalSetupError(
      `"${provider.provider}" is not in the bundled models.dev catalog; set a base URL for it`,
    );
  }
  const loaded = await loadProvider({
    catalogId: entry ? provider.provider : 'custom',
    npm: entry?.npm || null,
    protocol: entry ? null : 'openai-compatible',
    name: entry?.name ?? provider.provider,
    baseUrl: provider.baseUrl ?? entry?.api ?? null,
    credentials: provider.credentials,
    headers: {},
  });
  const model = loaded.languageModel(provider.model);
  const resolved = {
    model,
    ref: {
      providerId: provider.provider,
      providerName: entry?.name ?? provider.provider,
      modelId: provider.model,
    },
    capabilities: null,
    defaults: NO_ROLE_DEFAULTS,
  };
  const source: AiModelSource = {
    language: async () => resolved,
    embedding: async () => null,
    invalidate: () => undefined,
  };
  return source;
}

/** Counts every model the facade asks for: "no sources" must ask for none. */
export interface CountingModelSource extends AiModelSource {
  readonly requests: number;
}

export async function createEvalModelSource(provider: EvalProvider): Promise<CountingModelSource> {
  const inner =
    provider.mode === 'recorded' ? recordedSource(provider.recording) : await liveSource(provider);
  let requests = 0;
  return {
    async language(role, call) {
      requests += 1;
      return inner.language(role, call);
    },
    embedding: () => inner.embedding(),
    invalidate: () => inner.invalidate(),
    get requests() {
      return requests;
    },
  };
}
