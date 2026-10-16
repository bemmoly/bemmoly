import { describe, expect, it } from 'vitest';
import { applicationFileSchema } from './application-yaml.ts';
import { listApplicationsQuerySchema } from './catalog.ts';
import { templateRefSchema } from './pipeline-spec.ts';
import { parseTopic, streamsQuerySchema, topicOf } from './streams.ts';

const RUN = '0199f0a2-7c3e-7d4a-9b1e-2f3a4b5c6d7e';

describe('templateRefSchema', () => {
  it('reads a template reference into its ref and version', () => {
    expect(templateRefSchema.parse('acme/node-service@3')).toEqual({
      ref: 'acme/node-service',
      version: 3,
    });
  });

  it('refuses references without a version or an owner', () => {
    expect(templateRefSchema.safeParse('acme/node-service').success).toBe(false);
    expect(templateRefSchema.safeParse('node-service@3').success).toBe(false);
    expect(templateRefSchema.safeParse('acme/node-service@0').success).toBe(false);
  });
});

describe('stream topics', () => {
  it('parses every kind of topic', () => {
    expect(parseTopic('live')).toEqual({ kind: 'live' });
    expect(parseTopic('for-you')).toEqual({ kind: 'for-you' });
    expect(parseTopic('map:')).toEqual({ kind: 'map', scope: '' });
    expect(parseTopic('map:commerce/checkout')).toEqual({
      kind: 'map',
      scope: 'commerce/checkout',
    });
    expect(parseTopic(`run:${RUN}`)).toEqual({ kind: 'run', runId: RUN });
    expect(parseTopic(`job:${RUN}:log`)).toEqual({ kind: 'job-log', jobId: RUN });
    expect(parseTopic('application:checkout-api')).toEqual({
      kind: 'application',
      key: 'checkout-api',
    });
  });

  it('refuses topics outside the grammar', () => {
    expect(parseTopic('run:not-a-uuid')).toBeNull();
    expect(parseTopic('map:Commerce')).toBeNull();
    expect(parseTopic('everything')).toBeNull();
  });

  it('builds topics the parser reads back', () => {
    expect(parseTopic(topicOf.jobLog(RUN))).toEqual({ kind: 'job-log', jobId: RUN });
    expect(parseTopic(topicOf.map('commerce'))).toEqual({ kind: 'map', scope: 'commerce' });
  });

  it('reads a comma-separated topics query, without duplicates', () => {
    expect(streamsQuerySchema.parse({ topics: 'live, map:commerce,live' }).topics).toEqual([
      'live',
      'map:commerce',
    ]);
    expect(streamsQuerySchema.safeParse({ topics: 'live,nope' }).success).toBe(false);
  });
});

describe('application.yaml', () => {
  it('reads the example from the architecture, in Group and Application words', () => {
    const file = applicationFileSchema.parse({
      name: 'checkout-api',
      group: 'checkout',
      owner: 'team/payments',
      tier: 0,
      labels: ['node', 'pci'],
      pipeline: {
        extends: 'acme/node-service@3',
        with: { port: 8081 },
        deploy: {
          resources: { cpu: 1, memory: '512Mi' },
          secrets: { DATABASE_URL: 'checkout-db-url' },
        },
      },
    });
    expect(file.tier).toBe(0);
    expect(file.lifecycle).toBe('production');
    expect(file.pipeline && 'extends' in file.pipeline ? file.pipeline.extends : null).toEqual({
      ref: 'acme/node-service',
      version: 3,
    });
  });

  it('refuses an owner that is not a team', () => {
    expect(
      applicationFileSchema.safeParse({ name: 'a', group: 'b', owner: 'payments' }).success,
    ).toBe(false);
  });
});

describe('listApplicationsQuerySchema', () => {
  it('reads comma-separated facets from a query string', () => {
    const query = listApplicationsQuerySchema.parse({
      tier: '0,1',
      domain: 'commerce,platform',
      runtime: 'kubernetes',
      mine: 'true',
    });
    expect(query.tier).toEqual([0, 1]);
    expect(query.domain).toEqual(['commerce', 'platform']);
    expect(query.runtime).toEqual(['kubernetes']);
    expect(query.mine).toBe(true);
    expect(query.sort).toBe('name');
    expect(query.limit).toBe(50);
  });

  it('refuses a tier outside 0 to 2', () => {
    expect(listApplicationsQuerySchema.safeParse({ tier: '3' }).success).toBe(false);
  });
});
