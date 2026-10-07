import { isTracingEnabled } from './tracing.ts';

/** The shape of the AI SDK's `experimental_telemetry` call option. */
export interface AiTelemetrySettings {
  readonly isEnabled: boolean;
  readonly recordInputs: false;
  readonly recordOutputs: false;
  readonly functionId: string;
}

/**
 * Passed by services/ai/runtime on every AI SDK call so its spans (model, provider,
 * tokens, tool executions) join the request trace. Prompts and outputs are never
 * recorded, whatever the tracing backend.
 */
export function aiTelemetrySettings(purpose: string): AiTelemetrySettings {
  return {
    isEnabled: isTracingEnabled(),
    recordInputs: false,
    recordOutputs: false,
    functionId: purpose,
  };
}
