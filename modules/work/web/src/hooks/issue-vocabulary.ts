import type { IssueType, WorkflowStatus } from '@bemmoly/module-work/shared';
import type { IssueType as GlyphType, RowStatus } from '@bemmoly/ui';
import { useCallback } from 'react';
import { statusTone, typeGlyph } from '../issue/vocabulary.ts';
import { useIssueTypes, useStatuses } from './projects-catalog.ts';

/** "PLT-204" → "PLT". */
export const projectKeyOf = (issueKey: string) => issueKey.split('-')[0] ?? '';

export interface IssueVocabulary {
  type: (typeId: string) => IssueType | undefined;
  glyph: (typeId: string) => GlyphType;
  status: (statusId: string) => WorkflowStatus | undefined;
  /** The badge of a row that carries only a status id. */
  rowStatus: (statusId: string) => RowStatus & { done: boolean };
}

/** Names and tones for the type and status ids that rows around an issue carry. */
export function useIssueVocabulary(projectKey: string, projectId: string): IssueVocabulary {
  const types = useIssueTypes(projectKey);
  const statuses = useStatuses(projectId);
  const type = useCallback((typeId: string) => types.byId.get(typeId), [types.byId]);
  const glyph = useCallback((typeId: string) => typeGlyph(types.byId.get(typeId)), [types.byId]);
  const status = useCallback((statusId: string) => statuses.get(statusId), [statuses]);
  const rowStatus = useCallback(
    (statusId: string) => {
      const found = statuses.get(statusId);
      if (!found) return { category: 'todo' as const, label: '…', done: false };
      return {
        category: statusTone(found.category, found.name),
        label: found.name,
        done: found.category === 'done',
      };
    },
    [statuses],
  );
  return { type, glyph, status, rowStatus };
}
