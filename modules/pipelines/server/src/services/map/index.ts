import type { RequestContext } from '@bemmoly/core';
import type { DomainColor } from '../../../../shared/catalog.ts';
import type { EnvironmentRef } from '../../../../shared/environments.ts';
import type { MapCell, MapColumn, MapQuery, MapRow, ReleaseMap } from '../../../../shared/map.ts';
import type { MapEnvironmentRecord } from '../../models/delivery.ts';
import { authorizePipelines, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import { resolveScope, workspaceName } from '../overview/index.ts';
import { buildCells, mapCells, mapRows, type MapFilter } from './query.ts';
import { iso } from '../../utils/time.ts';
import { timeline } from './timeline.ts';

const EMPTY: Omit<MapCell, 'column'> = {
  total: 0,
  moving: 0,
  failed: 0,
  waiting: 0,
  canary: 0,
  rolledBack: 0,
  running: 0,
  note: null,
  dots: [],
};

/**
 * Releases at the same point would sit on one spot; a small, stable nudge per release keeps
 * each dot visible without changing what the lane says.
 */
function spread(id: string, progress: number): number {
  const nudge = ((Number.parseInt(id.slice(-4), 16) % 17) - 8) / 100;
  return Math.max(0, Math.min(1, progress + nudge));
}

const GLYPH: Record<string, MapCell['dots'][number]['state']> = {
  deploying: 'running',
  canary: 'running',
  waiting: 'waiting',
  failed: 'failed',
};

/**
 * The Release map for a scope, live or rewound: rows by scope, columns Build and test and
 * each environment, counts per cell and dots only for what moves. Four queries in parallel,
 * whatever the size of the catalog.
 */
export function createMapService(deps: PipelinesServiceDeps) {
  return {
    async get(ctx: RequestContext, query: MapQuery): Promise<ReleaseMap> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const scope = await resolveScope(sql, query.scope);
      const filter: MapFilter = {
        level: scope.group ? 'group' : scope.domain ? 'domain' : 'organisation',
        domainId: scope.domain?.id ?? null,
        groupId: scope.group?.id ?? null,
        team: query.team ?? null,
        tier: query.tier ?? null,
        at: query.at ? new Date(query.at) : null,
      };
      const [rows, environments, cells, builds, buckets, organisation] = await Promise.all([
        mapRows(sql, filter),
        sql<MapEnvironmentRecord[]>`
          select id, key, name, class, protection from pipeline_environments
          where archived_at is null order by position, id`,
        mapCells(sql, filter),
        buildCells(sql, filter),
        timeline(sql, filter),
        workspaceName(sql),
      ]);
      const filtered = Boolean(query.team || query.tier !== undefined);
      const shown = filtered ? rows.filter((row) => row.count > 0) : rows;
      const columns: MapColumn[] = [
        { kind: 'build', key: 'build', label: 'Build and test' },
        ...environments.map((environment) => {
          const ref: EnvironmentRef = {
            id: environment.id,
            key: environment.key,
            name: environment.name,
            class: environment.class as EnvironmentRef['class'],
          };
          return {
            kind: 'environment' as const,
            key: environment.key,
            label: environment.name,
            environment: ref,
            protected: environment.protection['protected'] === true,
          };
        }),
      ];
      const cellOf = new Map(
        cells.cells.map((cell) => [`${cell.row_id}:${cell.environment_id}`, cell]),
      );
      const dotsOf = Map.groupBy(cells.dots, (dot) => `${dot.row_id}:${dot.environment_id}`);
      const buildOf = new Map(builds.cells.map((cell) => [cell.row_id, cell]));
      const buildDots = Map.groupBy(builds.dots, (dot) => dot.row_id);
      const prefix = scope.domain ? `${scope.domain.key}/` : '';
      const mapRowsOut: MapRow[] = shown.map((row) => ({
        kind:
          filter.level === 'organisation'
            ? 'domain'
            : filter.level === 'domain'
              ? 'group'
              : 'application',
        id: row.id,
        key: row.key,
        name: row.name,
        color: filter.level === 'organisation' ? (row.color as DomainColor) : null,
        count: row.count,
        zoomTo: filter.level === 'group' ? null : `${prefix}${row.key}`,
        cells: [
          {
            ...EMPTY,
            column: 'build',
            total: buildOf.get(row.id)?.running ?? 0,
            running: buildOf.get(row.id)?.running ?? 0,
            dots: (buildDots.get(row.id) ?? []).map((dot) => ({
              id: dot.id,
              application: dot.application,
              version: dot.version,
              state: 'running' as const,
              progress: spread(dot.id, Number(dot.progress)),
            })),
          },
          ...environments.map((environment) => {
            const key = `${row.id}:${environment.id}`;
            const cell = cellOf.get(key);
            return {
              ...EMPTY,
              column: environment.key,
              ...(cell
                ? {
                    total: cell.total,
                    moving: cell.moving,
                    failed: cell.failed,
                    waiting: cell.waiting,
                    canary: cell.canary,
                    rolledBack: cell.rolled_back,
                  }
                : {}),
              dots: (dotsOf.get(key) ?? []).map((dot) => ({
                id: dot.id,
                application: dot.application,
                version: dot.version ?? '',
                state: GLYPH[dot.state] ?? 'running',
                progress: spread(dot.id, Number(dot.progress)),
              })),
            };
          }),
        ],
      }));
      return {
        scope: {
          path:
            scope.group && scope.domain
              ? `${scope.domain.key}/${scope.group.key}`
              : (scope.domain?.key ?? ''),
          name: scope.group?.name ?? scope.domain?.name ?? organisation,
        },
        at: filter.at ? filter.at.toISOString() : null,
        live: !filter.at,
        columns,
        rows: mapRowsOut,
        timeline: buckets.map((bucket) => ({
          start: iso(bucket.start),
          deploys: bucket.deploys,
          incident: bucket.incident,
        })),
        totals: {
          applications: shown.reduce((sum, row) => sum + row.count, 0),
          domains:
            filter.level === 'organisation' ? shown.filter((row) => row.count > 0).length : 1,
        },
      };
    },
  };
}

export type MapService = ReturnType<typeof createMapService>;
