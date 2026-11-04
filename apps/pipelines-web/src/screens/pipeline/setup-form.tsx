import { useT } from '@bemmoly/core-web';
import { Button, Card, CardBody, CardHeader, Select, Tag, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { editorText } from '../../i18n/catalog.ts';
import { ActionError } from '../../parts/action-error.tsx';
import { Choice } from './choice.tsx';
import { EMPTY_DRAFT, isReady, suggestedDraft, toBody, VERSION_SCHEMES } from './setup-draft.ts';
import { TemplateGroups } from './template-groups.tsx';
import {
  useBuiltInTemplates,
  useChecklistOpen,
  useRepositoryFiles,
  useSaveSetup,
} from './use-pipeline-setup.ts';

/**
 * "Set up a pipeline for <service>": where it starts, where it lives, how versions are
 * numbered. Nothing is picked for the person; "Use suggested" fills the form, Create saves it.
 */
export function SetupForm({ service }: { service: string }) {
  const t = useT(editorText);
  const toast = useToast();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const templates = useBuiltInTemplates();
  const files = useRepositoryFiles(service, draft.start === 'repository');
  const save = useSaveSetup(service);
  const checklistOpen = useChecklistOpen();
  const items = templates.data?.items ?? [];
  const set = (next: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...next }));

  const create = () => {
    const body = toBody(draft);
    if (!body) return;
    save.mutate(body, {
      onSuccess: (saved) => {
        toast.show({
          tone: 'ok',
          title: saved.pullRequestUrl
            ? t('pipelinesEditor.setup.createdWithPullRequest')
            : saved.pendingReason
              ? t('pipelinesEditor.setup.createdPending', { reason: saved.pendingReason })
              : t('pipelinesEditor.setup.created'),
        });
        if (checklistOpen) void navigate({ to: '/' });
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-16 font-semibold text-tx">
            {t('pipelinesEditor.setup.title', { service })}
          </h2>
          <span className="text-13 text-tx-3">{t('pipelinesEditor.setup.description')}</span>
        </div>
        <Button
          icon={<Icon name="spark" size={14} />}
          disabled={items.length === 0}
          onClick={() => {
            setDraft(suggestedDraft(items));
            toast.show({ tone: 'ok', title: t('pipelinesEditor.setup.suggestedFilled') });
          }}
        >
          {t('pipelinesEditor.setup.useSuggested')}
        </Button>
      </div>

      <Card>
        <CardHeader title={t('pipelinesEditor.setup.startFrom')} />
        <CardBody>
          <div
            role="radiogroup"
            aria-label={t('pipelinesEditor.setup.startFrom')}
            className="grid gap-2.5 md:grid-cols-3"
          >
            <Choice
              selected={draft.start === 'empty'}
              onSelect={() => set({ start: 'empty' })}
              title={t('pipelinesEditor.setup.start.empty')}
              description={t('pipelinesEditor.setup.start.emptyHint')}
            />
            <Choice
              selected={draft.start === 'template'}
              onSelect={() => set({ start: 'template' })}
              title={t('pipelinesEditor.setup.start.template')}
              description={t('pipelinesEditor.setup.start.templateHint', { count: items.length })}
            />
            <Choice
              selected={draft.start === 'repository'}
              onSelect={() => set({ start: 'repository' })}
              title={t('pipelinesEditor.setup.start.repository')}
              description={t('pipelinesEditor.setup.start.repositoryHint')}
            />
          </div>
        </CardBody>
      </Card>

      {draft.start === 'template' ? (
        <Card>
          <CardHeader
            title={t('pipelinesEditor.setup.template')}
            hint={t('pipelinesEditor.setup.templateHint')}
          />
          <CardBody>
            <div
              role="radiogroup"
              aria-label={t('pipelinesEditor.setup.template')}
              className="flex flex-col gap-2.5"
            >
              {items.map((template) => (
                <Choice
                  key={template.key}
                  selected={draft.template === template.key}
                  onSelect={() => set({ template: template.key })}
                  title={
                    <>
                      {template.name}
                      {template.suggested ? (
                        <Tag tone="accent">{t('pipelinesEditor.template.suggested')}</Tag>
                      ) : null}
                    </>
                  }
                  description={template.description}
                >
                  {draft.template === template.key ? (
                    <div className="mt-2">
                      <TemplateGroups template={template} />
                    </div>
                  ) : null}
                </Choice>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {draft.start === 'repository' ? (
        <Card>
          <CardHeader title={t('pipelinesEditor.setup.file')} />
          <CardBody className="flex flex-col gap-2">
            {files.data && !files.data.readable ? (
              <span className="text-13 text-tx-3">{t('pipelinesEditor.setup.fileUnreadable')}</span>
            ) : files.data && files.data.items.length === 0 ? (
              <span className="text-13 text-tx-3">{t('pipelinesEditor.setup.fileNone')}</span>
            ) : (
              <Select
                aria-label={t('pipelinesEditor.setup.file')}
                placeholder={t('pipelinesEditor.setup.filePick')}
                value={draft.repositoryFile ?? ''}
                options={(files.data?.items ?? []).map((file) => ({
                  value: file.path,
                  label: file.path,
                  description: t(`pipelinesEditor.setup.fileKind.${file.kind}`),
                }))}
                onChange={(event) => set({ repositoryFile: event.value })}
              />
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={t('pipelinesEditor.setup.store')} />
        <CardBody>
          <div
            role="radiogroup"
            aria-label={t('pipelinesEditor.setup.store')}
            className="grid gap-2.5 md:grid-cols-2"
          >
            <Choice
              selected={draft.store === 'bemmoly'}
              onSelect={() => set({ store: 'bemmoly' })}
              title={t('pipelinesEditor.setup.store.bemmoly')}
              description={t('pipelinesEditor.setup.store.bemmolyHint')}
            />
            <Choice
              selected={draft.store === 'repository'}
              onSelect={() => set({ store: 'repository' })}
              title={t('pipelinesEditor.setup.store.repository')}
              description={t('pipelinesEditor.setup.store.repositoryHint')}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('pipelinesEditor.setup.versions')} />
        <CardBody>
          <div
            role="radiogroup"
            aria-label={t('pipelinesEditor.setup.versions')}
            className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {VERSION_SCHEMES.map((scheme) => (
              <Choice
                key={scheme}
                selected={draft.versionScheme === scheme}
                onSelect={() => set({ versionScheme: scheme })}
                title={t(`pipelinesEditor.version.${scheme}`)}
                description={t(`pipelinesEditor.version.${scheme}Hint`)}
              />
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="flex items-start gap-2.5 rounded-card border border-line bg-sunken px-4 py-3 text-13 text-tx-2">
        <Icon name="info" size={16} />
        <span>{t('pipelinesEditor.setup.noTriggers')}</span>
      </div>
      <ActionError error={save.error} />
      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={!isReady(draft)}
          loading={save.isPending}
          onClick={create}
        >
          {t('pipelinesEditor.setup.create')}
        </Button>
      </div>
    </div>
  );
}
