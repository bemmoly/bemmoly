import type { Readable } from 'node:stream';
import type { UploadedFile, UploadFileQuery, UploadFileType, UploadLink } from '@bemmoly/shared';
import type { RequestContext } from '../services/authz/index.ts';

/** What a person may do with the files of one target: add them, read them, or neither. */
export type FileAccess = 'write' | 'read' | 'deny';

/**
 * Something a module lets people upload files into, such as a page. The kernel stores the
 * bytes and serves them; the module decides who may add and read them, and which stored
 * files its content still refers to. Uploads are named `<kind>` + target id.
 */
export interface FileTargetDefinition {
  /** Namespaced by module: "docs.page". */
  kind: string;
  /**
   * The types it takes, as sniffed from the bytes; images only when left out, so a target
   * takes HTML or PDF only when it can show them safely.
   */
  accepts?: readonly UploadFileType[];
  /** Checked on every upload ('write') and every read ('read' or 'write'); throwing denies. */
  authorize(ctx: RequestContext, targetId: string): Promise<FileAccess>;
  /**
   * The ids, of those given, that any of the module's content still refers to, including
   * history a person can restore. Files nothing refers to are deleted after a grace period.
   */
  referenced(fileIds: readonly string[]): Promise<ReadonlySet<string>>;
}

/** What a stored file is, without its bytes. */
export interface FileInfo {
  name: string;
  /** Sniffed from the bytes when it was uploaded. */
  mime: string;
  size: number;
}

/** What a stored file is and what it was uploaded into. */
export interface FileDetails extends FileInfo {
  target: { kind: string; id: string };
}

/** A stored file's bytes and what they are, as the kernel serves them. */
export interface FileContent extends FileInfo {
  body: Readable;
}

/**
 * Stored files for a person, with the same checks as the files API: reading as GET
 * /api/v1/files/:id does, adding as POST /api/v1/files does (an agent's upload, say).
 */
export interface FileStoreAccess {
  read(ctx: RequestContext, fileId: string): Promise<FileContent>;
  stat(ctx: RequestContext, fileId: string): Promise<FileDetails>;
  upload(ctx: RequestContext, query: UploadFileQuery, body: Buffer): Promise<UploadedFile>;
  /**
   * A single-use link that takes one file's bytes for the target as this person, for a file
   * too large to send through a tool call (ADR 0048); checked like an upload, now and on use.
   */
  createUploadLink(ctx: RequestContext, query: UploadFileQuery): Promise<UploadLink>;
}

/** What a module sees as `ctx.files`; it uploads only into its own targets. */
export interface FilesRegistry extends FileStoreAccess {
  addTarget(definition: FileTargetDefinition): void;
}

/** The id in a stored file's URL, or null for any other source. */
export function fileIdOf(src: string): string | null {
  const match = /^\/api\/v1\/files\/([0-9a-f-]{36})$/i.exec(src);
  return match?.[1] ?? null;
}

/** The path a stored file is read from; content refers to files by it. */
export const fileUrl = (id: string) => `/api/v1/files/${id}`;
