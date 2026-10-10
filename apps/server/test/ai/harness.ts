import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AiGenerateResult, AiPromptRef } from '@bemmoly/core';
import {
  createEvalAi,
  type EvalAi,
  type EvalPrompts,
  type EvalProvider,
} from '@bemmoly/core/testing';
import { expect, inject } from 'vitest';
import { KERNEL_PROMPT_FILES } from '../../src/config/ai.ts';
import { shippedModules } from '../../src/test-support.ts';
import type { Verdict } from './checks.ts';
import './mode.ts';

/** One file per case: the recorded provider's format, plus the prompt version it answered. */
export const RECORDINGS = fileURLToPath(new URL('./recordings/', import.meta.url));

export const recordingPath = (caseId: string) => `${RECORDINGS}${caseId}.json`;

let prompts: Promise<EvalPrompts> | null = null;

/** Every prompt file on the boot path: the kernel's and the shipped modules'. */
export function evalPrompts(): Promise<EvalPrompts> {
  prompts ??= shippedModules().then((registry) => ({
    kernelFiles: KERNEL_PROMPT_FILES,
    moduleFiles: registry
      .aiPromptFiles()
      .map((file) => ({ moduleId: file.moduleId, path: file.path })),
  }));
  return prompts;
}

/** One model call's answer, as the recorded provider replays it. */
export type RecordedReply =
  { text: string } | { object: unknown } | { toolCalls: { toolName: string; input: unknown }[] };

export interface EvalCase {
  ai: EvalAi;
  live: boolean;
  /** In record mode, writes what the live model answered as this case's recording. */
  save(prompt: AiPromptRef, replies: RecordedReply[]): Promise<void>;
}

export async function evalCase(caseId: string): Promise<EvalCase> {
  const mode = inject('evalMode');
  const provider: EvalProvider = mode.live
    ? { mode: 'live', ...mode.live }
    : { mode: 'recorded', recording: recordingPath(caseId) };
  const ai = await createEvalAi(await evalPrompts(), provider);
  return {
    ai,
    live: mode.live !== null,
    async save(prompt, replies) {
      if (!mode.record) return;
      const body = { prompt, replies: { [prompt.id]: replies } };
      await writeFile(recordingPath(caseId), `${JSON.stringify(body, null, 2)}\n`);
    },
  };
}

/** The final answer of a call as one recorded reply: its object, else its text. */
export function replyOf(result: Pick<AiGenerateResult<unknown>, 'text' | 'object'>): RecordedReply {
  return result.object !== undefined ? { object: result.object } : { text: result.text };
}

/** The prompt version a recording was made against, if it says. */
export async function recordedVersion(caseId: string): Promise<AiPromptRef | null> {
  try {
    const body = JSON.parse(await readFile(recordingPath(caseId), 'utf8')) as {
      prompt?: AiPromptRef;
    };
    return body.prompt ?? null;
  } catch {
    return null;
  }
}

/** Fails with the check's own words, so the report says what the output got wrong. */
export function pass(verdict: Verdict): void {
  expect(verdict, verdict ?? '').toBeNull();
}
