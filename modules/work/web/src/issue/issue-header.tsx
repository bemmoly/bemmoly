import type { IssueDetail } from '@bemmoly/module-work/shared';
import {
  Breadcrumbs,
  Button,
  FieldSwatch,
  IconButton,
  KeyChip,
  Menu,
  MenuItem,
  Modal,
  TypeGlyph,
  useToast,
} from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useWatch } from '../hooks/issue-detail.ts';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { projectKeyOf } from '../hooks/issue-vocabulary.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';
import { typeGlyph } from './vocabulary.ts';

/** "Platform Core / ■ Auth service / ▮ PLT-204": project, epic and the issue's own key. */
export function IssueTrail({ issue, projectName }: { issue: IssueDetail; projectName: string }) {
  const projectKey = projectKeyOf(issue.key);
  return (
    <Breadcrumbs
      items={[
        { label: projectName, href: workPaths.board(projectKey) },
        ...(issue.parent
          ? [
              {
                label: issue.parent.title,
                href: workPaths.issue(issue.parent.key),
                icon: <FieldSwatch colorClassName="bg-ac" />,
              },
            ]
          : []),
        {
          label: <KeyChip issueKey={issue.key} size="md" />,
          icon: <TypeGlyph type={typeGlyph(issue.type)} />,
        },
      ]}
    />
  );
}

/** Watch with the count, as the mock's 30px bordered button. */
export function WatchButton({ issue }: { issue: IssueDetail }) {
  const watch = useWatch(issue.key);
  return (
    <Button
      size="sm"
      aria-pressed={issue.watching}
      loading={watch.isPending}
      onClick={() => watch.mutate(!issue.watching)}
      iconEnd={
        <span className="font-mono text-11 font-medium text-tx5">{issue.watchersCount}</span>
      }
    >
      {issue.watching ? 'Watching' : 'Watch'}
    </Button>
  );
}

/** Copies the issue's address; the toast says it worked. */
export function ShareButton({ issueKey }: { issueKey: string }) {
  const toast = useToast();
  const share = async () => {
    const url = new URL(workPaths.issue(issueKey), window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast.show({ tone: 'ok', title: `Link to ${issueKey} copied` });
    } catch {
      toast.show({ tone: 'warn', title: 'Copy the link from the address bar', body: url });
    }
  };
  return (
    <Button size="sm" onClick={() => void share()}>
      Share
    </Button>
  );
}

/** ···: copy the key, or delete the issue after a confirmation. */
export interface IssueMoreMenuProps {
  issue: IssueDetail;
  /** page: the bordered 30px button. panel: the drawer header's bare 28px button. */
  size: 'page' | 'panel';
  onDeleted?: () => void;
}

export function IssueMoreMenu({ issue, size, onDeleted }: IssueMoreMenuProps) {
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.work.issues.remove(issue.key),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workKeys.all() });
      toast.show({ tone: 'ok', title: `${issue.key} deleted` });
      setConfirm(false);
      if (onDeleted) onDeleted();
      else navigateTo(workPaths.board(projectKeyOf(issue.key)));
    },
    onError: (error) =>
      toast.show({ tone: 'danger', title: `${issue.key} was not deleted`, body: error.message }),
  });
  return (
    <>
      <Menu
        align="end"
        trigger={(props) => (
          <IconButton
            {...props}
            label="More actions"
            icon="more"
            size={size === 'page' ? 'sm' : 'xs'}
            variant={size === 'page' ? 'secondary' : 'ghost'}
          />
        )}
      >
        <MenuItem onSelect={() => void navigator.clipboard?.writeText(issue.key)}>
          Copy key
        </MenuItem>
        <MenuItem tone="danger" onSelect={() => setConfirm(true)}>
          Delete issue
        </MenuItem>
      </Menu>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        width="sm"
        title={`Delete ${issue.key}?`}
        description="It leaves the board and the backlog. An admin can restore it later."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}
