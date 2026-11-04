import { useT } from '@bemmoly/core-web';
import { Field, Input, Radio } from '@bemmoly/ui';
import { setupText } from '../../../i18n/catalog.ts';
import type { Guide } from './use-guide.ts';

/** What Bemmoly can reach: a folder or organization, or only the projects the person names. */
export function ReachFields({ flow }: { flow: Guide }) {
  const t = useT(setupText);
  const { reach, read } = flow;
  const problem = !read.ok && read.problem !== 'empty' ? read.problem : null;
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 font-medium text-tx">{t('pipelinesSetup.cloud.reachTitle')}</legend>
      <Radio
        name="reach"
        checked={reach.kind === 'folder'}
        onChange={() => flow.setReach({ kind: 'folder' })}
        label={t('pipelinesSetup.cloud.reach.folder')}
        description={t('pipelinesSetup.cloud.reach.folderHint')}
      />
      {reach.kind === 'folder' && (
        <Field
          className="ps-6"
          label={t('pipelinesSetup.cloud.reach.folderField')}
          error={problem === 'folder' ? t('pipelinesSetup.cloud.reach.folderInvalid') : null}
        >
          <Input
            mono
            value={reach.folder}
            placeholder={t('pipelinesSetup.cloud.reach.folderExample')}
            onChange={(event) => flow.setReach({ folder: event.target.value })}
          />
        </Field>
      )}
      <Radio
        name="reach"
        checked={reach.kind === 'projects'}
        onChange={() => flow.setReach({ kind: 'projects' })}
        label={t('pipelinesSetup.cloud.reach.pick')}
        description={t('pipelinesSetup.cloud.reach.pickHint')}
      />
      {reach.kind === 'projects' && (
        <Field
          className="ps-6"
          label={t('pipelinesSetup.cloud.reach.pickField')}
          error={
            problem && typeof problem === 'object'
              ? t('pipelinesSetup.cloud.reach.pickInvalid', { id: problem.project })
              : null
          }
        >
          <Input
            mono
            value={reach.projects}
            placeholder={t('pipelinesSetup.cloud.reach.pickExample')}
            onChange={(event) => flow.setReach({ projects: event.target.value })}
          />
        </Field>
      )}
    </fieldset>
  );
}
