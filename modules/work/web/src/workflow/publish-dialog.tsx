import { isApiError } from '@bemmoly/api-client';
import { ConfirmChange, Field, Select } from '@bemmoly/ui';
import { useState } from 'react';
import type { Project } from '../../../shared/index.ts';
import type { PublishWorkflow } from '../hooks/workflow-publish.ts';
import type { EditorDraft } from './draft-model.ts';

export interface PublishDialogProps {
  open: boolean;
  name: string;
  version: number;
  changeCount: number;
  projects: readonly Project[];
  draft: EditorDraft;
  publisher: PublishWorkflow;
  onClose: () => void;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function usedBy(projects: readonly Project[]): string {
  if (projects.length === 0) return 'No project uses this workflow yet.';
  const names = projects.map((project) => project.name).join(', ');
  return `${plural(projects.length, 'project')} use${projects.length === 1 ? 's' : ''} it and move${projects.length === 1 ? 's' : ''} to the new version at once: ${names}.`;
}

/**
 * Publishing names the version it makes and who it reaches. When the draft
 * drops a status that still holds issues, the server asks where they go and
 * the dialog asks the person, then publishes again with the answer.
 */
export function PublishDialog(props: PublishDialogProps) {
  const { publisher, draft, version } = props;
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const toMap = publisher.refusal.statusMappingRequired;
  const problems = publisher.refusal.problems;
  const unmapped = toMap.filter((status) => !mapping[status.statusId]);
  const next = version + 1;
  const close = () => {
    setMapping({});
    publisher.reset();
    props.onClose();
  };
  const message =
    problems.length > 0
      ? 'Fix these problems in the draft, then publish again.'
      : toMap.length > 0
        ? unmapped.length > 0
          ? 'Choose where the issues in each removed status go.'
          : null
        : isApiError(publisher.error)
          ? publisher.error.message
          : publisher.error
            ? 'The workflow was not published. Try again.'
            : null;
  return (
    <ConfirmChange
      open={props.open}
      tone="caution"
      title={`Publish ${props.name} version ${next}?`}
      description={
        version > 0
          ? `Version ${next} replaces version ${version} for every issue on this workflow.`
          : `Version ${next} is the first one issues move through.`
      }
      consequences={[
        usedBy(props.projects),
        `${plural(props.changeCount, 'unpublished change')} go${props.changeCount === 1 ? 'es' : ''} live; issues keep their status unless it is removed.`,
        'Rules apply from the next move; moves already made are not checked again.',
      ]}
      confirmLabel={`Publish version ${next}`}
      busy={publisher.isPublishing}
      error={
        message ? (
          <p role="alert" className="m-0 text-12h text-danger">
            {message}
          </p>
        ) : undefined
      }
      onCancel={close}
      onConfirm={() => {
        if (unmapped.length > 0) return;
        void publisher
          .publish(mapping)
          .then(close)
          .catch(() => undefined);
      }}
    >
      {problems.length > 0 && (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-13 text-danger">
          {problems.map((problem, index) => (
            <li key={`${problem.code}-${index}`}>{problem.message}</li>
          ))}
        </ul>
      )}
      {toMap.map((status) => (
        <Field
          key={status.statusId}
          label={`Move the ${plural(status.issues, 'issue')} in "${status.name}" to`}
        >
          <Select
            value={mapping[status.statusId] ?? ''}
            placeholder="Choose a status"
            options={draft.statuses.map((target) => ({ value: target.id, label: target.name }))}
            onChange={(event) =>
              setMapping((current) => ({ ...current, [status.statusId]: event.value }))
            }
          />
        </Field>
      ))}
    </ConfirmChange>
  );
}
