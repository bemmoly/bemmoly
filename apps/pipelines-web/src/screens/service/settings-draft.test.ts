import { describe, expect, it } from 'vitest';
import { draftOf } from '../application/settings/fields.ts';
import { changesOf } from './settings-draft.ts';

describe('the settings draft', () => {
  it('lists only the settings that differ from what is saved', () => {
    const saved = draftOf({ scaling: { min: 0, max: 10 }, resources: { memory: '512Mi' } });
    const draft = { ...saved, 'scaling.max': '20', 'resources.memory': '1Gi', port: '' };
    expect(changesOf(saved, draft)).toEqual([
      { field: 'scaling.max', from: '10', to: '20' },
      { field: 'resources.memory', from: '512Mi', to: '1Gi' },
    ]);
    expect(changesOf(saved, saved)).toEqual([]);
  });
});
