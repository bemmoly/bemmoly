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
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const out = { text: '' };
  const err = { text: '' };
  capture(child.stderr, err);
  const piping: Promise<void>[] = [];
  if (options.stdout) piping.push(pipeline(child.stdout, options.stdout));
  else capture(child.stdout, out);
  if (options.stdin) piping.push(pipeline(options.stdin, child.stdin));
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
