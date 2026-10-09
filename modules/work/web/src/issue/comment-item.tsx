import type { Comment, RichText } from '@bemmoly/module-work/shared';
import { formatRelative } from '@bemmoly/core-web';
import { ActivityAction, ActivityItem, Menu, MenuItem, ReactionChip } from '@bemmoly/ui';
import { useState } from 'react';
import type { Person } from '../hooks/issue-people.ts';
import { CommentBox } from './comment-box.tsx';
import { RichTextView } from './rich-text.tsx';

/** The reactions the React menu offers; any shortcode the server holds is still shown. */
export const REACTIONS = ['👍', '🎉', '❤️', '👀', '🚀', '😄'] as const;

export interface CommentActions {
  viewer: Person;
  person: (id: string | null) => Person;
  onReact: (comment: Comment, reaction: string, on: boolean) => void;
  onReply: (parent: Comment, body: RichText) => Promise<unknown>;
  onEdit: (comment: Comment, body: RichText) => Promise<unknown>;
  /** "Create issue from this": opens the create form with the comment as its description. */
  onCreateIssue?: (comment: Comment) => void;
  size: 'page' | 'panel';
}

interface CommentItemProps extends CommentActions {
  comment: Comment;
  replies?: readonly Comment[];
}

/** A comment, its reactions and actions, and its replies indented under it. */
export function CommentItem({ comment, replies = [], ...actions }: CommentItemProps) {
  const { viewer, person, onReact, onReply, onEdit, onCreateIssue, size } = actions;
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const author = person(comment.authorId);
  const mine = comment.authorId === viewer.id;
  const reactions = Object.entries(comment.reactions).filter(([, people]) => people.length > 0);

  if (editing) {
    return (
      <CommentBox
        viewer={viewer}
        open
        initialBody={comment.body}
        submitLabel="Save"
        placeholder="Edit the comment"
        onSubmit={(body) => onEdit(comment, body)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ActivityItem
        size={size}
        person={{ name: author.name, ...(mine ? { hue: 'accent' as const } : {}) }}
        verb={comment.parentId ? 'replied' : 'commented'}
        when={`${formatRelative(comment.createdAt)}${comment.editedAt ? ' · edited' : ''}`}
        reactions={
          reactions.length > 0
            ? reactions.map(([emoji, people]) => {
                const reacted = people.includes(viewer.id);
                return (
                  <ReactionChip
                    key={emoji}
                    emoji={emoji}
                    count={people.length}
                    reacted={reacted}
                    aria-label={`${emoji} ${people.length}${reacted ? ', yours' : ''}`}
                    onToggle={() => onReact(comment, emoji, !reacted)}
                  />
                );
              })
            : undefined
        }
        actions={
          <>
            {!comment.parentId && (
              <ActivityAction onClick={() => setReplying(true)}>Reply</ActivityAction>
            )}
            <Menu
              widthClassName="w-auto"
              trigger={(props) => <ActivityAction {...props}>React</ActivityAction>}
            >
              <div className="flex gap-0.5">
                {REACTIONS.map((emoji) => (
                  <MenuItem
                    key={emoji}
                    onSelect={() =>
                      onReact(comment, emoji, !comment.reactions[emoji]?.includes(viewer.id))
                    }
                  >
                    <span aria-label={`React with ${emoji}`}>{emoji}</span>
                  </MenuItem>
                ))}
              </div>
            </Menu>
            {mine && <ActivityAction onClick={() => setEditing(true)}>Edit</ActivityAction>}
            {onCreateIssue && size === 'page' && (
              <ActivityAction onClick={() => onCreateIssue(comment)}>
                Create issue from this
              </ActivityAction>
            )}
          </>
        }
      >
        <RichTextView doc={comment.body} size="comment" />
      </ActivityItem>
      {(replies.length > 0 || replying) && (
        <div className="ml-9.5 flex flex-col gap-3">
          {replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} {...actions} />
          ))}
          {replying && (
            <CommentBox
              viewer={viewer}
              open
              label="Reply"
              placeholder="Reply…"
              submitLabel="Reply"
              onSubmit={(body) => onReply(comment, body)}
              onCancel={() => setReplying(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
