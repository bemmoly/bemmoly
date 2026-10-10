import type { AiPrompt } from '@bemmoly/shared';
import { Badge, Button, Field, Modal, SegmentedControl, Textarea } from '@bemmoly/ui';
import { useState, type KeyboardEvent } from 'react';
import { ROLE_COPY } from '../../hooks/use-ai-roles.ts';
import {
  activeTemplate,
  diffLines,
  unknownVariables,
  type AiPrompts,
} from '../../hooks/use-ai-prompts.ts';
import { describeError } from '../../lib/errors.ts';
import { PromptDiff } from './prompt-diff.tsx';

type View = 'edit' | 'changes' | 'default';

function EditorModal({
  prompt,
  prompts,
  onClose,
}: {
  prompt: AiPrompt;
  prompts: AiPrompts;
  onClose: () => void;
}) {
  const [text, setText] = useState(() => activeTemplate(prompt));
  const [view, setView] = useState<View>('edit');
  const unknown = unknownVariables(prompt, text);
  const empty = text.trim() === '';
  const error = empty
    ? 'Write the prompt, or reset it to the default'
    : unknown.length > 0
      ? `${unknown.map((name) => `{{${name}}}`).join(', ')} isn’t a variable of this prompt. Use ${prompt.variables.map((name) => `{{${name}}}`).join(', ') || 'no variables'}.`
      : prompts.save.error
        ? describeError(prompts.save.error).message
        : null;
  const dirty = text !== activeTemplate(prompt);
  const save = () => {
    if (!dirty || empty || unknown.length > 0) return;
    prompts.save.mutate({ id: prompt.id, template: text }, { onSuccess: onClose });
  };
  const keys = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  };
  const footer = (
    <>
      {prompt.override ? (
        <Button
          variant="ghost"
          loading={prompts.reset.isPending}
          onClick={() => prompts.reset.mutate(prompt, { onSuccess: onClose })}
        >
          Reset to default
        </Button>
      ) : null}
      <span className="flex-1" />
      <Button onClick={onClose}>Cancel</Button>
      <Button
        variant="primary"
        disabled={!dirty || empty || unknown.length > 0}
        loading={prompts.save.isPending}
        onClick={save}
      >
        Save override
      </Button>
    </>
  );
  return (
    <Modal
      open
      onClose={onClose}
      width="xl"
      title={prompt.description}
      description={<span className="font-mono text-12">{prompt.id}</span>}
      footer={footer}
    >
      <div className="flex flex-col gap-3" onKeyDown={keys}>
        <div className="flex flex-wrap items-center gap-2 text-12 text-tx-3">
          <Badge>{ROLE_COPY[prompt.role].label} role</Badge>
          <span>Version {prompt.version}</span>
          {prompt.variables.length > 0 ? (
            <span className="font-mono">
              {prompt.variables.map((name) => `{{${name}}}`).join(' ')}
            </span>
          ) : null}
        </div>
        <SegmentedControl<View>
          size="sm"
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'changes', label: 'Changes from the default' },
            { value: 'default', label: 'Default' },
          ]}
          value={view}
          onChange={setView}
        />
        {view === 'edit' ? (
          <Field label="Prompt" error={error ?? undefined}>
            <Textarea
              rows={12}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="font-mono text-12"
            />
          </Field>
        ) : view === 'changes' ? (
          <PromptDiff lines={diffLines(prompt.defaultTemplate, text)} />
        ) : (
          <pre className="m-0 max-h-80 overflow-auto rounded-control bg-sunken p-3 font-mono text-12 leading-body whitespace-pre-wrap text-tx-2">
            {prompt.defaultTemplate}
          </pre>
        )}
      </div>
    </Modal>
  );
}

/**
 * One prompt: the template the runtime uses, editable as an override, the changes from the
 * default as a line diff, and Reset to default (with Undo). Mod+Enter saves.
 */
export function PromptEditor({
  prompt,
  prompts,
  onClose,
}: {
  prompt: AiPrompt | null;
  prompts: AiPrompts;
  onClose: () => void;
}) {
  return prompt ? (
    <EditorModal key={prompt.id} prompt={prompt} prompts={prompts} onClose={onClose} />
  ) : null;
}
