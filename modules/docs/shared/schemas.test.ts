import { describe, expect, it } from 'vitest';
import {
  canTransition,
  createPageBodySchema,
  createSpaceBodySchema,
  createTemplateBodySchema,
  getPageQuerySchema,
  movePageBodySchema,
  pageSummarySchema,
  setLabelsBodySchema,
  spaceKeySchema,
  treeQuerySchema,
} from './index.ts';

const id = '0199c0de-0000-7000-8000-000000000001';
const other = '0199c0de-0000-7000-8000-000000000002';
const now = '2026-10-10T09:00:00.000Z';

describe('docs shared schemas', () => {
  it('normalises space keys and rejects other spellings', () => {
    expect(spaceKeySchema.parse(' eng ')).toBe('ENG');
    expect(spaceKeySchema.safeParse('E').success).toBe(false);
    expect(spaceKeySchema.safeParse('1ENG').success).toBe(false);
  });

  it('fills the defaults a create form leaves out', () => {
    expect(createSpaceBodySchema.parse({ key: 'eng', name: 'Engineering' })).toEqual({
      key: 'ENG',
      name: 'Engineering',
      aiExcluded: false,
    });
    expect(createPageBodySchema.parse({ spaceId: id })).toEqual({
      spaceId: id,
      parentId: null,
      title: '',
    });
    expect(
      createTemplateBodySchema.parse({ spaceId: id, name: 'ADR', snapshot: { type: 'doc' } }),
    ).toMatchObject({ fields: [] });
  });

  it('reads query flags as people write them', () => {
    expect(getPageQuerySchema.parse({ deleted: 'false' }).deleted).toBe(false);
    expect(getPageQuerySchema.parse({ deleted: 'true' }).deleted).toBe(true);
    expect(treeQuerySchema.parse({ limit: '10' })).toEqual({ limit: 10 });
  });

  it('refuses a move between a sibling and itself', () => {
    expect(
      movePageBodySchema.safeParse({ parentId: null, afterId: id, beforeId: id }).success,
    ).toBe(false);
    expect(movePageBodySchema.safeParse({ parentId: id, afterId: other }).success).toBe(true);
  });

  it('keeps labels free of commas and trims them', () => {
    expect(setLabelsBodySchema.parse({ labels: [' rfc '] })).toEqual({ labels: ['rfc'] });
    expect(setLabelsBodySchema.safeParse({ labels: ['a,b'] }).success).toBe(false);
  });

  it('lets any status return to draft but not archive straight into review', () => {
    expect(canTransition('published', 'draft')).toBe(true);
    expect(canTransition('archived', 'in_review')).toBe(false);
    expect(canTransition('draft', 'draft')).toBe(true);
  });

  it('parses a page summary as the tree returns it', () => {
    const summary = {
      id,
      spaceId: other,
      spaceKey: 'ENG',
      parentId: null,
      position: 'n',
      depth: 0,
      title: 'Auth migration',
      icon: null,
      status: 'draft',
      ownerId: null,
      hasChildren: false,
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    expect(pageSummarySchema.parse(summary)).toEqual(summary);
    expect(pageSummarySchema.safeParse({ ...summary, position: 'na' }).success).toBe(false);
  });
});
