import { ApiError } from '@bemmoly/api-client';
import { describe, expect, it } from 'vitest';
import { uploadErrorMessage } from './upload-image.ts';

const refused = (
  status: number,
  code: ConstructorParameters<typeof ApiError>[1],
  details?: object,
) => new ApiError(status, code, 'server words', { details });

describe('upload errors', () => {
  it('say what happened and what to do, per reason', () => {
    expect(uploadErrorMessage(refused(413, 'payload_too_large'))).toBe(
      'That image is over 10 MB. Make it smaller and try again.',
    );
    expect(
      uploadErrorMessage(
        refused(400, 'validation_failed', { reason: 'too_large', maxBytes: 5 * 1024 * 1024 }),
      ),
    ).toMatch(/over 5 MB/);
    expect(
      uploadErrorMessage(refused(400, 'validation_failed', { reason: 'svg_refused' })),
    ).toMatch(/SVG images can’t be added/);
    expect(
      uploadErrorMessage(refused(400, 'validation_failed', { reason: 'unsupported_type' })),
    ).toBe('Only PNG, JPEG, GIF and WebP images can be added.');
    expect(uploadErrorMessage(refused(429, 'rate_limited'))).toMatch(/Wait a minute/);
    expect(uploadErrorMessage(refused(403, 'forbidden'))).toMatch(/not add images/);
    expect(uploadErrorMessage(refused(0, 'network_error'))).toMatch(/could not reach/);
    expect(uploadErrorMessage(new Error('boom'))).toBe('The upload did not finish. Try again.');
  });
});
