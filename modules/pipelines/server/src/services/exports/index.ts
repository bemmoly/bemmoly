import type { RequestContext } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { ExportConnection, ExportPreview, ExportQuery } from '../../../../shared/exports.ts';
import type { Provider } from '../../../../shared/common.ts';
import { createZip } from '../../utils/zip.ts';
import { listConnections, toRecord } from '../clouds/store.ts';
import { requireAccess, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import { NO_FACTS, type ExportBundle, type ExportFacts } from '../providers/export-contract.ts';
import type { ProviderSource } from '../providers/index.ts';
import type { ProviderRegistry } from '../providers/registry.ts';
import { connectionRecords } from './records.ts';
import { currentServices } from './services.ts';

/*
 * Platform › Export: everything Pipelines created, one directory per connection, built from
 * what Pipelines recorded plus the few facts the provider reads now. A platform admin's, as
 * every cloud write is, because the files name every project, identity and secret.
 */

export interface ExportsServiceDeps extends PipelinesServiceDeps {
  providers: ProviderRegistry | ProviderSource;
  now?: () => Date;
}

interface Built {
  item: ExportConnection;
  bundle: ExportBundle;
}

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'connection';

const topReadme = (built: readonly Built[], leftOut: readonly string[]) =>
  `# Exported from Bemmoly Pipelines

One directory per cloud connection. Each has its own README.md saying how to adopt what is in it
with Terraform and Helm, what to fill in first and what was left out. No file holds a secret value.

${built.map(({ item }) => `- \`${item.directory}/\`: ${item.connection.name}`).join('\n') || '- Nothing Pipelines made could be exported.'}
${leftOut.length > 0 ? `\n## Not in any directory\n\n${leftOut.map((line) => `- ${line}`).join('\n')}\n` : ''}`;

export function createExportsService(deps: ExportsServiceDeps) {
  const source = deps.providers;
  const providers = typeof source === 'function' ? source : async () => source;
  const now = deps.now ?? (() => new Date());

  async function build(ctx: RequestContext, query: ExportQuery) {
    await requireAccess(deps).authorizeAction(ctx, 'platform', { scope: { kind: 'organisation' } });
    const sql = requireDatabase(deps);
    const registry = await providers();
    const rows = (await listConnections(sql)).filter(
      (row) => !query.connection || row.id === query.connection,
    );
    if (query.connection && rows.length === 0) {
      throw new NotFoundError('No cloud connection has that id');
    }
    const { byConnection, leftOut } = await currentServices(sql, registry, query.application);
    const built: Built[] = [];
    const taken = new Set<string>();
    for (const row of rows) {
      const services = byConnection.get(row.id) ?? [];
      if (query.application && services.length === 0) continue;
      const provider = registry.list().find((p) => p.id === (row.provider as Provider));
      if (!provider?.export) {
        leftOut.push(
          `${row.name}: Pipelines cannot export ${provider?.name ?? row.provider} connections yet.`,
        );
        continue;
      }
      const records = await connectionRecords(sql, row, services, query.application);
      let facts: ExportFacts = NO_FACTS;
      if (provider.export.read) {
        // The cloud may be unreachable; then the files say which values to fill in by hand.
        facts = await provider.export.read(toRecord(row), records).catch((error: unknown) => ({
          ...NO_FACTS,
          problems: [`Pipelines could not reach ${row.name}: ${(error as Error).message}`],
        }));
      }
      const bundle = provider.export.files(records, facts);
      let directory = slugOf(row.name);
      for (let n = 2; taken.has(directory); n += 1) directory = `${slugOf(row.name)}-${n}`;
      taken.add(directory);
      const charts = new Set(
        records.services
          .filter((service) => service.placement.runtime !== 'cloud-run')
          .map((service) => service.placement.namespace),
      );
      built.push({
        bundle,
        item: {
          connection: {
            id: row.id,
            name: row.name,
            mode: row.config['mode'] === 'attached' ? 'attached' : 'managed',
          },
          directory,
          counts: {
            projects: records.resources.filter(
              (r) => r.kind === 'account' && r.spec['adopt'] !== true,
            ).length,
            resources: records.resources.length,
            services: records.services.length,
            charts: charts.size,
            secrets: records.secrets.length,
          },
          files: bundle.files.map((file) => `${directory}/${file.path}`).sort(),
          leftOut: bundle.leftOut,
          toFill: bundle.toFill,
        },
      });
    }
    if (query.application && built.length === 0 && leftOut.length === 0) {
      throw new NotFoundError(`${query.application} runs nowhere Pipelines can export yet`);
    }
    const day = now().toISOString().slice(0, 10);
    const fileName = `bemmoly-pipelines-export${query.application ? `-${query.application}` : ''}-${day}.zip`;
    return { built, leftOut, fileName };
  }

  return {
    async preview(ctx: RequestContext, query: ExportQuery): Promise<ExportPreview> {
      const { built, leftOut, fileName } = await build(ctx, query);
      return { fileName, items: built.map(({ item }) => item), leftOut };
    },

    /** The bundle as a zip: a README at the top, then each connection's directory. */
    async archive(ctx: RequestContext, query: ExportQuery) {
      const { built, leftOut, fileName } = await build(ctx, query);
      const entries = [
        { name: 'README.md', data: topReadme(built, leftOut) },
        ...built.flatMap(({ item, bundle }) =>
          bundle.files.map((file) => ({
            name: `${item.directory}/${file.path}`,
            data: file.content,
          })),
        ),
      ];
      return { fileName, body: createZip(entries, now()) };
    },
  };
}

export type ExportsService = ReturnType<typeof createExportsService>;
