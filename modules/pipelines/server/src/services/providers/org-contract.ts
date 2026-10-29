/*
 * What the org part answers beside its methods: a billing account's headroom, and the error that
 * stops a landing-zone apply where retrying cannot help yet.
 */

export interface BillingHeadroom {
  account: string;
  linked: number;
  limit: number;
  /** True when an admin recorded the limit on the connection. */
  recorded: boolean;
}

/**
 * Thrown by a provider when going on cannot help, such as a billing account out of projects:
 * the apply stops there, says `message`, and a retry starts where it stopped.
 */
export class ApplyStopped extends Error {
  override readonly name = 'ApplyStopped';
}
