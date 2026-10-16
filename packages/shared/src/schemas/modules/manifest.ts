import { z } from 'zod';
import { moduleIdSchema } from '../../modules/index.ts';

export const navPlacementSchema = z.enum(['top', 'settings', 'create', 'command']);

export const navEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string().startsWith('/'),
  placement: navPlacementSchema,
  /** The row's icon in ⌘K and menus: an icon name from the design system's set. */
  icon: z.string().min(1).optional(),
  /** A "G, then a letter" chord that goes here from anywhere, e.g. "G B" for the board. */
  keys: z
    .string()
    .regex(/^G [A-Z]$/)
    .optional(),
});

/** The chords the shell keeps for itself: G H for Home, G I for Inbox. */
export const KERNEL_CHORDS: readonly string[] = ['G H', 'G I'];

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

/**
 * The module's own settings in workspace Settings: one row under the Modules group, headed by
 * the module's tile and name, that opens `path`. The module's web entry `settings.tsx` draws
 * the pages under it; Settings › Modules keeps turning the module on and off.
 */
export const moduleSettingsSchema = z.object({
  path: z.string().regex(/^\/settings\/[a-z][a-z0-9-]*$/),
  /** Who may open them: "admin" for workspace admins, or a capability name. */
  requires: z.string().min(1).default('admin'),
});

/**
 * Where people meet the module: "shell" in Bemmoly's frame, "product" behind a product with its
 * own web app (Pipelines), which Bemmoly's shell never draws. Absent means "shell".
 */
export const moduleSurfaceSchema = z.enum(['shell', 'product']);

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
  settings: moduleSettingsSchema.optional(),
  surface: moduleSurfaceSchema.optional(),
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
export type ModuleSettings = z.infer<typeof moduleSettingsSchema>;
export type ModuleSettingsInput = z.input<typeof moduleSettingsSchema>;
export type ModuleSurface = z.infer<typeof moduleSurfaceSchema>;
export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
export type ModulesResponse = z.infer<typeof modulesResponseSchema>;
