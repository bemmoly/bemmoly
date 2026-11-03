import { useT } from '@bemmoly/core-web';
import type { PipelineSetup } from '@bemmoly/module-pipelines/shared';
import { Button, Card, EmptyState, SegmentedControl, StageGraph, Tag, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useEffect, useState } from 'react';
import { editorText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { RunPipelineDialog } from '../../runs/run-pipeline-dialog.tsx';
import { Inspector } from './inspector.tsx';
import { layoutOf, type StepKind } from './model.ts';
import { StepLibrary } from './step-library.tsx';
import { TriggersBar } from './triggers-bar.tsx';
import { useEditor, type EditorView } from './use-editor.ts';
import { pipelineYaml } from './yaml.ts';

/**
 * The Deliver pipeline of one service: its triggers, its steps grouped by environment, the
 * selected step's settings, and the same pipeline as YAML. Save writes it where the setup
 * said it lives (in Bemmoly, or a pull request to the repository).
 */
export function PipelineEditor({
  service,
  setup,
  stored,
}: {
  service: string;
  setup: PipelineSetup;
  stored: unknown;
}) {
  const t = useT(editorText);
  const toast = useToast();
  const editor = useEditor(service, setup, stored);
  const [library, setLibrary] = useState(false);
  const [running, setRunning] = useState(false);
  const { definition } = editor;
  const saved = editor.save.data;

  useEffect(() => {
    if (!saved) return;
    toast.show({
      tone: 'ok',
      title: saved.pullRequestUrl
        ? t('pipelinesEditor.editor.savedPullRequest')
        : saved.pendingReason
          ? t('pipelinesEditor.editor.savedPending', { reason: saved.pendingReason })
          : t('pipelinesEditor.editor.saved'),
    });
  }, [saved, t, toast]);

  if (!definition) {
    return (
      <Card className="py-12">
        <EmptyState
          icon={<Icon name="code" size={18} />}
          title={t('pipelinesEditor.editor.extendsTitle')}
          description={t('pipelinesEditor.editor.extendsHint')}
          headingLevel={2}
        />
      </Card>
    );
  }
  const layout = layoutOf(definition, editor.environments, {
    build: t('pipelinesEditor.group.build'),
    buildWhere: t('pipelinesEditor.group.buildWhere'),
    kind: (kind: StepKind) => t(`pipelinesEditor.kind.${kind}`),
  });
  const origin =
    setup.start === 'template'
      ? t('pipelinesEditor.editor.fromTemplate')
      : setup.start === 'repository'
        ? t('pipelinesEditor.editor.fromFile', { file: setup.repositoryFile ?? '' })
        : t('pipelinesEditor.editor.fromEmpty');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h2 className="text-16 font-semibold text-tx">{t('pipelinesEditor.editor.deliver')}</h2>
          <Tag size="md">{origin}</Tag>
          <Tag size="md">
            {setup.store === 'repository'
              ? t('pipelinesEditor.editor.inRepository')
              : t('pipelinesEditor.editor.inBemmoly')}
          </Tag>
          {setup.versionScheme ? (
            <Tag size="md">{t(`pipelinesEditor.version.${setup.versionScheme}`)}</Tag>
          ) : null}
          {editor.dirty ? (
            <Tag tone="accent" size="md">
              {t('pipelinesEditor.editor.unsaved')}
            </Tag>
          ) : null}
        </div>
        <SegmentedControl<EditorView>
          aria-label={t('pipelinesEditor.editor.view')}
          size="sm"
          value={editor.view}
          onChange={editor.setView}
          options={[
            { value: 'visual', label: t('pipelinesEditor.editor.visual') },
            { value: 'yaml', label: t('pipelinesEditor.editor.yaml') },
          ]}
        />
        <Button icon={<Icon name="plus" size={14} />} onClick={() => setLibrary(true)}>
          {t('pipelinesEditor.editor.addStep')}
        </Button>
        <Button icon={<Icon name="play" size={14} />} onClick={() => setRunning(true)}>
          {t('pipelinesEditor.editor.run')}
        </Button>
        <Button
          variant="primary"
          disabled={!editor.dirty}
          loading={editor.save.isPending}
          onClick={editor.submit}
        >
          {t('pipelinesEditor.editor.save')}
        </Button>
      </div>
      <ActionError error={editor.save.error} />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="flex min-w-0 flex-col gap-3 p-4">
          <TriggersBar triggers={editor.triggers} onChange={editor.setTriggers} />
          {editor.view === 'yaml' ? (
            <pre className="overflow-x-auto rounded-card border border-line bg-sunken p-4 font-mono text-12 text-tx">
              {pipelineYaml(definition, editor.triggers)}
            </pre>
          ) : layout.stages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <Button icon={<Icon name="plus" size={14} />} onClick={() => setLibrary(true)}>
                {t('pipelinesEditor.editor.addFirst')}
              </Button>
              <span className="text-12 text-tx-3">{t('pipelinesEditor.editor.addFirstHint')}</span>
            </div>
          ) : (
            <StageGraph
              stages={layout.stages}
              edges={layout.edges}
              groups={layout.groups}
              selectedId={editor.selected}
              onSelect={editor.select}
              ariaLabel={t('pipelinesEditor.editor.graph')}
              stateLabel={() => t('pipelinesEditor.editor.step')}
            />
          )}
          {editor.triggers.length === 0 ? (
            <span className="text-12 text-tx-3">{t('pipelinesEditor.editor.noTriggers')}</span>
          ) : null}
        </Card>
        <Card className="min-w-0">
          <Inspector editor={editor} definition={definition} />
        </Card>
      </div>
      <StepLibrary
        open={library}
        onClose={() => setLibrary(false)}
        environments={editor.environments}
        hasBuild={Boolean(definition.build)}
        onAdd={(kind, name, environment) => {
          editor.add(kind, name, environment);
          setLibrary(false);
        }}
      />
      {running ? <RunPipelineDialog service={service} onClose={() => setRunning(false)} /> : null}
    </div>
  );
}
