import {
  ForbiddenError,
  NotFoundError,
  UPLOAD_IMAGE_TYPES,
  ValidationError,
  type UploadedFile,
  type UploadFileQuery,
  type UploadFileType,
} from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Logger } from '../../config/logger.ts';
import type { Actor } from '../../contracts/authz.ts';
import type { ObjectStore } from '../../contracts/object-store.ts';
import {
  fileUrl,
  type FileAccess,
  type FileContent,
  type FileTargetDefinition,
} from '../../modules/files.ts';
import type { FromModule } from '../../modules/registry.ts';
import type { RequestContext } from '../authz/index.ts';
import { putContent } from '../storage/index.ts';
import { cleanupFiles } from './cleanup.ts';
import { safeFileName, sniffFile, type SniffedFile } from './sniff.ts';

/** Under the backed-up attachments folder, apart from other attachments' keys. */
export const FILES_PREFIX = 'attachments/files';

export interface FilesServiceDeps {
  sql: SqlClient;
  store: ObjectStore;
  /** Where uploads are spooled while hashed (spoolDirectory(BEMMOLY_DATA_DIR)). */
  spoolDir: string;
  /** Every module's file targets; read on each call, so it follows the registry. */
  targets: () => readonly FromModule<FileTargetDefinition>[];
  /** Live enabled state; a disabled module's files are neither written nor served. */
  isEnabled?: (moduleId: string) => boolean;
  maxBytes: number;
  logger: Logger;
}

export interface FileRow {
  id: string;
  target_kind: string;
  target_id: string;
  storage_key: string;
  filename: string;
  mime: UploadFileType;
  size: string | number;
}

export interface StoredFile extends FileContent {
  mime: UploadFileType;
}

const userOf = (actor: Actor): string | null =>
  actor.kind === 'user' ? actor.id : (actor.userId ?? null);

const IMAGES_ONLY: readonly UploadFileType[] = UPLOAD_IMAGE_TYPES;

/** Why a file was refused, in words that name what the target does take. */
function refusal(sniffed: SniffedFile, accepts: readonly UploadFileType[]): ValidationError {
  if (sniffed.kind === 'svg') {
    return new ValidationError('SVG images are not accepted; export it as PNG instead', {
      details: { reason: 'svg_refused' },
    });
  }
  const documents = accepts.some((mime) => !mime.startsWith('image/'));
  return new ValidationError(
    documents
      ? 'Only images (PNG, JPEG, GIF, WebP), PDF and HTML files can be added'
      : 'Only PNG, JPEG, GIF and WebP images can be added',
    { details: { reason: 'unsupported_type', accepts } },
  );
}

const toUploaded = (row: FileRow): UploadedFile => ({
  id: row.id,
  url: fileUrl(row.id),
  name: row.filename,
  mime: row.mime,
  size: Number(row.size),
});

/**
 * Files people add to a module's content. The module's target decides who may add and read
 * them; the kernel checks size and what the bytes really are, stores them content addressed
 * under the backed-up attachments folder before the row that names them, and serves them.
 */
export function createFilesService(deps: FilesServiceDeps) {
  function targetOf(kind: string) {
    const target = deps.targets().find((candidate) => candidate.kind === kind);
    if (!target) throw new NotFoundError(`Nothing takes files of kind "${kind}"`);
    return target;
  }

  async function access(ctx: RequestContext, kind: string, targetId: string): Promise<FileAccess> {
    const target = targetOf(kind);
    if (deps.isEnabled && !deps.isEnabled(target.moduleId)) {
      throw new NotFoundError(`The ${target.moduleId} module is not enabled`);
    }
    if (!(await ctx.authz.canAccess(ctx.actor, target.moduleId))) {
      throw new ForbiddenError(`You do not have access to the ${target.moduleId} module`, {
        code: 'module_access_denied',
      });
    }
    return target.authorize(ctx, targetId);
  }

  return {
    maxBytes: deps.maxBytes,

    async upload(ctx: RequestContext, query: UploadFileQuery, body: Buffer): Promise<UploadedFile> {
      if ((await access(ctx, query.target, query.targetId)) !== 'write') {
        throw new ForbiddenError('Only people who can edit this may add files to it');
      }
      if (body.byteLength === 0) throw new ValidationError('The file is empty');
      if (body.byteLength > deps.maxBytes) {
        throw new ValidationError('The file is too large', {
          details: { reason: 'too_large', maxBytes: deps.maxBytes },
        });
      }
      const accepts = targetOf(query.target).accepts ?? IMAGES_ONLY;
      const sniffed = sniffFile(body, query.name);
      if (sniffed.kind === 'svg' || sniffed.kind === 'other' || !accepts.includes(sniffed.mime)) {
        throw refusal(sniffed, accepts);
      }
      const stored = await putContent(deps.store, body, {
        contentType: sniffed.mime,
        prefix: FILES_PREFIX,
        spoolDir: deps.spoolDir,
      });
      const [row] = await deps.sql<FileRow[]>`
        insert into files (target_kind, target_id, storage_key, filename, mime, size, sha256,
          uploaded_by)
        values (${query.target}, ${query.targetId}, ${stored.key},
          ${safeFileName(query.name, sniffed.mime)}, ${sniffed.mime}, ${body.byteLength},
          ${stored.checksumSha256}, ${userOf(ctx.actor)})
        returning id, target_kind, target_id, storage_key, filename, mime, size`;
      deps.logger.info(
        { file: row!.id, target: query.target, size: body.byteLength, requestId: ctx.requestId },
        'file uploaded',
      );
      return toUploaded(row!);
    },

    /** The bytes, for anyone who may read the target; anyone else is told it does not exist. */
    async read(ctx: RequestContext, id: string): Promise<StoredFile> {
      const [row] = await deps.sql<FileRow[]>`
        select id, target_kind, target_id, storage_key, filename, mime, size
        from files where id = ${id}`;
      if (!row) throw new NotFoundError('The file was not found');
      const verdict = await access(ctx, row.target_kind, row.target_id).catch((error: unknown) => {
        if (error instanceof ForbiddenError) return 'deny' as const;
        throw error;
      });
      if (verdict === 'deny') throw new NotFoundError('The file was not found');
      const object = await deps.store.get(row.storage_key);
      return { name: row.filename, mime: row.mime, size: Number(row.size), body: object.body };
    },

    /** Deletes files no content has referred to for a day; the housekeeping job calls it. */
    async cleanup(now: Date = new Date()): Promise<number> {
      return cleanupFiles(deps, now);
    },
  };
}

export type FilesService = ReturnType<typeof createFilesService>;
