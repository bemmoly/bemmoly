import { Document } from 'yaml';
import type { FoundBuild } from './shared-build.ts';

/*
 * The repository file discovery proposes for folders that share a build: what every entry
 * has in common (the Dockerfile, args with the same value, the group and owner) goes in
 * `defaults`, and each application keeps a short entry with only what is its own.
 */

export interface ProposedEntry {
  key: string;
  path: string;
  /** "domain/group", when known. */
  group: string | null;
  /** "team/payments", when known. */
  owner: string | null;
  tier?: number;
  runtime?: string;
  description?: string | null;
  build: FoundBuild;
}

type Values = Record<string, unknown>;

/** The value every entry gives, or undefined when they differ. */
function common<T>(entries: readonly ProposedEntry[], pick: (entry: ProposedEntry) => T) {
  const [first, ...rest] = entries.map(pick);
  return rest.every((value) => value === first) ? first : undefined;
}

function sharedArgs(entries: readonly ProposedEntry[]): Record<string, string> {
  const names = new Set(entries.flatMap((entry) => Object.keys(entry.build.args)));
  const args: Record<string, string> = {};
  for (const name of names) {
    const value = common(entries, (entry) => entry.build.args[name]);
    if (value !== undefined) args[name] = value;
  }
  return args;
}

function defaultsOf(entries: readonly ProposedEntry[]): Values {
  const defaults: Values = {};
  const group = common(entries, (entry) => entry.group);
  if (group) {
    const [domain, key] = group.split('/');
    defaults.group = key;
    defaults.domain = domain;
  }
  const owner = common(entries, (entry) => entry.owner);
  if (owner) defaults.owner = owner;
  const build: Values = { dockerfile: common(entries, (entry) => entry.build.dockerfile) };
  const context = common(entries, (entry) => entry.build.context);
  if (context && context !== '.') build.context = context;
  const args = sharedArgs(entries);
  if (Object.keys(args).length > 0) build.args = args;
  if (build.dockerfile) defaults.build = build;
  return defaults;
}

function entryOf(entry: ProposedEntry, defaults: Values): Values {
  const out: Values = { name: entry.key, path: entry.path };
  if (entry.group && !defaults.group) {
    const [domain, group] = entry.group.split('/');
    out.group = group;
    out.domain = domain;
  }
  if (entry.owner && !defaults.owner) out.owner = entry.owner;
  if (entry.tier !== undefined && entry.tier !== 2) out.tier = entry.tier;
  if (entry.runtime && entry.runtime !== 'container-service') out.runtime = entry.runtime;
  if (entry.description) out.description = entry.description;
  const shared = (defaults.build ?? {}) as { dockerfile?: string; args?: Record<string, string> };
  const build: Values = {};
  if (entry.build.dockerfile !== shared.dockerfile) {
    build.dockerfile = entry.build.dockerfile;
    if (entry.build.context !== '.') build.context = entry.build.context;
  }
  const own = Object.entries(entry.build.args).filter(([name]) => !(name in (shared.args ?? {})));
  if (own.length > 0) build.args = Object.fromEntries(own);
  if (Object.keys(build).length > 0) out.build = build;
  return out;
}

export function writeRepositoryProposal(entries: readonly ProposedEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  const defaults = defaultsOf(sorted);
  const document = new Document({
    defaults,
    applications: sorted.map((entry) => entryOf(entry, defaults)),
  });
  document.commentBefore =
    ' Settings for every application in this repository, proposed by Bemmoly Pipelines.\n' +
    " A folder's own .bemmoly/application.yaml beats its entry here, which beats defaults.";
  return document.toString({ lineWidth: 100, flowCollectionPadding: true });
}
