import { z } from 'zod';
import type { AiContribution } from '../../../modules/registries.ts';
import type { AiReadToolDefinition, AiToolDefinition, AiWriteToolDefinition } from './types.ts';

/** Model APIs accept letters, digits, _ and - in a tool name, up to 64 characters. */
const TOOL_NAME = /^[a-z][a-z0-9]*_[a-z0-9_]{1,56}$/;

/**
 * A tool's input from the API it stands for: the path parameters (`{ key }`) and the request
 * body schema, merged. The same zod objects validate the request and the model's arguments,
 * so a tool can never accept what the endpoint would refuse.
 */
export function requestToolInput<P extends z.ZodRawShape, B extends z.ZodRawShape>(
  params: z.ZodObject<P>,
  body: z.ZodObject<B>,
) {
  return params.extend(body.shape);
}

export function defineReadTool<Input>(
  tool: AiReadToolDefinition<Input>,
): AiReadToolDefinition<Input> {
  return tool;
}

export function defineWriteTool<Input, Undo = never>(
  tool: AiWriteToolDefinition<Input, Undo>,
): AiWriteToolDefinition<Input, Undo> {
  return tool;
}

/** What `ctx.ai.addTool` takes: the definition rides in `definition`. */
export function aiToolContribution(tool: AiToolDefinition): AiContribution {
  if (!TOOL_NAME.test(tool.name)) {
    throw new Error(`AI tool "${tool.name}" needs a module prefix and only a-z, 0-9 and _`);
  }
  return { name: tool.name, description: tool.description, definition: tool };
}

/** Narrows a contribution's `definition` to a tool this package can run. */
export function isAiToolDefinition(value: unknown): value is AiToolDefinition {
  if (typeof value !== 'object' || value === null) return false;
  const tool = value as Partial<AiToolDefinition>;
  if (typeof tool.name !== 'string' || !(tool.input instanceof z.ZodType)) return false;
  if (tool.kind === 'read') return typeof tool.execute === 'function';
  if (tool.kind === 'write') {
    return (
      typeof tool.describe === 'function' &&
      typeof tool.authorize === 'function' &&
      typeof tool.run === 'function'
    );
  }
  return false;
}
