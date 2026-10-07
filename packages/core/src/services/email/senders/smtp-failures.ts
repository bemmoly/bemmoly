import { HostLookupError, PrivateAddressError } from '../../../clients/network.ts';
import { smtpFailureDetails } from '../../../clients/smtp.ts';
import type { EmailFailure } from './failure.ts';

export interface SmtpContext {
  host: string;
  port: number;
  from: string;
}

const CERTIFICATE_PROBLEMS: ReadonlyArray<[RegExp, string]> = [
  [/self[- ]signed/i, "the server's certificate is self-signed and not trusted"],
  [/expired/i, "the server's certificate has expired"],
  [/altnames|hostname|does not match/i, "the server's certificate is for a different host name"],
  [
    /wrong version number|unknown protocol|packet length/i,
    'the server did not speak TLS on this port',
  ],
];

function certificateProblem(message: string): string | undefined {
  return CERTIFICATE_PROBLEMS.find(([pattern]) => pattern.test(message))?.[1];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Turns a failed SMTP conversation into one sentence an admin can act on, with
 * the server's own reply kept alongside. 4xx replies and network trouble are
 * transient; a 5xx reply to the message or its addresses is not.
 */
export function describeSmtpFailure(error: unknown, ctx: SmtpContext): EmailFailure {
  const where = `${ctx.host}:${ctx.port}`;
  if (error instanceof PrivateAddressError) {
    return { stage: 'dns', message: `${error.message}.`, serverResponse: null, transient: false };
  }
  if (error instanceof HostLookupError) {
    return {
      stage: 'dns',
      message: `The host name ${ctx.host} could not be found. Check the spelling of the SMTP host.`,
      serverResponse: null,
      transient: true,
    };
  }
  const { code, command, responseCode, response } = smtpFailureDetails(error);
  const serverResponse = response ?? null;
  const temporary = responseCode !== undefined && responseCode >= 400 && responseCode < 500;
  const text = errorMessage(error);
  const tlsProblem = certificateProblem(text);

  if (code === 'EAUTH') {
    return {
      stage: 'auth',
      message: 'The mail server rejected the username or password.',
      serverResponse,
      transient: temporary,
    };
  }
  if (code === 'ENOAUTH') {
    return {
      stage: 'auth',
      message: 'The mail server asks for a username and password, and none is set.',
      serverResponse,
      transient: false,
    };
  }
  if (code === 'ETLS' || code === 'EREQUIRETLS' || tlsProblem) {
    return {
      stage: 'tls',
      message: `The secure connection to ${where} failed: ${tlsProblem ?? 'the TLS handshake did not complete'}. Port 465 usually needs TLS and port 587 STARTTLS.`,
      serverResponse,
      transient: false,
    };
  }
  if (code === 'EDNS') {
    return {
      stage: 'dns',
      message: `The host name ${ctx.host} could not be found. Check the spelling of the SMTP host.`,
      serverResponse,
      transient: true,
    };
  }
  if (code === 'ETIMEDOUT') {
    return {
      stage: 'connect',
      message: `${where} did not answer in time. Check the host and port, and that a firewall allows outgoing connections to it.`,
      serverResponse,
      transient: true,
    };
  }
  if (
    code === 'ECONNECTION' ||
    code === 'ESOCKET' ||
    /ECONNREFUSED|ECONNRESET|EHOSTUNREACH/.test(text)
  ) {
    return {
      stage: 'connect',
      message: `Could not connect to ${where}. Check the host and port, and that a firewall allows outgoing connections to it.`,
      serverResponse,
      transient: true,
    };
  }
  if (code === 'EENVELOPE') {
    const sender = command?.toUpperCase().startsWith('MAIL');
    return {
      stage: 'send',
      message: sender
        ? `The mail server refused the sender address ${ctx.from}. Use an address this account may send as.`
        : 'The mail server refused the recipient address.',
      serverResponse,
      transient: temporary,
    };
  }
  return {
    stage: 'send',
    message: serverResponse
      ? `The mail server refused the message: ${serverResponse}`
      : `The mail server reported an error: ${text}`,
    serverResponse,
    transient: temporary || responseCode === undefined,
  };
}
