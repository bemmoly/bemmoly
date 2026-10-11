import {
  addCommentArgsSchema,
  AUTOMATION_ACTIONS,
  type AddCommentArgs,
} from '../../../../../shared/index.ts';
import type { ActionDefinition } from '../contract.ts';

/** Plain text into the comment document, one paragraph per line. */
function document(text: string) {
  return {
    type: 'doc' as const,
    content: text.split('\n').map((line) => ({
      type: 'paragraph',
      ...(line ? { content: [{ type: 'text', text: line }] } : {}),
    })),
  };
}

export const addComment: ActionDefinition<AddCommentArgs> = {
  name: AUTOMATION_ACTIONS.addComment,
  label: 'Add a comment',
  description: 'Comments on the issue',
  params: addCommentArgsSchema,
  async run(args, { ctx, issue, services }) {
    await services.comments.create(ctx, issue.key, { body: document(args.body) });
    return 'Added a comment';
  },
};
