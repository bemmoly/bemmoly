import { usePreference, writePreference, readPreference } from '@bemmoly/core-web';

/*
 * Which project the Work screens show when the address names none, kept per person (on this
 * device) so the sidebar's Board and Backlog always carry a project key and a reload, or the
 * next visit, opens where the person left off. The path wins whenever it names a project.
 */

const CURRENT = 'work.project';
const RECENT = 'work.projects.recent';
const KEEP = 6;

/** Notes a project as the one in use and moves it to the front of the person's recent ones. */
export function rememberProject(key: string): void {
  if (readPreference<string | null>(CURRENT, null) !== key) writePreference(CURRENT, key);
  const recent = readPreference<string[]>(RECENT, []);
  if (recent[0] !== key) {
    writePreference(RECENT, [key, ...recent.filter((entry) => entry !== key)].slice(0, KEEP));
  }
}

/** The last project this person used, and a way to change it. */
export function useProjectStore(): { projectKey: string | null; setProjectKey: (key: string | null) => void } {
  const [projectKey] = usePreference<string | null>(CURRENT, null);
  return {
    projectKey,
    setProjectKey: (key) => (key ? rememberProject(key) : writePreference(CURRENT, null)),
  };
}

/** The person's recently used project keys, newest first. */
export function useRecentProjects(): string[] {
  const [recent] = usePreference<string[]>(RECENT, []);
  return recent;
}
