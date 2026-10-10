import { Button, IconButton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { Workflow } from '../../../shared/index.ts';
import type { SaveState } from '../hooks/workflow-draft.ts';
import { onLinkClick } from './navigate.ts';

const SAVE_COPY: Record<SaveState, string> = {
  saved: 'Draft saved',
  pending: 'Saving soon…',
  saving: 'Saving…',
  error: 'Not saved: check the highlighted field',
};

export interface EditorHeaderProps {
  workflow: Workflow;
  listPath: string;
  changeCount: number;
  saveState: SaveState;
  isValidating: boolean;
  canUndo: boolean;
  onUndo: () => void;
  onValidate: () => void;
  onAddStatus: () => void;
  onPublish: () => void;
}

/**
 * The editor's title row under the frame's header (which owns the breadcrumbs and tabs): a
 * way back to the list, the name and where it applies, where the draft stands against the
 * published version, then Undo (⌘Z), Validate, Add status and Publish, which opens the
 * diff of what changes.
 */
export function EditorHeader(props: EditorHeaderProps) {
  const { workflow, changeCount, saveState } = props;
  const facts = [
    workflow.publishedVersion > 0 ? `v${workflow.publishedVersion} published` : 'Never published',
    changeCount === 0
      ? 'no unpublished changes'
      : `${changeCount} unpublished change${changeCount === 1 ? '' : 's'}`,
  ];
  return (
    <div className="flex shrink-0 flex-col gap-1 px-6 pt-4 pb-3 max-md:px-4">
      <a
        href={props.listPath}
        onClick={onLinkClick(props.listPath)}
        className="flex w-fit items-center gap-1 rounded-sm text-12 text-tx-3 hover:text-tx focus-ring"
      >
        <Icon name="chevron" size={12} className="rotate-180" />
        All workflows
      </a>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="m-0 text-20 font-semibold tracking-title whitespace-nowrap">
          {workflow.name}
        </h1>
        <span className="text-12 text-tx-3">
          {workflow.projectId ? 'This project' : 'Default'}
        </span>
        <span className="min-w-0 truncate text-12 text-tx-3 tabular-nums">
          {facts.join(' · ')}
          <span aria-live="polite" className={saveState === 'error' ? 'text-danger' : undefined}>
            {' · '}
            {SAVE_COPY[saveState]}
          </span>
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <IconButton
            label="Undo (⌘Z)"
            title="Undo (⌘Z)"
            icon="undo"
            size="sm"
            disabled={!props.canUndo}
            onClick={props.onUndo}
          />
          <Button onClick={props.onValidate} loading={props.isValidating}>
            Validate
          </Button>
          <Button onClick={props.onAddStatus} icon={<Icon name="plus" size={14} />}>
            Add status
          </Button>
          <Button variant="primary" onClick={props.onPublish} disabled={changeCount === 0}>
            Review and publish
          </Button>
        </div>
      </div>
    </div>
  );
}
