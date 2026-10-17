import { spawn } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface RunOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Piped to the child's stdin. */
  stdin?: Readable;
  /** Receives stdout; otherwise it is collected and returned. */
  stdout?: Writable;
}

export interface RunResult {
  stdout: string;
  stderr: string;
}

export class ProcessError extends Error {
  override readonly name = 'ProcessError';
  readonly exitCode: number | null;
  readonly stderr: string;
  /** Collected stdout, when it was not piped elsewhere; some tools explain failures there. */
  readonly stdout: string;

  constructor(command: string, exitCode: number | null, stderr: string, stdout = '') {
    const detail = (stderr.trim() || stdout.trim()).slice(-2_000);
    super(`${command} exited with ${exitCode ?? 'a signal'}: ${detail}`);
    this.exitCode = exitCode;
    this.stderr = stderr;
    this.stdout = stdout;
  }
}

const MAX_CAPTURE = 4 * 1024 * 1024;

function capture(stream: Readable | null, into: { text: string }): void {
  stream?.setEncoding('utf8');
  stream?.on('data', (chunk: string) => {
    if (into.text.length < MAX_CAPTURE) into.text += chunk;
  });
}

const CLOSED_STDIN = new Set(['EPIPE', 'ERR_STREAM_PREMATURE_CLOSE', 'ERR_STREAM_DESTROYED']);

/**
 * A program may stop reading stdin before its end and still succeed: tar -x stops at the
 * archive's end-of-archive blocks and exits, so the rest of a record never gets written.
 * Whether that is a failure is the exit status's to say, not the broken pipe's; the source
 * is destroyed by pipeline either way.
 */
function leftEarly(error: unknown): void {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code && CLOSED_STDIN.has(code)) return;
  throw error;
}

/** Runs a binary without a shell, with a hard timeout; rejects with ProcessError on failure. */
export async function runProcess(
  command: string,
  args: readonly string[],
  options: RunOptions,
): Promise<RunResult> {
  const signals = [AbortSignal.timeout(options.timeoutMs)];
  if (options.signal) signals.push(options.signal);
  const child = spawn(command, args, {
    env: options.env ?? {},
    cwd: options.cwd,
    signal: AbortSignal.any(signals),
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const out = { text: '' };
  const err = { text: '' };
  capture(child.stderr, err);
  const piping: Promise<void>[] = [];
  if (options.stdout) piping.push(pipeline(child.stdout, options.stdout));
  else capture(child.stdout, out);
  if (options.stdin) piping.push(pipeline(options.stdin, child.stdin).catch(leftEarly));
  else child.stdin.end();

  const exit = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code));
  });
  // The exit status explains a broken pipe better than the pipe error does.
  const [exited, ...pipes] = await Promise.allSettled([exit, ...piping]);
  if (exited?.status === 'rejected') throw exited.reason;
  const code = exited?.status === 'fulfilled' ? exited.value : null;
  if (code !== 0) throw new ProcessError(command, code, err.text, out.text);
  const broken = pipes.find((result) => result.status === 'rejected');
  if (broken?.status === 'rejected') throw broken.reason;
  return { stdout: out.text, stderr: err.text };
}
