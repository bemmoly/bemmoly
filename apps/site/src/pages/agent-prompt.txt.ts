import type { APIRoute } from 'astro';
import { AGENT_PROMPT } from '../data/agent-prompt.ts';

/** /agent-prompt.txt: the hero's coding-agent prompt as plain text, to read before pasting. */
export const GET: APIRoute = () =>
  new Response(AGENT_PROMPT, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
