import { execFileSync } from 'node:child_process';

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const lines = (output: string) => output.split('\n').filter((line) => line.length > 0);

export function releaseTags(): string[] {
  return lines(git('tag', '--list', 'v*'));
}

/** Files added since `from`; every tracked file when there is no previous release. */
export function addedFiles(from: string | undefined): string[] {
  return from
    ? lines(git('diff', '--name-only', '--diff-filter=A', from, 'HEAD'))
    : lines(git('ls-files'));
}

/** A file's content at a ref, or an empty string when it did not exist there. */
export function fileAt(ref: string | undefined, path: string): string {
  if (!ref) return '';
  try {
    return git('show', `${ref}:${path}`);
  } catch {
    return '';
  }
}

export function tagExists(tag: string): boolean {
  const local = lines(git('tag', '--list', tag)).length > 0;
  const remote = lines(git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`)).length > 0;
  return local || remote;
}

/** A local annotated tag; the changesets action pushes it. */
export function createTag(tag: string, message: string): void {
  git('tag', '--annotate', tag, '--message', message);
}
