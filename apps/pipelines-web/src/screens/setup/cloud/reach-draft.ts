import { cloudReachSchema, type CloudReach } from '@bemmoly/module-pipelines/shared';

/* What the person typed for "What Bemmoly can reach", read into a reach or a reason it is not one. */

export type ReachKind = 'folder' | 'projects';

export interface ReachDraft {
  kind: ReachKind | null;
  folder: string;
  projects: string;
}

export const EMPTY_REACH: ReachDraft = { kind: null, folder: '', projects: '' };

export const projectsOf = (text: string) =>
  text
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

export type ReachRead =
  | { ok: true; reach: CloudReach }
  | { ok: false; problem: 'empty' | 'folder' | { project: string } };

export function readReach(draft: ReachDraft): ReachRead {
  if (draft.kind === 'folder') {
    if (!draft.folder.trim()) return { ok: false, problem: 'empty' };
    const parsed = cloudReachSchema.safeParse({ kind: 'folder', parent: draft.folder.trim() });
    return parsed.success ? { ok: true, reach: parsed.data } : { ok: false, problem: 'folder' };
  }
  if (draft.kind === 'projects') {
    const projects = projectsOf(draft.projects);
    if (projects.length === 0) return { ok: false, problem: 'empty' };
    const parsed = cloudReachSchema.safeParse({ kind: 'projects', projects });
    if (parsed.success) return { ok: true, reach: parsed.data };
    const bad = projects.find(
      (project) => !cloudReachSchema.safeParse({ kind: 'projects', projects: [project] }).success,
    );
    return { ok: false, problem: { project: bad ?? projects[0] ?? '' } };
  }
  return { ok: false, problem: 'empty' };
}
