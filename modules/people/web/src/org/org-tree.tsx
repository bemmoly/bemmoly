import { useT } from '@bemmoly/core-web';
import { IconButton } from '@bemmoly/ui';
import { useState } from 'react';
import type { DirectoryRow } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { HappeningBadge, PersonCell } from '../shared/person.tsx';

/** Who reports to whom among the people listed; anyone whose manager is not listed is a root. */
export function buildTree(people: readonly DirectoryRow[]) {
  const ids = new Set(people.map((person) => person.userId));
  const children = new Map<string, DirectoryRow[]>();
  const roots: DirectoryRow[] = [];
  for (const person of people) {
    if (person.managerId && ids.has(person.managerId)) {
      children.set(person.managerId, [...(children.get(person.managerId) ?? []), person]);
    } else {
      roots.push(person);
    }
  }
  return { roots, children };
}

const INDENT = 20;

function Node({
  person,
  depth,
  tree,
  open,
  toggle,
}: {
  person: DirectoryRow;
  depth: number;
  tree: ReturnType<typeof buildTree>;
  open: ReadonlySet<string>;
  toggle: (id: string) => void;
}) {
  const t = useT(peopleText);
  const reports = tree.children.get(person.userId) ?? [];
  const expanded = open.has(person.userId);
  return (
    <li role="treeitem" aria-expanded={reports.length ? expanded : undefined} aria-selected={false}>
      <div
        className="flex min-h-12 items-center gap-2 border-b border-line-2 py-1.5 pe-3.5"
        style={{ paddingInlineStart: 14 + depth * INDENT }}
      >
        {reports.length > 0 ? (
          <IconButton
            size="xs"
            icon="chevron"
            label={t(expanded ? 'people.org.collapse' : 'people.org.expand', { name: person.name })}
            className={expanded ? 'rotate-90' : ''}
            onClick={() => toggle(person.userId)}
          />
        ) : (
          <span className="size-7 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <PersonCell userId={person.userId} name={person.name} detail={person.jobTitle} />
        </span>
        <HappeningBadge happening={person.happening} />
        {reports.length > 0 ? (
          <span className="shrink-0 text-12 text-tx-3 tabular-nums">
            {t('people.org.reportCount', { count: reports.length })}
          </span>
        ) : null}
      </div>
      {expanded && reports.length > 0 ? (
        <ul role="group" className="m-0 list-none p-0">
          {reports.map((report) => (
            <Node
              key={report.userId}
              person={report}
              depth={depth + 1}
              tree={tree}
              open={open}
              toggle={toggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** The reporting lines as an indented tree; the top two levels start open. */
export function OrgTree({ people, label }: { people: readonly DirectoryRow[]; label: string }) {
  const tree = buildTree(people);
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () =>
      new Set([
        ...tree.roots.map((root) => root.userId),
        ...tree.roots.flatMap((root) =>
          (tree.children.get(root.userId) ?? []).map((p) => p.userId),
        ),
      ]),
  );
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <ul
      role="tree"
      aria-label={label}
      className="m-0 list-none p-0 [&>li:last-child>div]:border-b-0"
    >
      {tree.roots.map((root) => (
        <Node key={root.userId} person={root} depth={0} tree={tree} open={open} toggle={toggle} />
      ))}
    </ul>
  );
}
