// Fixtures for bemmoly-ai-sdk-outside-runtime.

// ruleid: bemmoly-ai-sdk-outside-runtime
import { generateText } from 'ai';
// ruleid: bemmoly-ai-sdk-outside-runtime
import type { LanguageModel } from 'ai';
// ruleid: bemmoly-ai-sdk-outside-runtime
import { MockLanguageModelV4 } from 'ai/test';
// ruleid: bemmoly-ai-sdk-outside-runtime
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
// ok: bemmoly-ai-sdk-outside-runtime
import { z } from 'zod';
// ok: bemmoly-ai-sdk-outside-runtime
import type { AiFacade } from '@bemmoly/core';

export async function loadsAProviderDirectly() {
  // ruleid: bemmoly-ai-sdk-outside-runtime
  return import('@ai-sdk/openai-compatible');
}

export function usesTheFacade(ai: AiFacade) {
  // ok: bemmoly-ai-sdk-outside-runtime
  return ai.generate({ role: 'fast', purpose: 'qa', prompt: 'hi', schema: z.string() });
}

export { generateText, createOpenAICompatible, MockLanguageModelV4 };
export type { LanguageModel };
