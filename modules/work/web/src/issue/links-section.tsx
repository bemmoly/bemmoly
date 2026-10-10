import type { IssueDetail, IssueLinkKind, IssueLinkView } from '@bemmoly/module-work/shared';
import {
  EmptyHint,
  IconButton,
  LinkedIssueRow,
  ListCard,
  ListGroupLabel,
  SectionHeading,
  Select,
  useToast,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { issueKeys } from '../hooks/issue-keys.ts';
import { useIssueSuggestions } from '../hooks/issue-links.ts';
import { workPaths } from '../hooks/issue-navigation.ts';
import type { IssueVocabulary } from '../hooks/issue-vocabulary.ts';
import { api } from '../shared/api.ts';

/** The relations, as "this issue … that issue" reads them. */
export const RELATIONS: ReadonlyArray<{
  value: string;
  label: string;
  kind: IssueLinkKind;
  inverse: boolean;
}> = [
  { value: 'blocks', label: 'blocks', kind: 'blocks', inverse: false },
  { value: 'blocked-by', label: 'is blocked by', kind: 'blocks', inverse: true },
  { value: 'relates', label: 'relates to', kind: 'relates', inverse: false },
  { value: 'duplicates', label: 'duplicates', kind: 'duplicates', inverse: false },
  { value: 'duplicated-by', label: 'is duplicated by', kind: 'duplicates', inverse: true },
];

const relationOf = (link: IssueLinkView) =>
  link.kind === 'relates'
    ? 'relates to'
    : (RELATIONS.find((entry) => entry.kind === link.kind && entry.inverse === link.inverse)
        ?.label ?? link.kind);

/** Adds and removes links; removal shows at once and offers Undo. */
function useLinkEdits(issue: IssueDetail) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const detail = issueKeys.detail(issue.key);
  const refresh = () => queryClient.invalidateQueries({ queryKey: detail });
  const add = useMutation({
    mutationFn: (body: { targetId: string; kind: IssueLinkKind; inverse: boolean }) =>
      api.work.issueLinks.create(issue.key, body),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (link: IssueLinkView) => api.work.issueLinks.remove(link.id),
    onMutate: (link) => {
      const before = queryClient.getQueryData<IssueDetail>(detail);
      if (before) {
        queryClient.setQueryData<IssueDetail>(detail, {
          ...before,
          links: before.links.filter((entry) => entry.id !== link.id),
        });
      }
      return { before };
    },
    onError: (error, link, context) => {
      if (context?.before) queryClient.setQueryData(detail, context.before);
      toast.show({
        tone: 'danger',
        title: `The link to ${link.issue.key} was not removed`,
        body: error.message,
        action: { label: 'Retry', onClick: () => remove.mutate(link) },
      });
    },
    onSuccess: (_result, link) =>
      toast.undo({
        title: `Link to ${link.issue.key} removed`,
        onUndo: () =>
          add.mutate({ targetId: link.issue.id, kind: link.kind, inverse: link.inverse }),
      }),
    onSettled: refresh,
  });
  return { add, remove };
}

export interface LinksSectionProps {
  issue: IssueDetail;
  vocabulary: IssueVocabulary;
  size: 'page' | 'panel';
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}

/** Links, always shown: grouped by relation, each removable, with a picker in place to add. */
export function LinksSection({
  issue,
  vocabulary,
  size,
  adding,
  onAddingChange,
}: LinksSectionProps) {
  const [relation, setRelation] = useState('blocks');
  const { add, remove } = useLinkEdits(issue);
  const suggestions = useIssueSuggestions(issue.key);
  const toast = useToast();
  const groups = [...new Set(issue.links.map(relationOf))];

  const link = (targetId: string) => {
    const chosen = RELATIONS.find((entry) => entry.value === relation);
    if (!targetId || !chosen) return;
    add.mutate(
      { targetId, kind: chosen.kind, inverse: chosen.inverse },
      {
        onSuccess: () => onAddingChange(false),
        onError: (error) =>
          toast.show({ tone: 'danger', title: 'The link was not added', body: error.message }),
      },
    );
  };

  return (
    <section aria-label="Links" className="flex flex-col gap-2">
      <SectionHeading title="Links" size={size} />
      {issue.links.length === 0 && !adding && (
        <EmptyHint>Show what blocks this, or what it relates to.</EmptyHint>
      )}
      <ListCard>
        {groups.map((group) => [
          <ListGroupLabel key={group}>{group}</ListGroupLabel>,
          ...issue.links
            .filter((entry) => relationOf(entry) === group)
            .map((entry) => (
              <LinkedIssueRow
                key={entry.id}
                href={workPaths.issue(entry.issue.key)}
                issueKey={entry.issue.key}
                title={entry.issue.title}
                type={vocabulary.glyph(entry.issue.typeId)}
                status={vocabulary.rowStatus(entry.issue.statusId)}
                actions={
                  <IconButton
                    tip="Remove link"
                    label={`Remove the link to ${entry.issue.key}`}
                    icon={<Icon name="close" size={13} />}
                    size="xs"
                    onClick={() => remove.mutate(entry)}
                  />
                }
              />
            )),
        ])}
        {adding ? (
          <div
            className="flex min-h-9 flex-wrap items-center gap-2 px-2 py-1.5"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !event.defaultPrevented) onAddingChange(false);
            }}
          >
            <Select
              size="sm"
              aria-label="Relation"
              value={relation}
              options={RELATIONS.map(({ value, label }) => ({ value, label }))}
              onChange={(event) => setRelation(event.value)}
            />
            <Select
              size="sm"
              aria-label="Issue to link"
              value=""
              placeholder="Search by key or title"
              searchPlaceholder="PLT-211 or a few words"
              options={[]}
              loadOptions={suggestions}
              onChange={(event) => link(event.value)}
              className="min-w-0 flex-1"
            />
            <IconButton
              keys="Esc"
              label="Cancel"
              icon={<Icon name="close" size={13} />}
              size="xs"
              onClick={() => onAddingChange(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onAddingChange(true)}
            className="flex min-h-9 w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 text-left font-sans text-13 text-tx-3 hover:bg-hover hover:text-tx-2 focus-ring-inset"
          >
            <Icon name="plus" size={14} />
            Add link
          </button>
        )}
      </ListCard>
    </section>
  );
}
