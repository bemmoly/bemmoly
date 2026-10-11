import {
  NotFoundError,
  type AiCatalogProviderResponse,
  type AiCatalogResponse,
  type AiPrompt,
  type AiPromptDiffResponse,
  type AiPromptListResponse,
} from '@bemmoly/shared';
import type { Actor } from '../../../contracts/authz.ts';
import { bundledLogos } from '../catalog/bundled.ts';
import { catalogResponse, providerResponse } from '../catalog/views.ts';
import { authorizeAdmin, userIdOf, type AiServiceContext } from './context.ts';

async function logoIds(): Promise<Set<string>> {
  return new Set(Object.keys(await bundledLogos()));
}

/** GET /admin/ai/catalog: resolves live first, every time the picker opens. */
export async function getAiCatalog(
  ctx: AiServiceContext,
  actor: Actor,
): Promise<AiCatalogResponse> {
  await authorizeAdmin(ctx, actor);
  return catalogResponse(await ctx.catalog.resolve(), await logoIds());
}

export async function getAiCatalogProvider(
  ctx: AiServiceContext,
  actor: Actor,
  id: string,
): Promise<AiCatalogProviderResponse> {
  await authorizeAdmin(ctx, actor);
  const resolved = await ctx.catalog.resolve();
  return providerResponse(resolved.data, id, await logoIds());
}

/** A provider's SVG logo; any signed-in admin page may show it. */
export async function getAiCatalogLogo(
  ctx: AiServiceContext,
  actor: Actor,
  id: string,
): Promise<string> {
  await authorizeAdmin(ctx, actor);
  const svg = await ctx.catalog.logo(id);
  if (!svg) throw new NotFoundError(`No logo for "${id}"`);
  return svg;
}

/** POST /admin/ai/catalog-snapshots: a models.dev api.json from any machine that can reach it. */
export async function uploadAiCatalog(
  ctx: AiServiceContext,
  actor: Actor,
  data: unknown,
): Promise<AiCatalogResponse> {
  await authorizeAdmin(ctx, actor);
  return catalogResponse(await ctx.catalog.upload(data), await logoIds());
}

export async function listAiPrompts(
  ctx: AiServiceContext,
  actor: Actor,
): Promise<AiPromptListResponse> {
  await authorizeAdmin(ctx, actor);
  return { items: await ctx.prompts.list() };
}

export async function overrideAiPrompt(
  ctx: AiServiceContext,
  actor: Actor,
  id: string,
  template: string,
): Promise<AiPrompt> {
  await authorizeAdmin(ctx, actor);
  return ctx.prompts.setOverride(id, template, userIdOf(actor));
}

export async function resetAiPrompt(
  ctx: AiServiceContext,
  actor: Actor,
  id: string,
): Promise<void> {
  await authorizeAdmin(ctx, actor);
  await ctx.prompts.resetOverride(id);
}

export async function diffAiPrompt(
  ctx: AiServiceContext,
  actor: Actor,
  id: string,
): Promise<AiPromptDiffResponse> {
  await authorizeAdmin(ctx, actor);
  return ctx.prompts.diff(id);
}
