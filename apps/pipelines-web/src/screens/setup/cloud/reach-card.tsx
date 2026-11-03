import { useT } from '@bemmoly/core-web';
import { Card, CardBody, CardHeader, Field, Input, Radio } from '@bemmoly/ui';
import { setupText } from '../../../i18n/catalog.ts';
import type { ConnectCloud } from './use-connect-cloud.ts';

/** What Bemmoly can reach: a folder or organization, or only the projects the person names. */
export function ReachCard({ flow }: { flow: ConnectCloud }) {
  const t = useT(setupText);
  const { reach, read } = flow;
  const problem = !read.ok && read.problem !== 'empty' ? read.problem : null;
  return (
    <Card>
      <CardHeader
        title={<h2 className="text-15 font-semibold">{t('pipelinesSetup.cloud.reachTitle')}</h2>}
      />
      <CardBody className="flex flex-col gap-2.5">
        <fieldset
          aria-label={t('pipelinesSetup.cloud.reachTitle')}
          className="flex flex-col gap-2.5"
        >
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
      </CardBody>
    </Card>
  );
}
