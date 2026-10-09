import type { Workflow } from '../../../shared/index.ts';
import type { EditorDraft } from './draft-model.ts';

/** One line of "Unpublished changes": what publishing this draft would change. */
export interface DraftChange {
  key: string;
  text: string;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What the draft changes against the published version, in words. Node
 * positions are the editor's layout and never published, so moving a status
 * is not a change.
 */
export function draftChanges(published: Workflow, draft: EditorDraft): DraftChange[] {
  const changes: DraftChange[] = [];
  const before = new Map(published.statuses.map((status) => [status.id, status]));
  const names = new Map(draft.statuses.map((status) => [status.id, status.name]));
  for (const status of published.statuses)
    names.set(status.id, names.get(status.id) ?? status.name);
  for (const status of draft.statuses) {
    const old = before.get(status.id);
    if (!old) {
      changes.push({ key: `s+${status.id}`, text: `Adds status "${status.name}"` });
      continue;
    }
    if (old.name !== status.name)
      changes.push({ key: `sn${status.id}`, text: `Renames "${old.name}" to "${status.name}"` });
    if (old.category !== status.category || (old.color ?? undefined) !== status.color)
      changes.push({ key: `sc${status.id}`, text: `Changes how "${status.name}" is shown` });
  }
  const kept = new Set(draft.statuses.map((status) => status.id));
  for (const status of published.statuses)
    if (!kept.has(status.id))
      changes.push({ key: `s-${status.id}`, text: `Removes status "${status.name}"` });

  const transitions = new Map(published.transitions.map((t) => [t.id, t]));
  const ends = (from: string | null, to: string) =>
    `${from === null ? 'Any status' : (names.get(from) ?? '?')} → ${names.get(to) ?? '?'}`;
  for (const transition of draft.transitions) {
    const old = transitions.get(transition.id);
    const label = `"${transition.name}" (${ends(transition.fromStatusId, transition.toStatusId)})`;
    if (!old) {
      changes.push({ key: `t+${transition.id}`, text: `Adds transition ${label}` });
      continue;
    }
    if (old.fromStatusId !== transition.fromStatusId || old.toStatusId !== transition.toStatusId)
      changes.push({ key: `te${transition.id}`, text: `Reconnects ${label}` });
    if (old.name !== transition.name)
      changes.push({ key: `tn${transition.id}`, text: `Renames "${old.name}" to ${label}` });
    if (!same(old.rules, transition.rules))
      changes.push({ key: `tr${transition.id}`, text: `Changes the rules of ${label}` });
  }
  const keptTransitions = new Set(draft.transitions.map((transition) => transition.id));
  for (const transition of published.transitions)
    if (!keptTransitions.has(transition.id))
      changes.push({
        key: `t-${transition.id}`,
        text: `Removes transition "${transition.name}"`,
      });
  return changes;
}
