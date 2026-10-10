import { useEntityRenderer } from '@bemmoly/core-web';
import type { DocServices, IssueTableAttrs } from '@bemmoly/editor';
import { useMemo } from 'react';

/** The editor's issue services; spread them into the page's DocServices. */
export type IssueServices = Pick<DocServices, 'renderIssue' | 'renderIssueTable' | 'searchIssues'>;

/**
 * Live issues in a page, lent by whichever enabled module owns the "issue"
 * kind (Work) through the kernel's web entity registry, so Docs never imports
 * it. With no owner (Work off, or not open to this person) every field is
 * absent and the editor keeps its quiet placeholders: the key as a chip, the
 * query on a card, an empty `#` menu. The functions keep their identity
 * while the owner does, so the editor does not re-render for nothing.
 */
export function useIssueServices(): IssueServices {
  const renderer = useEntityRenderer('issue');
  return useMemo<IssueServices>(() => {
    if (!renderer) return {};
    const { Chip, Table, search } = renderer;
    return {
      ...(Chip ? { renderIssue: (key: string) => <Chip entityKey={key} /> } : {}),
      ...(Table
        ? {
            renderIssueTable: (attrs: IssueTableAttrs) => (
              <Table query={attrs.query} title={attrs.title} />
            ),
          }
        : {}),
      ...(search
        ? {
            searchIssues: async (query: string, signal: AbortSignal) =>
              query.trim() ? search(query.trim(), signal) : [],
          }
        : {}),
    };
  }, [renderer]);
}

/** The "issue" renderer itself, for screens that draw issue cards outside the editor. */
export const useIssueRenderer = () => useEntityRenderer('issue');
