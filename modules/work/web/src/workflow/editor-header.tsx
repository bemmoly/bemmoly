import { Badge, Breadcrumbs, Button } from '@bemmoly/ui';
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
  projectName: string;
  listPath: string;
  changeCount: number;
  saveState: SaveState;
  isValidating: boolean;
  onValidate: () => void;
  onAddStatus: () => void;
  onPublish: () => void;
}

/**
 * The Workflow mock's header: the trail, the 22px name with its scope
 * badge, where the draft stands against the published version, and the
 * Validate, Add status and Publish actions.
 */
export function EditorHeader(props: EditorHeaderProps) {
  const { workflow, changeCount, saveState } = props;
  const facts = [
    workflow.publishedVersion > 0
      ? `Version ${workflow.publishedVersion} published`
      : 'Never published',
    changeCount === 0
      ? 'No unpublished changes'
      : `${changeCount} unpublished change${changeCount === 1 ? '' : 's'}`,
  ];
  return (
    <div className="flex shrink-0 flex-col gap-3 px-6 pt-3.5 pb-3">
      <Breadcrumbs
        items={[
          { label: 'Projects' },
          { label: props.projectName },
          { label: 'Settings' },
          {
            label: 'Workflows',
            href: props.listPath,
            linkProps: { onClick: onLinkClick(props.listPath) },
          },
          { label: workflow.name },
        ]}
      />
      <div className="flex items-center gap-4">
        <h1 className="m-0 text-22 font-semibold tracking-title">{workflow.name}</h1>
        <Badge tone="accent">{workflow.projectId ? 'PROJECT COPY' : 'ORG DEFAULT'}</Badge>
        <span className="text-12h text-tx4">
          {facts.join(' · ')}
          <span aria-live="polite" className={saveState === 'error' ? 'text-danger' : undefined}>
            {' · '}
            {SAVE_COPY[saveState]}
          </span>
        </span>
        <div className="ml-auto flex gap-2">
          <Button onClick={props.onValidate} loading={props.isValidating}>
            Validate
          </Button>
          <Button onClick={props.onAddStatus}>Add status</Button>
          <Button variant="primary" onClick={props.onPublish} disabled={changeCount === 0}>
            Publish
          </Button>
        </div>
      </div>
    </div>
  );
}
