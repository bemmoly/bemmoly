/** The Work screens whose address names a project: /work/board/PLT, /work/issue/PLT-204, … */
const PROJECT_IN_PATH = /\/work\/(?:board|backlog|issue|members|settings|workflows)\/([^/?#]+)/;

/**
 * The project key the address names, if any; an issue key names its project. Read straight
 * from the address, so it is right before any screen has loaded or remembered its project.
 */
export function projectKeyInPath(pathname: string): string | undefined {
  const named = PROJECT_IN_PATH.exec(pathname)?.[1];
  if (!named) return undefined;
  return decodeURIComponent(named).split('-')[0]?.toUpperCase() || undefined;
}
