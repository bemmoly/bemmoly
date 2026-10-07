import { ProviderError } from '@bemmoly/shared';
import type { AddressInfo } from 'node:net';
import { SMTPServer } from 'smtp-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { silentLogger } from '../../../testing/fakes.ts';
import { createMemoryMailbox } from '../mailbox.ts';
import { createSender } from './base.ts';
import { failureOf } from './failure.ts';
import { createLogSender } from './log.ts';
import { createSmtpSender } from './smtp.ts';
import { describeSmtpFailure } from './smtp-failures.ts';

const message = {
  to: [{ address: 'rohan@acme.test', name: 'Rohan' }],
  subject: 'Hello',
  html: '<p>Hello</p>',
  text: 'Hello',
  headers: { 'List-Unsubscribe': '<https://bemmoly.example.com/u>' },
  idempotencyKey: '0199c3a2-1111-7000-8000-000000000001',
};

describe('createSender', () => {
  const failure = { stage: 'connect' as const, message: 'down', serverResponse: null };

  it('retries a transient failure once, then succeeds', async () => {
    let calls = 0;
    const sender = createSender(
      {
        id: 'fake',
        check: async () => undefined,
        deliver: async () => {
          calls += 1;
          if (calls === 1) throw new Error('flaky');
          return { messageId: 'm1', accepted: ['rohan@acme.test'], rejected: [] };
        },
        describe: () => ({ ...failure, transient: true }),
      },
      { timeoutMs: 1_000, retries: 1, retryDelayMs: 1 },
    );
    await expect(sender.send(message)).resolves.toMatchObject({ messageId: 'm1' });
    expect(calls).toBe(2);
  });

  it('does not retry a permanent failure and throws a ProviderError in plain words', async () => {
    let calls = 0;
    const sender = createSender(
      {
        id: 'fake',
        check: async () => undefined,
        deliver: async () => {
          calls += 1;
          throw new Error('nope');
        },
        describe: () => ({
          ...failure,
          stage: 'auth',
          message: 'Wrong password.',
          transient: false,
        }),
      },
      { timeoutMs: 1_000, retries: 3, retryDelayMs: 1 },
    );
    const error = await sender.send(message).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProviderError);
    expect(failureOf(error)).toMatchObject({
      stage: 'auth',
      message: 'Wrong password.',
      transient: false,
    });
    expect(calls).toBe(1);
  });

  it('turns a call that outlives its budget into a timeout failure', async () => {
    const sender = createSender(
      {
        id: 'fake',
        check: async () => undefined,
        deliver: (_message, signal) =>
          new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
        describe: () => ({ ...failure, transient: true }),
      },
      { timeoutMs: 50, retries: 2, retryDelayMs: 1 },
    );
    const error = await sender.send(message).catch((caught: unknown) => caught);
    expect(failureOf(error).message).toMatch(/did not answer within 0.05 seconds/);
  });
});

describe('describeSmtpFailure', () => {
  const ctx = { host: 'smtp.acme.test', port: 587, from: 'bemmoly@acme.test' };
  const smtpError = (fields: Record<string, unknown>) => Object.assign(new Error('x'), fields);

  it.each([
    [
      { code: 'EAUTH', responseCode: 535, response: '535 5.7.8 bad creds' },
      'auth',
      /username or password/,
      false,
    ],
    [{ code: 'ECONNECTION' }, 'connect', /Could not connect to smtp\.acme\.test:587/, true],
    [{ code: 'ETIMEDOUT' }, 'connect', /did not answer in time/, true],
    [{ code: 'ETLS', message: 'self-signed certificate' }, 'tls', /self-signed/, false],
    [
      { code: 'EENVELOPE', command: 'MAIL FROM', responseCode: 553 },
      'send',
      /sender address bemmoly@acme\.test/,
      false,
    ],
    [
      { code: 'EENVELOPE', command: 'RCPT TO', responseCode: 450 },
      'send',
      /recipient address/,
      true,
    ],
    [
      { code: 'EMESSAGE', responseCode: 552, response: '552 too big' },
      'send',
      /refused the message: 552 too big/,
      false,
    ],
  ])('maps %o to the %s stage', (fields, stage, message, transient) => {
    const failure = describeSmtpFailure(smtpError(fields), ctx);
    expect(failure.stage).toBe(stage);
    expect(failure.message).toMatch(message);
    expect(failure.transient).toBe(transient);
  });
});

