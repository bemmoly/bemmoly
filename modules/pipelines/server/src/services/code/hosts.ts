import type { CodeHostClient, CodeHostDirectory, CodeHostRepository } from '@bemmoly/core';
import { createTokenBucket, type HostPriority, type TokenBucket } from './rate.ts';

/*
 * Pipelines' way to the code hosts: the kernel's directory (ADR 0045) behind the
 * per-installation token bucket. Live work (checks, deployments, push handling) asks with
 * priority "live"; discovery and campaigns with "bulk".
 */

export interface PipelinesCodeHosts {
  /** A client for the host covering `repository`, or null when none is connected. */
  client(repository: string, priority: HostPriority): Promise<CodeHostClient | null>;
  /** Every repository the connected hosts let Pipelines read. */
  repositories(): Promise<CodeHostRepository[]>;
}

const METHODS = [
  'reportCheck',
  'reportDeployment',
  'readFile',
  'listFiles',
  'openPullRequest',
] as const;

export function createPipelinesCodeHosts(
  directory: CodeHostDirectory,
  bucket: TokenBucket = createTokenBucket(),
): PipelinesCodeHosts {
  return {
    async client(repository, priority) {
      const client = await directory.clientFor(repository);
      if (!client) return null;
      const metered = { ...client };
      for (const method of METHODS) {
        const call = client[method] as (...args: unknown[]) => Promise<unknown>;
        (metered as Record<string, unknown>)[method] = async (...args: unknown[]) => {
          await bucket.take(client.integrationId, priority);
          return call(...args);
        };
      }
      return metered;
    },
    // A sweep's listing is a page per hundred repositories, a few times an hour: unmetered.
    repositories: () => directory.repositories(),
  };
}
