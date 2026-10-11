import type { SchemeKind, SchemeUsage } from '@bemmoly/module-work/shared';
import { Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useSchemeUsage } from '../hooks/settings-schemes.ts';

const projects = (count: number) => `${count} ${count === 1 ? 'project' : 'projects'}`;

/** The keys of the projects with their own version, named when there are few enough to read. */
function named(usage: SchemeUsage): string {
  const keys = usage.overriders.map((project) => project.key);
  return keys.length <= 3 ? ` (${keys.join(', ')})` : '';
}

/** "Used by 12 projects; 2 have their own version (PLT, OPS) and keep it." */
export function usageSentence(usage: SchemeUsage): string {
  const own = usage.overriders.length;
  const following = usage.projects - own;
  if (usage.projects === 0) return 'No projects yet. New projects start from this default.';
  if (own === 0) {
    return `Used by ${projects(usage.projects)}. None has its own version, so changes here reach all of them.`;
  }
  const have = own === 1 ? '1 has its own version' : `${own} have their own version`;
  const reach =
    following === 0
      ? 'Changes here reach new projects only.'
      : `Changes here reach the other ${following === 1 ? 'one' : following}.`;
  return `Used by ${projects(usage.projects)}; ${have}${named(usage)} and ${own === 1 ? 'keeps it' : 'keep them'}. ${reach}`;
}

/**
 * Who an org default reaches, in one line on the accent wash where a project's settings say
 * what they are based on: how many projects follow it, and which run their own version.
 */
export function OrgDefaultNote({ kind, enabled }: { kind: SchemeKind; enabled: boolean }) {
  const usage = useSchemeUsage(kind, enabled);
  if (!enabled) return null;
  return (
    <div
      className="flex min-h-9.5 items-center gap-2 rounded-card bg-acc-50 px-3 py-2.25 text-13 text-tx-2"
      aria-busy={usage.isPending || undefined}
      data-testid="org-default-usage"
    >
      <Icon name="layers" size={15} className="shrink-0 text-acc" />
      {usage.item ? (
        <span className="min-w-0 tabular-nums">{usageSentence(usage.item)}</span>
      ) : usage.isError ? (
        <span className="min-w-0">
          Couldn&apos;t count the projects using this default.{' '}
          <button
            type="button"
            className="rounded-chip font-semibold text-acc hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc"
            onClick={() => void usage.refetch()}
          >
            Try again
          </button>
        </span>
      ) : (
        <Skeleton width="60%" />
      )}
    </div>
  );
}
