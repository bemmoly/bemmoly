import { useT } from '@bemmoly/core-web';
import type { ProposalsPage } from '@bemmoly/module-pipelines/shared';
import { pipelinesText } from '../../i18n/catalog.ts';

/**
 * The repository file accepting would open, for each repository whose deployables share one
 * Dockerfile: read before accepting, so the pull request holds no surprise.
 */
export function RepositoryFiles({ files }: { files: ProposalsPage['repositoryFiles'] }) {
  const t = useT(pipelinesText);
  if (files.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
      {files.map((file) => (
        <section
          key={file.repository}
          className="flex flex-col gap-1.5"
          aria-label={t('pipelines.start.repositoryFileLabel', { repository: file.repository })}
          data-testid="proposed-repository-file"
        >
          <h3 className="text-13 font-medium text-tx">
            {t('pipelines.start.repositoryFileTitle', { repository: file.repository })}
          </h3>
          <p className="text-12 text-tx-3">
            {t('pipelines.start.repositoryFileNote', { path: file.path })}
          </p>
          <pre className="max-h-80 overflow-auto rounded-control bg-sunken p-2.5 font-mono text-12 leading-body whitespace-pre text-tx">
            {file.content}
          </pre>
        </section>
      ))}
    </div>
  );
}
