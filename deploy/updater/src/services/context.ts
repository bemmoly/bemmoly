import type { UpdaterStatus, UpdaterStep } from '@bemmoly/shared';
import type { DockerClient } from '../clients/docker.ts';
import type { UpdaterEnv } from '../config/env.ts';
import { writeState } from './state.ts';

export interface UpdaterContext {
  env: UpdaterEnv;
  docker: DockerClient;
  log(message: string, details?: Record<string, unknown>): void;
  now(): Date;
}

/** Records the current step in the state file the app and the progress page read. */
export async function enterStep(
  ctx: UpdaterContext,
  state: UpdaterStatus,
  operation: 'update' | 'rollback',
  step: UpdaterStep,
  message: string,
): Promise<UpdaterStatus> {
  const next: UpdaterStatus = { ...state, state: 'running', operation, step, message };
  ctx.log(message, { operation, step });
  await writeState(ctx.env.BEMMOLY_DIR, next);
  return next;
}

/** The JSON a bemmoly-system command printed, or an error carrying its stderr. */
export function parseCommandJson<T>(
  command: string,
  result: { exitCode: number; stdout: string; stderr: string },
): T {
  if (result.exitCode !== 0) {
    throw new Error(
      `${command} failed (exit ${result.exitCode}): ${result.stderr.trim().slice(-800)}`,
    );
  }
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    throw new Error(
      `${command} printed something that is not JSON: ${result.stdout.slice(0, 200)}`,
    );
  }
}
