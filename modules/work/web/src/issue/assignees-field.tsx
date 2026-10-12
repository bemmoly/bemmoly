import type { IssueDetail } from '@bemmoly/module-work/shared';
import { Avatar, IconButton, useToast } from '@bemmoly/ui';
import { usePeople, useViewer } from '../hooks/issue-people.ts';
import { PersonField } from './field-editors.tsx';
import { useAssignees } from './use-assignees.ts';

/** 24px tall for WCAG 2.5.8, the extra given back to the row so it does not grow. */
const ASSIGN_ME =
  '-my-0.5 inline-flex min-h-6 cursor-pointer items-center rounded-chip border-0 bg-transparent px-1 font-sans text-12 text-tx-3 hover:text-acc focus-ring';

/**
 * The Assignee row: everyone on the issue, the primary first, each removable, and a person
 * picker that adds one more. Removing someone offers Undo, as removing a label does.
 */
export function AssigneesField({ issue }: { issue: IssueDetail }) {
  const { set } = useAssignees(issue.key);
  const { person } = usePeople();
  const viewer = useViewer();
  const toast = useToast();
  const current = issue.assignees.length ? issue.assignees : issue.assignee ? [issue.assignee] : [];
  const taken = new Set(current.map((user) => user.id));

  const add = (id: string, name?: string) => {
    if (taken.has(id)) return;
    const found = person(id);
    set([...current, { id, name: name ?? found.name, email: found.email }]);
  };
  const remove = (id: string, name: string) => {
    set(current.filter((user) => user.id !== id));
    toast.undo({ title: `${name} unassigned`, onUndo: () => set(current) });
  };

  return (
    <>
      {current.map((user) => (
        <span key={user.id} className="inline-flex min-h-6 items-center gap-1.5 text-13 text-tx">
          <Avatar name={user.name} size={20} />
          {user.name}
          <IconButton
            icon="close"
            size="sm"
            label={`Unassign ${user.name}`}
            onClick={() => remove(user.id, user.name)}
          />
        </span>
      ))}
      <PersonField
        label={current.length ? 'Add another assignee' : 'Assignee'}
        value={null}
        placeholder={current.length ? 'Add' : 'Add assignee'}
        onSave={(id) => id && add(id)}
      />
      {viewer && !taken.has(viewer.id) && (
        <button type="button" className={ASSIGN_ME} onClick={() => add(viewer.id, viewer.name)}>
          Assign to me
        </button>
      )}
    </>
  );
}
