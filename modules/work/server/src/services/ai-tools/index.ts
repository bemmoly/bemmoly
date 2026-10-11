import { aiToolContribution, type AiToolDefinition, type ModuleContext } from '@bemmoly/core';
import type { WorkServices } from '../index.ts';
import { createWriteTools } from './create-writes.ts';
import { issueWriteTools } from './issue-writes.ts';
import { workReadTools } from './read.ts';
import { workflowTools } from './workflow-writes.ts';

/** Every tool Work offers the ⌘K planner. */
export function workAiTools(services: WorkServices): AiToolDefinition[] {
  return [
    ...workReadTools(services),
    ...issueWriteTools(services),
    ...createWriteTools(services),
    ...workflowTools(services),
  ] as AiToolDefinition[];
}

/** Registers Work's planner tools with the kernel; the kernel never imports Work. */
export function registerWorkAiTools(ai: ModuleContext['ai'], services: WorkServices): void {
  for (const tool of workAiTools(services)) ai.addTool(aiToolContribution(tool));
}
