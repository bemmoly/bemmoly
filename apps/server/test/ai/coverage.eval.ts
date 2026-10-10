import { existsSync } from 'node:fs';
import { loadEvalPrompts } from '@bemmoly/core/testing';
import { describe, expect, it } from 'vitest';
import { evalPrompts, recordedVersion, recordingPath } from './harness.ts';
import { EVAL_INDEX } from './index.ts';

/* Every prompt on the boot path has golden checks, and every recording matches its prompt. */

describe('eval coverage', () => {
  it('covers every prompt id the server loads, and lists no prompt that is gone', async () => {
    const loaded = (await loadEvalPrompts(await evalPrompts())).map((prompt) => prompt.id).sort();
    const indexed = EVAL_INDEX.map((entry) => entry.promptId).sort();
    const missing = loaded.filter((id) => !indexed.includes(id));
    const gone = indexed.filter((id) => !loaded.includes(id));
    expect(missing, `add evals for ${missing.join(', ')} (docs/ai-evals.md)`).toEqual([]);
    expect(gone, `remove ${gone.join(', ')} from the eval index`).toEqual([]);
  });

  it('has a recording for every case, made against the prompt version in the repository', async () => {
    const versions = new Map(
      (await loadEvalPrompts(await evalPrompts())).map((prompt) => [prompt.id, prompt.version]),
    );
    for (const entry of EVAL_INDEX) {
      expect(existsSync(new URL(entry.file, import.meta.url)), entry.file).toBe(true);
      expect(entry.checks.length, `${entry.promptId} has no checks`).toBeGreaterThan(0);
      for (const caseId of entry.cases) {
        const recorded = await recordedVersion(caseId);
        expect(recorded, `no recording at ${recordingPath(caseId)}`).not.toBeNull();
        expect(
          recorded,
          `${caseId} was recorded against an older ${entry.promptId}; re-record it`,
        ).toEqual({ id: entry.promptId, version: versions.get(entry.promptId) });
      }
      for (const caseId of entry.silent ?? []) {
        expect(existsSync(recordingPath(caseId)), `${caseId} must not need a recording`).toBe(
          false,
        );
      }
    }
  });
});
