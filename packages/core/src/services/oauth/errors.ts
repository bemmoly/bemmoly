/**
 * An error the token and revocation endpoints must answer in OAuth's own shape
 * (`{ error, error_description }`, RFC 6749 5.2), not the API's error body: clients parse it.
 */
export class OAuthProtocolError extends Error {
  override readonly name = 'OAuthProtocolError';
  readonly error: string;
  readonly status: number;

  constructor(error: string, description: string, status = 400) {
    super(description);
    this.error = error;
    this.status = status;
  }

  toBody() {
    return { error: this.error, error_description: this.message };
  }
}

export const invalidGrant = (description: string) =>
  new OAuthProtocolError('invalid_grant', description);
