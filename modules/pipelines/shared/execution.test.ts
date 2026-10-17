import { describe, expect, it } from 'vitest';
import {
  matrixSpecSchema,
  pipelineDefinitionSchema,
  scheduleSpecSchema,
  templateInputSchema,
} from './pipeline-spec.ts';
import { createRunBodySchema } from './runs.ts';
import { logChunkUploadSchema } from './runner.ts';

describe('execution contracts', () => {
  it('reads a matrix with include and exclude, and refuses one past 64 jobs', () => {
    const matrix = matrixSpecSchema.parse({ axes: { node: [22, 24] }, include: [{ node: 25 }] });
    expect(matrix.exclude).toEqual([]);
    const big = { axes: { a: [1, 2, 3, 4, 5, 6, 7, 8, 9], b: [1, 2, 3, 4, 5, 6, 7, 8] } };
    expect(matrixSpecSchema.safeParse(big).success).toBe(false);
  });

  it('reads a cron schedule in a time zone and refuses a zone that does not exist', () => {
    expect(scheduleSpecSchema.parse({ cron: '0 3 * * 1-5', timeZone: 'Asia/Kolkata' })).toEqual({
      cron: '0 3 * * 1-5',
      timeZone: 'Asia/Kolkata',
      inputs: {},
    });
    expect(scheduleSpecSchema.parse({ cron: '*/15 * * * *' }).timeZone).toBe('UTC');
    expect(scheduleSpecSchema.safeParse({ cron: '0 3 * * *', timeZone: 'Mars/Base' }).success).toBe(
      false,
    );
    expect(scheduleSpecSchema.safeParse({ cron: '0 3 * *' }).success).toBe(false);
  });

  it('asks a choice input for its options', () => {
    expect(templateInputSchema.safeParse({ type: 'choice' }).success).toBe(false);
    expect(templateInputSchema.parse({ type: 'choice', options: ['eu', 'asia'] }).required).toBe(
      false,
    );
  });

  it('keeps a written pipeline’s inputs and schedules', () => {
    const definition = pipelineDefinitionSchema.parse({
      inputs: { suite: { type: 'choice', options: ['smoke', 'full'], default: 'smoke' } },
      test: [{ name: 'Unit', image: 'node:24', run: 'pnpm test', matrix: { axes: { n: [1] } } }],
      schedules: [{ cron: '0 2 * * *' }],
    });
    expect('extends' in definition).toBe(false);
    expect(definition).toMatchObject({ checkout: true, inputs: { suite: { type: 'choice' } } });
  });

  it('takes run inputs beside variables', () => {
    expect(createRunBodySchema.parse({ application: 'checkout-api', inputs: { n: 2 } })).toEqual({
      application: 'checkout-api',
      ref: 'main',
      variables: {},
      inputs: { n: 2 },
    });
  });

  it('takes a log chunk as lines or as gzip, never both', () => {
    expect(logChunkUploadSchema.safeParse({ seq: 0, firstLine: 1, lineCount: 0 }).success).toBe(
      false,
    );
    expect(
      logChunkUploadSchema.safeParse({ seq: 0, firstLine: 1, lineCount: 1, lines: ['x'] }).success,
    ).toBe(true);
  });
});
