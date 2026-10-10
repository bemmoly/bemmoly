import { z } from 'zod';
import { moduleIdSchema } from '../../modules/index.ts';

export const navPlacementSchema = z.enum(['top', 'settings', 'create', 'command']);

export const navEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string().startsWith('/'),
  placement: navPlacementSchema,
});

/** One kind of result a module's search provider answers ⌘K with, and the group it shows under. */
export const searchGroupSchema = z.object({
  kind: z.string().min(1),
  label: z.string().min(1),
});

/**
 * The colour a module is drawn in: one of the logo's three colours (Work is brand-1, Docs
 * brand-2, AI brand-3), the theme accent, or a hue of the epic palette for any other module.
 * A token name, never a hex, so a theme can never repaint a module into another's colour.
 */
export const moduleColorSchema = z.enum([
  'brand-1',
  'brand-2',
  'brand-3',
  'accent',
  'epic-1',
  'epic-2',
  'epic-3',
  'epic-4',
  'epic-5',
  'epic-6',
  'epic-7',
  'epic-8',
]);

/** A fixed row a module puts in its sidebar section, under the rows it draws itself. */
export const sidebarLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string().startsWith('/'),
  /** An icon name from the design system's set. */
  icon: z.string().min(1).optional(),
});

/**
 * The module's one section in the app sidebar. The heading is the module's tile and name and
 * leads to `path`; the module's web entry `sidebar.tsx`, loaded with the shell and never with a
 * screen, draws the live rows (Work's projects, Docs' spaces); `links` follow them.
 */
export const sidebarSectionSchema = z.object({
  path: z.string().startsWith('/'),
  links: z.array(sidebarLinkSchema).default([]),
  /** Rows the module adds among Home and Inbox, and to the phone's bottom bar ("My issues"). */
  primary: z.array(sidebarLinkSchema).default([]),
  /** The heading's "+" opens this create entry (by its navigation id) in place. */
  add: z.object({ create: z.string().min(1), label: z.string().min(1) }).optional(),
});

/** What the web shell needs to know about one enabled module. */
export const moduleManifestSchema = z.object({
  id: moduleIdSchema,
  /** What people call the module, e.g. "Work"; older servers leave it out. */
  name: z.string().min(1).optional(),
  version: z.string().min(1),
  navigation: z.array(navEntrySchema),
  /** Present when the module answers palette searches; the palette offers each as a scope. */
  search: z.array(searchGroupSchema).optional(),
  /** Its tile's icon, an icon name from the design system's set; older servers leave it out. */
  icon: z.string().min(1).optional(),
  color: moduleColorSchema.optional(),
  /** Where its section sits in the sidebar and its entries in menus, lowest first. */
  order: z.number().int().optional(),
  sidebar: sidebarSectionSchema.optional(),
});

export const modulesResponseSchema = z.object({
  items: z.array(moduleManifestSchema),
});

export type NavPlacement = z.infer<typeof navPlacementSchema>;
export type NavEntry = z.infer<typeof navEntrySchema>;
export type SearchGroup = z.infer<typeof searchGroupSchema>;
export type ModuleColor = z.infer<typeof moduleColorSchema>;
export type SidebarLink = z.infer<typeof sidebarLinkSchema>;
export type SidebarSection = z.infer<typeof sidebarSectionSchema>;
export type SidebarSectionInput = z.input<typeof sidebarSectionSchema>;
export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
export type ModulesResponse = z.infer<typeof modulesResponseSchema>;
