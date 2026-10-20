import type { Readable } from 'node:stream';
import type { UploadFileType } from '@bemmoly/shared';
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

/** A stored file's bytes and what they are, as the kernel serves them. */
export interface FileContent {
  name: string;
  /** Sniffed from the bytes when it was uploaded. */
  mime: string;
  size: number;
  body: Readable;
}

/** Reads a stored file for a person, with the same checks as GET /api/v1/files/:id. */
export interface FileReader {
  read(ctx: RequestContext, fileId: string): Promise<FileContent>;
}

/** What a module sees as `ctx.files`. */
export interface FilesRegistry extends FileReader {
  addTarget(definition: FileTargetDefinition): void;
}

/** The id in a stored file's URL, or null for any other source. */
export function fileIdOf(src: string): string | null {
  const match = /^\/api\/v1\/files\/([0-9a-f-]{36})$/i.exec(src);
  return match?.[1] ?? null;
}

/** The path a stored file is read from; content refers to files by it. */
export const fileUrl = (id: string) => `/api/v1/files/${id}`;
