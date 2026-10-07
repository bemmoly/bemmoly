import { describe, expect, it } from 'vitest';
import { apiErrorBodySchema } from '../schemas/api/error.ts';
import { ERROR_REFERENCE_LABEL, toErrorSurface } from './surface.ts';

describe('error surface contract', () => {
  it('requires a request id on every API error body', () => {
    expect(apiErrorBodySchema.safeParse({ code: 'not_found', message: 'Gone' }).success).toBe(
      false,
    );
  });

  it('shows the request id as the reference and puts both on the clipboard', () => {
    const surface = toErrorSurface({
      code: 'internal_error',
      message: 'Something went wrong on our side.',
      requestId: '0199b1a2-7c3d-7e4f-8a5b-6c7d8e9f0a1b',
    });
    expect(surface.reference).toBe('0199b1a2-7c3d-7e4f-8a5b-6c7d8e9f0a1b');
    expect(surface.copyText).toBe(
      `Something went wrong on our side. (${ERROR_REFERENCE_LABEL}: 0199b1a2-7c3d-7e4f-8a5b-6c7d8e9f0a1b)`,
    );
  });
});
