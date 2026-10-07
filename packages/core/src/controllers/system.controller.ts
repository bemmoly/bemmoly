import {
  applyUpdateRequestSchema,
  backupIdParamsSchema,
  backupListQuerySchema,
  catalogUploadQuerySchema,
  createBackupRequestSchema,
  parseOrThrow,
  restoreBackupRequestSchema,
  rollbackRequestSchema,
  verifyBackupRequestSchema,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Readable } from 'node:stream';
import type { Actor } from '../contracts/authz.ts';
import {
  applyUpdate,
  getBackup,
  getSystemHealth,
  getUpdatesOverview,
  listBackups,
  openBackupDownload,
  requestRestore,
  requestRollback,
  requestVerify,
  startManualBackup,
  storeCatalogUpload,
  type SystemDependencies,
} from '../services/system/index.ts';
import { metaOf } from './request-context.ts';

export interface SystemControllerDependencies {
  system: SystemDependencies;
  /** The signed-in actor; throws when the request is not authenticated. */
  resolveActor(request: FastifyRequest): Promise<Actor>;
  /** True until the first admin exists: the wizard's health checks are then anonymous. */
  setupOpen?(): Promise<boolean>;
}

const header = (request: FastifyRequest, name: string) => {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

export function createSystemController(deps: SystemControllerDependencies) {
  const { system } = deps;
  const actorOf = (request: FastifyRequest) => deps.resolveActor(request);
  return {
    async health(request: FastifyRequest) {
      const anonymous = (await deps.setupOpen?.()) ?? false;
      const actor = anonymous ? null : await actorOf(request);
      return getSystemHealth(system, actor, {
        publicUrl: system.config.publicUrl,
        protocol: request.protocol,
        tlsMode: header(request, 'x-bemmoly-tls'),
      });
    },
    async listBackups(request: FastifyRequest) {
      const query = parseOrThrow(backupListQuerySchema, request.query);
      return listBackups(system, await actorOf(request), query);
    },
    async createBackup(request: FastifyRequest, reply: FastifyReply) {
      parseOrThrow(createBackupRequestSchema, request.body ?? {});
      const backup = await startManualBackup(system, await actorOf(request), metaOf(request));
      reply.code(201);
      return backup;
    },
    async getBackup(request: FastifyRequest) {
      const { id } = parseOrThrow(backupIdParamsSchema, request.params);
      return getBackup(system, await actorOf(request), id);
    },
    async restoreBackup(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(backupIdParamsSchema, request.params);
      parseOrThrow(restoreBackupRequestSchema, request.body);
      const result = await requestRestore(system, await actorOf(request), id, metaOf(request));
      reply.code(202);
      return result;
    },
    async verifyBackup(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(backupIdParamsSchema, request.params);
      const { depth } = parseOrThrow(verifyBackupRequestSchema, request.body ?? {});
      const result = await requestVerify(
        system,
        await actorOf(request),
        id,
        depth,
        metaOf(request),
      );
      if ('accepted' in result) reply.code(202);
      return result;
    },
    async downloadBackup(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(backupIdParamsSchema, request.params);
      const download = await openBackupDownload(system, await actorOf(request), id);
      reply
        .type('application/x-tar')
        .header('content-disposition', `attachment; filename="${download.filename}"`);
      return reply.send(download.body);
    },
    async updates(request: FastifyRequest) {
      return getUpdatesOverview(system, await actorOf(request));
    },
    async applyUpdate(request: FastifyRequest, reply: FastifyReply) {
      const { version } = parseOrThrow(applyUpdateRequestSchema, request.body);
      const result = await applyUpdate(system, await actorOf(request), version);
      reply.code(202);
      return result;
    },
    async rollback(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(rollbackRequestSchema, request.body);
      const result = await requestRollback(system, await actorOf(request), body);
      reply.code(202);
      return result;
    },
    async uploadCatalog(request: FastifyRequest, reply: FastifyReply) {
      const { filename } = parseOrThrow(catalogUploadQuerySchema, request.query);
      const stored = await storeCatalogUpload(
        system,
        await actorOf(request),
        filename,
        request.body as Readable,
      );
      reply.code(201);
      return stored;
    },
  };
}

export type SystemController = ReturnType<typeof createSystemController>;
