import type { IssueDetail } from '@bemmoly/module-work/shared';
import { Button, IconButton, Menu, MenuItem, Modal, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { issueKeys } from '../hooks/issue-keys.ts';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { projectKeyOf } from '../hooks/issue-vocabulary.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';
import type { IssueNeighbours } from './issue-list-context.ts';

/**
 * Watch or stop watching at once. Stopping offers Undo, since it quietly ends the person's
 * notifications; a refusal puts the old state back.
 */
export function useWatchToggle(issue: IssueDetail) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const detail = issueKeys.detail(issue.key);
  const mutation = useMutation({
    mutationFn: (watching: boolean) => api.work.issues.watch(issue.key, watching),
    onMutate: (watching) => {
      const before = queryClient.getQueryData<IssueDetail>(detail);
      if (before) {
        queryClient.setQueryData<IssueDetail>(detail, {
          ...before,
          watching,
          watchersCount: Math.max(0, before.watchersCount + (watching ? 1 : -1)),
        });
      }
      return { before };
    },
    onError: (error, watching, context) => {
      if (context?.before) queryClient.setQueryData(detail, context.before);
      toast.show({
        tone: 'danger',
        title: watching ? `${issue.key} is not watched` : `${issue.key} is still watched`,
        body: error.message,
        action: { label: 'Retry', onClick: () => mutation.mutate(watching) },
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detail });
    },
  });
  return (watching: boolean) =>
    mutation.mutate(watching, {
      onSuccess: () => {
        if (!watching) {
          toast.undo({
            title: `You stopped watching ${issue.key}`,
            onUndo: () => mutation.mutate(true),
          });
        }
      },
    });
}

/** Watch as a ghost button with the eye; pressed while watching. */
export function WatchButton({ issue }: { issue: IssueDetail }) {
  const toggle = useWatchToggle(issue);
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-pressed={issue.watching}
      icon={<Icon name="eye" size={15} />}
      onClick={() => toggle(!issue.watching)}
    >
      {issue.watching ? 'Watching' : 'Watch'}
    </Button>
  );
}

export async function copyIssueLink(
  issueKey: string,
  toast: ReturnType<typeof useToast>,
): Promise<void> {
  const url = new URL(workPaths.issue(issueKey), window.location.origin).toString();
  try {
    await navigator.clipboard.writeText(url);
    toast.show({ tone: 'ok', title: `Link to ${issueKey} copied` });
  } catch {
    toast.show({ tone: 'warn', title: 'Copy the link from the address bar', body: url });
  }
}

/** Copies the issue's address; the toast says it worked. */
export function ShareButton({ issueKey }: { issueKey: string }) {
  const toast = useToast();
  return (
    <IconButton
      label="Copy link"
      icon={<Icon name="link" size={15} />}
      size="sm"
      onClick={() => void copyIssueLink(issueKey, toast)}
    />
  );
}

/** "4 of 23" with previous and next, when the issue was opened from a list. */
export function IssueStepper({ neighbours }: { neighbours: IssueNeighbours }) {
  const go = (key: string | null) => key && navigateTo(workPaths.issue(key));
  return (
    <span className="flex items-center gap-0.5">
      <span className="mr-1 text-12 text-tx-3 tabular-nums" title={neighbours.label}>
        {neighbours.position} of {neighbours.total}
      </span>
      <IconButton
        keys="K"
        label="Previous issue"
        icon={<Icon name="arrow-up" size={15} />}
        size="xs"
        disabled={!neighbours.previous}
        onClick={() => go(neighbours.previous)}
      />
      <IconButton
        keys="J"
        label="Next issue"
        icon={<Icon name="arrow-down" size={15} />}
        size="xs"
        disabled={!neighbours.next}
        onClick={() => go(neighbours.next)}
      />
      <span aria-hidden className="mx-1.5 h-4 w-px bg-line" />
    </span>
  );
}

/** ···: copy the key, or delete the issue after a confirmation. */
export interface IssueMoreMenuProps {
  issue: IssueDetail;
  /** page: the header's 30px button. panel: the drawer header's 28px button. */
  size: 'page' | 'panel';
  onDeleted?: () => void;
}

/**
 * Deleting asks first: the issue leaves every board and only an admin can bring it back, so
 * there is no Undo to offer here.
 */
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
          />
        )}
      >
        <MenuItem onSelect={() => void copyIssueLink(issue.key, toast)}>Copy link</MenuItem>
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
              Delete issue
            </Button>
          </>
        }
      />
    </>
  );
}
