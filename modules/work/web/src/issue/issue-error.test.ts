import { ApiError } from '@bemmoly/api-client';
import { describe, expect, it } from 'vitest';
import { issueErrorCopy } from './issue-error.tsx';

describe('issueErrorCopy', () => {
  it('says the issue is gone, with nothing to retry, on a 404', () => {
    const copy = issueErrorCopy(
      'PLT-9',
      new ApiError(404, 'not_found', 'Issue PLT-9 was not found'),
    );
    expect(copy).toMatchObject({ title: 'PLT-9 is not here', retry: false });
  });

  it('names the missing membership and who can fix it on a 403', () => {
    const copy = issueErrorCopy(
      'PLT-9',
      new ApiError(403, 'forbidden', 'You are not a member of this project'),
    );
    expect(copy.title).toBe('You cannot open PLT-9');
    expect(copy.description).toContain('You are not a member of this project');
    expect(copy.description).toContain('admins');
    expect(copy.retry).toBe(false);
  });

  it('offers Try again when the server fails or does not answer', () => {
    expect(issueErrorCopy('PLT-9', new TypeError('Failed to fetch'))).toMatchObject({
      description: 'The server did not answer. Check the connection and try again.',
      retry: true,
    });
    const failed = issueErrorCopy('PLT-9', new ApiError(500, 'internal_error', 'Something broke.'));
    expect(failed).toMatchObject({ title: 'PLT-9 could not be opened', retry: true });
  });
});
