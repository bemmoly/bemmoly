import { useT } from '@bemmoly/core-web';
import type { PipelineSpec } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Select, Tag, Textarea } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { editorText } from '../../../i18n/catalog.ts';
import { BUILD_KEY, keyOf, kindOf, needsOf } from './model.ts';
import type { Editor } from './use-editor.ts';

/** The selected step's settings; a deploy step's size and scaling are the service's own. */
export function Inspector({ editor, definition }: { editor: Editor; definition: PipelineSpec }) {
  const t = useT(editorText);
  const key = editor.selected;
  if (!key) {
    return <p className="p-4 text-13 text-tx-3">{t('pipelinesEditor.inspector.empty')}</p>;
  }
  if (key === BUILD_KEY && definition.build) {
    const build = definition.build;
    return (
      <div className="flex flex-col gap-4 p-4">
        <Heading
          title={t('pipelinesEditor.library.item.buildImage')}
          kind={t('pipelinesEditor.kind.build')}
        />
        <Field label={t('pipelinesEditor.inspector.dockerfile')}>
          <Input
            mono
            value={build.dockerfile}
            onChange={(e) => editor.updateBuild({ dockerfile: e.target.value })}
          />
        </Field>
        <Field label={t('pipelinesEditor.inspector.context')}>
          <Input
            mono
            value={build.context}
            onChange={(e) => editor.updateBuild({ context: e.target.value })}
          />
        </Field>
        <Field
          label={t('pipelinesEditor.inspector.pool')}
          hint={t('pipelinesEditor.inspector.poolHint')}
        >
          <Input
            mono
            value={build.pool ?? ''}
            onChange={(e) => editor.updateBuild({ pool: e.target.value || undefined })}
          />
        </Field>
        <Remove onRemove={() => editor.remove(BUILD_KEY)} />
      </div>
    );
  }
  const step = definition.test.find((item) => keyOf(item) === key);
  if (!step) return null;
  const kind = kindOf(step);
  const others = [BUILD_KEY, ...definition.test.map(keyOf)].filter((other) => other !== key);
  const nameOf = (other: string) =>
    other === BUILD_KEY
      ? t('pipelinesEditor.kind.build')
      : (definition.test.find((s) => keyOf(s) === other)?.name ?? other);
  return (
    <div className="flex flex-col gap-4 p-4">
      <Heading title={step.name} kind={t(`pipelinesEditor.kind.${kind}`)} locked={step.locked} />
      <Field label={t('pipelinesEditor.inspector.name')}>
        <Input
          value={step.name}
          disabled={step.locked}
          onChange={(e) => editor.update(key, { name: e.target.value })}
        />
      </Field>
      <Field label={t('pipelinesEditor.inspector.environment')}>
        <Select
          value={step.environment ?? ''}
          disabled={step.locked}
          onChange={(event) => editor.update(key, { environment: event.value || undefined })}
          options={[
            ...(kind === 'deploy'
              ? []
              : [{ value: '', label: t('pipelinesEditor.library.whereBuild') }]),
            ...editor.environments.map((environment) => ({
              value: environment.key,
              label: environment.name,
            })),
          ]}
        />
      </Field>
      {kind === 'deploy' ? (
        <p className="text-12 text-tx-3">{t('pipelinesEditor.inspector.deployHint')}</p>
      ) : kind === 'script' ? (
        <>
          <Field label={t('pipelinesEditor.inspector.image')}>
            <Input
              mono
              value={step.image ?? ''}
              disabled={step.locked}
              onChange={(e) => editor.update(key, { image: e.target.value })}
            />
          </Field>
          <Field label={t('pipelinesEditor.inspector.script')}>
            <Textarea
              rows={5}
              spellCheck={false}
              className="font-mono"
              value={step.run ?? ''}
              disabled={step.locked}
              onChange={(e) => editor.update(key, { run: e.target.value })}
            />
          </Field>
          <Field label={t('pipelinesEditor.inspector.timeout')}>
            <Input
              type="number"
              min={1}
              max={1440}
              value={step.timeoutMinutes ?? ''}
              disabled={step.locked}
              onChange={(e) =>
                editor.update(key, {
                  timeoutMinutes: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </Field>
        </>
      ) : null}
      <Field
        label={t('pipelinesEditor.inspector.after')}
        hint={t('pipelinesEditor.inspector.afterHint')}
      >
        <Select
          value=""
          placeholder={t('pipelinesEditor.inspector.afterAdd')}
          disabled={step.locked}
          options={others
            .filter((other) => !step.needs.includes(other))
            .map((other) => ({ value: other, label: nameOf(other) }))}
          onChange={(event) => editor.update(key, { needs: [...step.needs, event.value] })}
        />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {needsOf(definition, step).map((need) => (
          <Tag
            key={need}
            size="md"
            {...(step.locked || !step.needs.includes(need)
              ? {}
              : {
                  onRemove: () =>
                    editor.update(key, { needs: step.needs.filter((n) => n !== need) }),
                  removeLabel: t('pipelinesEditor.inspector.afterRemove', { step: nameOf(need) }),
                })}
          >
            {nameOf(need)}
          </Tag>
        ))}
      </div>
      {step.locked ? null : <Remove onRemove={() => editor.remove(key)} />}
    </div>
  );
}

function Heading({ title, kind, locked }: { title: string; kind: string; locked?: boolean }) {
  const t = useT(editorText);
  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-14 font-semibold text-tx">{title}</span>
        <span className="text-12 text-tx-3">{kind}</span>
      </div>
      {locked ? (
        <Tag size="md">
          <Icon name="lock" size={12} />
          {t('pipelinesEditor.inspector.required')}
        </Tag>
      ) : null}
    </div>
  );
}

function Remove({ onRemove }: { onRemove: () => void }) {
  const t = useT(editorText);
  return (
    <div>
      <Button variant="danger" size="sm" icon={<Icon name="trash" size={14} />} onClick={onRemove}>
        {t('pipelinesEditor.inspector.remove')}
      </Button>
    </div>
  );
}