describe('log sender', () => {
  it('captures the message for the dev mailbox instead of sending it', async () => {
    const mailbox = createMemoryMailbox(2);
    const sender = createLogSender({
      from: { address: 'bemmoly@acme.test', name: 'Acme Labs' },
      logger: silentLogger,
      mailbox,
    });
    const result = await sender.send(message);
    const [entry] = mailbox.list();
    expect(entry).toMatchObject({
      id: result.messageId,
      to: ['"Rohan" <rohan@acme.test>'],
      from: '"Acme Labs" <bemmoly@acme.test>',
      subject: 'Hello',
      headers: message.headers,
    });
    await sender.send(message);
    await sender.send(message);
    expect(mailbox.list()).toHaveLength(2);
  });
});

describe('smtp sender against a local SMTP server', () => {
  const received: { from: string; to: string[]; data: string }[] = [];
  let server: SMTPServer;
  let port = 0;

  beforeAll(async () => {
    server = new SMTPServer({
      secure: false,
      disabledCommands: ['STARTTLS'],
      allowInsecureAuth: true,
      onAuth(auth, _session, callback) {
        if (auth.username === 'mailer' && auth.password === 'right')
          callback(null, { user: 'mailer' });
        else callback(new Error('Invalid username or password'));
      },
      onData(stream, session, callback) {
        let data = '';
        stream.on('data', (chunk: Buffer) => (data += chunk.toString()));
        stream.on('end', () => {
          received.push({
            from: session.envelope.mailFrom ? session.envelope.mailFrom.address : '',
            to: session.envelope.rcptTo.map((rcpt) => rcpt.address),
            data,
          });
          callback();
        });
      },
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const senderWith = (password: string, allowPrivateHosts = true) =>
    createSmtpSender({
      smtp: { host: '127.0.0.1', port, security: 'none', username: 'mailer', password },
      from: { address: 'bemmoly@acme.test', name: 'Acme Labs' },
      replyTo: { address: 'help@acme.test' },
      allowPrivateHosts,
      policy: { timeoutMs: 5_000, retries: 0, retryDelayMs: 1 },
    });

  it('delivers with both parts, the headers and a stable Message-ID', async () => {
    const result = await senderWith('right').send(message);
    expect(result.accepted).toEqual(['rohan@acme.test']);
    const [mail] = received;
    expect(mail?.from).toBe('bemmoly@acme.test');
    expect(mail?.data).toContain('List-Unsubscribe: <https://bemmoly.example.com/u>');
    expect(mail?.data).toContain('Reply-To: help@acme.test');
    expect(mail?.data).toContain(`Message-ID: <${message.idempotencyKey}@acme.test>`);
    expect(mail?.data).toMatch(/text\/plain[\s\S]*text\/html/);
  });

  it('reports rejected credentials in plain words', async () => {
    const error = await senderWith('wrong')
      .verify()
      .catch((caught: unknown) => caught);
    expect(failureOf(error)).toMatchObject({
      stage: 'auth',
      message: 'The mail server rejected the username or password.',
    });
  });

  it('refuses a private SMTP host unless private targets are allowed', async () => {
    const error = await senderWith('right', false)
      .verify()
      .catch((caught: unknown) => caught);
    expect(failureOf(error)).toMatchObject({ stage: 'dns', transient: false });
    expect(failureOf(error).message).toMatch(/BEMMOLY_ALLOW_PRIVATE_URLS/);
  });

  it('reports a closed port as a connection failure', async () => {
    const sender = createSmtpSender({
      smtp: { host: '127.0.0.1', port: 1, security: 'none', username: '', password: '' },
      from: { address: 'bemmoly@acme.test' },
      replyTo: null,
      allowPrivateHosts: true,
      policy: { timeoutMs: 5_000, retries: 0, retryDelayMs: 1 },
    });
    const error = await sender.verify().catch((caught: unknown) => caught);
    expect(failureOf(error)).toMatchObject({ stage: 'connect', transient: true });
  });
});
