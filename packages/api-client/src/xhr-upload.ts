import { ApiError, errorFromResponse } from './errors.ts';

export interface UploadProgressOptions {
  /** How much of the body has gone, 0..1, or null while the browser cannot tell. */
  onProgress?: (fraction: number | null) => void;
  signal?: AbortSignal;
}

const parse = (text: string): unknown => {
  try {
    return text ? (JSON.parse(text) as unknown) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * A raw-body POST that reports upload progress, which fetch cannot. Same origin, the session
 * cookie, and errors normalised to ApiError exactly as the fetch path does.
 */
export function xhrUpload(
  url: string,
  file: Blob,
  options: UploadProgressOptions,
  onUnauthenticated?: (error: ApiError) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('accept', 'application/json');
    xhr.setRequestHeader('content-type', 'application/octet-stream');
    xhr.upload.onprogress = (event) =>
      options.onProgress?.(event.lengthComputable ? event.loaded / event.total : null);
    xhr.onload = () => {
      const body = parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(1);
        resolve(body);
        return;
      }
      const error = errorFromResponse(
        new Response(null, {
          status: xhr.status,
          headers: { 'x-request-id': xhr.getResponseHeader('x-request-id') ?? '' },
        }),
        body,
      );
      if (error.status === 401) onUnauthenticated?.(error);
      reject(error);
    };
    xhr.onerror = () =>
      reject(new ApiError(0, 'network_error', 'Bemmoly could not reach the server.'));
    xhr.onabort = () => reject(new DOMException('The upload was cancelled', 'AbortError'));
    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}
