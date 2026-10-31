import { GcpApiError } from '../../../clients/gcp/index.ts';
import { ApplyStopped } from '../contract.ts';

/*
 * Billing and project quotas. Google publishes no API that reads how many projects a billing
 * account may pay for, so Pipelines counts what is linked and compares it with the usual
 * default. That default and the forms below come from Google's error messages and support
 * answers, not from a documented limit; treat them as unconfirmed until a real account shows
 * otherwise.
 */

/** The usual limit for a new billing account, as Google support answers report it. */
export const USUAL_BILLING_LIMIT = 5;

export const BILLING_QUOTA_FORM = 'https://support.google.com/code/contact/billing_quota_increase';
export const PROJECT_QUOTA_FORM = 'https://support.google.com/code/contact/project_quota_increase';

const text = (error: GcpApiError) => `${error.reason ?? ''} ${error.message}`;

/**
 * "Cloud billing quota exceeded" when linking: the account pays for all it may. Retrying
 * cannot help, so the apply stops with what to ask Google for.
 */
export function billingQuotaStop(error: unknown, billingAccountId: string): ApplyStopped | null {
  if (!(error instanceof GcpApiError) || !/billing quota/i.test(text(error))) return null;
  return new ApplyStopped(
    `Billing account ${billingAccountId} cannot pay for more projects. Ask Google for more at ${BILLING_QUOTA_FORM}, then choose Retry`,
  );
}

/** The creator's own project quota, which Google counts apart from billing. */
export function projectQuotaStop(error: unknown, who: string): ApplyStopped | null {
  if (!(error instanceof GcpApiError)) return null;
  const quota =
    error.status === 429 ||
    error.reason === 'RESOURCE_EXHAUSTED' ||
    /project quota|allotted project/i.test(error.message);
  if (!quota) return null;
  return new ApplyStopped(
    `${who} may not create more projects. Ask Google for more at ${PROJECT_QUOTA_FORM}, then choose Retry`,
  );
}

/** Project IDs are unique across all of Google Cloud; another owner's answers 403 or 409. */
export function takenStop(error: unknown, projectId: string): ApplyStopped | null {
  if (!(error instanceof GcpApiError)) return null;
  if (error.status !== 403 && error.status !== 409) return null;
  return new ApplyStopped(
    `Project ID ${projectId} is taken in Google Cloud or hidden from Bemmoly. Connect Google Cloud again under another name, which gives new project IDs`,
  );
}
