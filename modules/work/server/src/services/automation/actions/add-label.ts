import {
  addLabelArgsSchema,
  AUTOMATION_ACTIONS,
  type AddLabelArgs,
} from '../../../../../shared/index.ts';
import type { ActionDefinition } from '../contract.ts';

/** Labels belong to a project, so a global rule names one and each project gets its own. */
export const addLabel: ActionDefinition<AddLabelArgs> = {
  name: AUTOMATION_ACTIONS.addLabel,
  label: 'Add a label',
  description: 'Adds a label by name, making it in the project when it does not exist yet',
  params: addLabelArgsSchema,
  async run(args, { ctx, issue, services }) {
    const projectKey = issue.key.slice(0, issue.key.lastIndexOf('-'));
    const wanted = args.label.toLowerCase();
    const found = await services.labels.list(ctx, projectKey, { q: args.label, limit: 50 });
    const label =
      found.items.find((item) => item.name.toLowerCase() === wanted) ??
      (await services.labels.create(ctx, projectKey, { name: args.label }));
    if (issue.labelIds.includes(label.id)) return `Already labelled ${label.name}`;
    await services.issues.update(ctx, issue.key, { labelIds: [...issue.labelIds, label.id] });
    return `Added the label ${label.name}`;
  },
};
