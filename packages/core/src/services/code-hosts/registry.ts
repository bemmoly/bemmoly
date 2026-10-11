import type { CodeHostKind } from '@bemmoly/shared';
import { githubHost } from './hosts/github.ts';
import { gitlabHost } from './hosts/gitlab.ts';
import type { CodeHostDriver } from './types.ts';

/** One line per code host. */
const HOSTS: Record<CodeHostKind, CodeHostDriver> = {
  github: githubHost,
  gitlab: gitlabHost,
};

export const codeHostDriver = (kind: CodeHostKind): CodeHostDriver => HOSTS[kind];
