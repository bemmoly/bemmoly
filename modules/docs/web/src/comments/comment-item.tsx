import { formatRelative } from '@bemmoly/core-web';
import { RichTextView, type RichTextDoc } from '@bemmoly/editor';
import type { PageComment, RichText } from '@bemmoly/module-docs/shared';
import { Avatar, IconButton, Menu, MenuItem } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { CommentBox } from './comment-box.tsx';

export interface CommentItemProps {
  comment: PageComment;
  /** The viewer wrote it: Edit and Delete are theirs. */
  mine: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (body: RichText) => Promise<unknown>;
  onDelete: () => void;
  /** The quoted text a thread's first comment is about, between its name line and its body. */
  quote?: ReactNode;
}

/**
 * One comment of a thread, as the mock's rail card has it: a 20px avatar, the name in
 * semibold and the time in tx5, the quote for a thread's first comment, then the body at 12.5px. The author's ··· menu edits and
 * deletes; an edited comment says so after the time.
 */
export function CommentItem({
  comment,
  mine,
  editing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  quote,
}: CommentItemProps) {
  const name = comment.author?.name ?? 'Former member';
  return (
    <div className="group/comment flex flex-col gap-1.5" data-comment={comment.id}>
      <div className="flex min-w-0 items-center gap-2">
        <Avatar name={name} size={20} />
        <span className="truncate font-semibold text-tx">{name}</span>
        <time dateTime={comment.createdAt} className="shrink-0 text-tx-3" title={comment.createdAt}>
          {formatRelative(comment.createdAt)}
          {comment.editedAt ? ' · edited' : ''}
        </time>
        {mine && !editing && (
          <span className="ml-auto opacity-0 group-focus-within/comment:opacity-100 group-hover/comment:opacity-100 motion-safe:transition-opacity">
            <Menu
              align="end"
              trigger={(props) => (
                <IconButton {...props} label="Comment actions" icon="more" size="xs" />
              )}
            >
              <MenuItem onSelect={onEdit}>Edit</MenuItem>
              <MenuItem tone="danger" onSelect={onDelete}>
                Delete
              </MenuItem>
            </Menu>
          </span>
        )}
      </div>
      {quote}
      {editing ? (
        <CommentBox
          label="Edit comment"
          submitLabel="Save"
          initialBody={comment.body}
          onSubmit={onSave}
          onCancel={onCancelEdit}
        />
      ) : (
        <RichTextView
          doc={comment.body as RichTextDoc}
          size="comment"
          className="text-13 leading-body text-tx"
        />
      )}
    </div>
  );
}
