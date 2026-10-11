import { parseOrThrow } from '@bemmoly/shared';
import {
  AUTOMATION_ACTIONS,
  setFieldArgsSchema,
  updateIssueBodySchema,
  type SetFieldArgs,
  type UpdateIssueBody,
} from '../../../../../shared/index.ts';
import type { ActionDefinition } from '../contract.ts';

const CUSTOM = 'customFields.';

function bodyFor(args: SetFieldArgs): UpdateIssueBody {
  if (args.field.startsWith(CUSTOM)) {
    return parseOrThrow(updateIssueBodySchema, {
      customFields: { [args.field.slice(CUSTOM.length)]: args.value ?? null },
    });
  }
  return parseOrThrow(updateIssueBodySchema, { [args.field]: args.value ?? null });
}

const shown = (value: unknown) =>
  value === null || value === undefined || value === '' ? 'empty' : String(value);

export const setField: ActionDefinition<SetFieldArgs> = {
  name: AUTOMATION_ACTIONS.setField,
  label: 'Set a field',
  description: 'Sets priority, estimate, due date, title or a custom field',
  params: setFieldArgsSchema,
  async run(args, { ctx, issue, services }) {
    await services.issues.update(ctx, issue.key, bodyFor(args));
    return `Set ${args.field.replace(CUSTOM, '')} to ${shown(args.value)}`;
  },
};
