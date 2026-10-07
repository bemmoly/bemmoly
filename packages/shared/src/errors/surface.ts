import type { ApiErrorBody } from '../schemas/api/error.ts';

/**
 * The error surface contract.
 *
 * 1. Every error response from the API carries `requestId` in its body and the same
 *    value in the `x-request-id` header. The server's one error handler guarantees it,
 *    whatever was thrown.
 * 2. Every place the web app shows an error to a person (toast, inline banner, failed
 *    page) shows that id beside the message, labelled "Reference", with a copy action.
 * 3. Unexpected failures are logged on the server with the same id, so a bug report
 *    that quotes the reference leads straight to the log line.
 *
 * The web app renders errors through `toErrorSurface`, never from the raw body.
 */
export const REQUEST_ID_HEADER = 'x-request-id';

export const ERROR_REFERENCE_LABEL = 'Reference';

export interface ErrorSurface {
  code: ApiErrorBody['code'];
  message: string;
  /** The request id, shown as "Reference: <id>". */
  reference: string;
  /** What the copy action puts on the clipboard: message and reference together. */
  copyText: string;
}

export function toErrorSurface(body: ApiErrorBody): ErrorSurface {
  return {
    code: body.code,
    message: body.message,
    reference: body.requestId,
    copyText: `${body.message} (${ERROR_REFERENCE_LABEL}: ${body.requestId})`,
  };
}
