import type { SqlExecutor } from '@bemmoly/core';

/*
 * The application.yaml files a commit broke. The catalog sync reads each file a push to the
 * default branch touched before the push's run starts (handlers run in order), and keeps
 * what it could not apply against the commit. Its warnings (an owner that names no team) are
 * kept too, but their application was applied at this commit, which tells the two apart.
 */

export interface UnreadableFile {
  path: string;
  message: string;
  repositoryId: string;
  /** The application the file defined before this commit; null for a new file. */
  application: { id: string; key: string; teamId: string | null } | null;
}

export async function unreadableFiles(
  sql: SqlExecutor,
  repository: string,
  commitSha: string,
): Promise<UnreadableFile[]> {
  const rows = await sql<
    {
      path: string;
      message: string;
      repository_id: string;
      application_id: string | null;
      application_key: string | null;
      owner_team_id: string | null;
    }[]
  >`
    select e.path, e.message, e.repository_id, a.id as application_id,
      a.key as application_key, a.owner_team_id
    from pipeline_catalog_file_errors e
    join pipeline_repositories p on p.id = e.repository_id
    left join pipeline_applications a on a.repository_id = e.repository_id
      and a.file_path = e.path and a.archived_at is null
    where p.full_name = ${repository} and e.commit_sha = ${commitSha}
      and (a.id is null or a.source_commit_sha is distinct from ${commitSha})
    order by e.path`;
  return rows.map((row) => ({
    path: row.path,
    message: row.message,
    repositoryId: row.repository_id,
    application:
      row.application_id && row.application_key
        ? { id: row.application_id, key: row.application_key, teamId: row.owner_team_id }
        : null,
  }));
}

/** "Couldn't read .bemmoly/application.yaml: tier: …. Fix the file and push again." */
export function unreadableReason(files: readonly UnreadableFile[]): string {
  return files
    .map((file) => `Couldn't read ${file.path}: ${file.message.replace(/\.$/, '')}.`)
    .concat('Fix the file and push again.')
    .join('\n');
}
