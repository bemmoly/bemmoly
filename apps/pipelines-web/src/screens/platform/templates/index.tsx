import { useT } from '@bemmoly/core-web';
import { pipelineSpecSchema, type BuiltInTemplateSummary } from '@bemmoly/module-pipelines/shared';
import { Button, Card, CardBody, CardHeader, Modal, Skeleton, Tag, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { editorText } from '../../../i18n/catalog.ts';
import { LoadError } from '../../../parts/load-error.tsx';
import { pipelineYaml } from '../../pipeline/editor/yaml.ts';
import { TemplateGroups } from '../../pipeline/template-groups.tsx';
import { useBuiltInTemplates } from '../../pipeline/use-pipeline-setup.ts';

/**
 * Platform › Templates: the templates that ship with Bemmoly, drawn for this install's
 * environments, each a starting point a service picks; none is applied on its own.
 */
export default function TemplatesScreen() {
  const t = useT(editorText);
  const templates = useBuiltInTemplates();
  const [copying, setCopying] = useState<BuiltInTemplateSummary | null>(null);
  return (
    <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6">
      <span className="text-13 text-tx-3">{t('pipelinesEditor.templates.description')}</span>
      {templates.isError ? (
        <LoadError
          title={t('pipelinesEditor.templates.loadFailed')}
          error={templates.error}
          onRetry={() => void templates.refetch()}
        />
      ) : !templates.data ? (
        <Skeleton width="100%" height={240} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {templates.data.items.map((template) => (
            <Card key={template.key}>
              <CardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <h2 className="m-0 text-14 font-semibold">{template.name}</h2>
                    <Tag>{t('pipelinesEditor.template.builtIn')}</Tag>
                    {template.suggested ? (
                      <Tag tone="accent">{t('pipelinesEditor.template.suggested')}</Tag>
                    ) : null}
                  </span>
                }
              />
              <CardBody className="flex flex-col gap-3">
                <span className="text-13 text-tx-2">{template.description}</span>
                <TemplateGroups template={template} />
                <span className="text-12 text-tx-3">
                  {t('pipelinesEditor.template.trigger', { trigger: template.suggestedTrigger })}
                </span>
                <div>
                  <Button
                    size="sm"
                    icon={<Icon name="copy" size={14} />}
                    onClick={() => setCopying(template)}
                  >
                    {t('pipelinesEditor.templates.copy')}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <Card>
        <CardHeader title={t('pipelinesEditor.templates.yours')} />
        <CardBody className="text-13 text-tx-3">
          {t('pipelinesEditor.templates.yoursEmpty')}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('pipelinesEditor.templates.required')} />
        <CardBody className="text-13 text-tx-3">
          {t('pipelinesEditor.templates.requiredEmpty')}
        </CardBody>
      </Card>
      {copying ? <CopyTemplate template={copying} onClose={() => setCopying(null)} /> : null}
    </div>
  );
}

/** The template's pipeline as a file to keep in a repository, then pick when setting up. */
function CopyTemplate({
  template,
  onClose,
}: {
  template: BuiltInTemplateSummary;
  onClose: () => void;
}) {
  const t = useT(editorText);
  const toast = useToast();
  const definition = pipelineSpecSchema.safeParse(template.definition ?? {});
  const text = definition.success ? pipelineYaml(definition.data, []) : '';
  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={t('pipelinesEditor.templates.copyTitle', { name: template.name })}
      description={t('pipelinesEditor.templates.copyHint')}
      footer={
        <>
          <Button onClick={onClose}>{t('pipelinesEditor.common.close')}</Button>
          <Button
            variant="primary"
            icon={<Icon name="copy" size={14} />}
            onClick={() =>
              void navigator.clipboard
                .writeText(text)
                .then(() =>
                  toast.show({ tone: 'ok', title: t('pipelinesEditor.templates.copied') }),
                )
            }
          >
            {t('pipelinesEditor.templates.copyButton')}
          </Button>
        </>
      }
    >
      <pre className="max-h-96 overflow-auto rounded-card border border-line bg-sunken p-4 font-mono text-12 text-tx">
        {text}
      </pre>
    </Modal>
  );
}
