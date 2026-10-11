import { uploadedFileSchema, uploadFileQuerySchema } from '@bemmoly/shared';
import type { Http } from '../http.ts';
import type { UploadProgressOptions } from '../xhr-upload.ts';
import { validated } from './validate.ts';

/** Files people add to a module's content (images in a page). */
export function filesEndpoints(http: Http) {
  return {
    files: {
      /** Stores one image for the target; the answer's url is what content keeps. */
      upload: async (
        file: Blob,
        target: { target: string; targetId: string; name?: string },
        progress?: UploadProgressOptions,
      ) =>
        http.upload(
          '/api/v1/files',
          uploadedFileSchema,
          file,
          validated(uploadFileQuerySchema, target),
          progress,
        ),
    },
  };
}
