import { z } from 'zod';
import { buildOverrideSchema } from './build-args.ts';
import { slugSchema } from './common.ts';
import { ownerRefSchema } from './application-yaml.ts';

/*
 * `.bemmoly/repository.yaml`: settings for every application in a repository, for monorepos.
 * Optional, at the repository root, read with the per-folder application.yaml files on every
 * push to the default branch.
 *
 *   defaults:
 *     group: shop
 *     build: { dockerfile: docker/service.Dockerfile, args: { SERVICE: '${{ app.name }}' } }
 *     paths: [packages/**]
 *   applications:
 *     - { name: orders, path: services/orders }
 *     - { name: web, path: apps/web, build: { dockerfile: apps/web/Dockerfile } }
 *
 * A folder's own application.yaml beats its entry here, which beats `defaults`. Lists such as
 * `paths` and `labels` add up; anything else is replaced. An entry takes any field
 * application.yaml takes; the merged result is checked against application.yaml's schema.
 */

export const REPOSITORY_FILE_PATH = '.bemmoly/repository.yaml';

/** A folder inside the repository, written without a leading or trailing slash. */
export const folderSchema = z
  .string()
  .trim()
  .max(300)
  .refine(
    (path) => !path.startsWith('/') && !path.split('/').some((part) => part === '..'),
    'Use a folder inside the repository, such as services/orders',
  )
  .transform((path) => path.replace(/^\.\/?/, '').replace(/\/+$/, ''));

const pathFilterSchema = z.array(z.string().min(1).max(300)).max(100);

export const repositoryDefaultsSchema = z.strictObject({
  build: buildOverrideSchema.optional(),
  /** Added to every application's own `paths`. */
  paths: pathFilterSchema.optional(),
  /** Steps or `extends`, as application.yaml writes them; checked once merged. */
  pipeline: z.record(z.string(), z.unknown()).optional(),
  labels: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  group: slugSchema.optional(),
  domain: slugSchema.optional(),
  owner: ownerRefSchema.optional(),
});

/**
 * One application in the central list; its other fields are checked once merged. `build`
 * here is the pipeline's build, and null turns the shared one off (a library).
 */
export const repositoryEntrySchema = z.looseObject({
  name: slugSchema,
  path: folderSchema,
  build: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const repositoryFileSchema = z
  .strictObject({
    defaults: repositoryDefaultsSchema.default({}),
    applications: z.array(repositoryEntrySchema).max(500).default([]),
  })
  .superRefine((file, ctx) => {
    const names = new Set<string>();
    const paths = new Set<string>();
    file.applications.forEach((entry, index) => {
      if (names.has(entry.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['applications', index, 'name'],
          message: `${entry.name} is listed twice; application names are unique`,
        });
      }
      if (paths.has(entry.path)) {
        ctx.addIssue({
          code: 'custom',
          path: ['applications', index, 'path'],
          message: `Two applications use the folder "${entry.path}"; give each its own`,
        });
      }
      names.add(entry.name);
      paths.add(entry.path);
    });
  });

/** Where a setting came from: the folder's own file, the central list, or `defaults`. */
export const settingOriginSchema = z.enum(['file', 'central', 'defaults']);

/** For an application's page: which file defines it and where each setting came from. */
export const settingsSourceSchema = z.object({
  /** The file that defines it: its own application.yaml, or the repository file. */
  file: z.string(),
  /** Top-level settings by name, with `build` for the pipeline's build. */
  fields: z.record(z.string(), settingOriginSchema),
});

export type RepositoryDefaults = z.infer<typeof repositoryDefaultsSchema>;
export type RepositoryEntry = z.infer<typeof repositoryEntrySchema>;
export type RepositoryFile = z.infer<typeof repositoryFileSchema>;
export type SettingOrigin = z.infer<typeof settingOriginSchema>;
export type SettingsSource = z.infer<typeof settingsSourceSchema>;
