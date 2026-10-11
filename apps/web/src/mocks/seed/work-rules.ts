/*
 * The work module's rules registry as GET /work/workflow-rules sends it: one
 * entry per condition, validator and post-action, params as the JSON Schema
 * the server derives from each rule's zod schema. Kept in step by hand with
 * modules/work/server/src/services/workflow/rules (apps never import a module).
 */

const SCHEMA = 'https://json-schema.org/draft/2020-12/schema';

type Properties = Record<string, Record<string, unknown>>;

const object = (properties: Properties = {}, required: string[] = []) => ({
  $schema: SCHEMA,
  type: 'object',
  properties,
  ...(required.length > 0 ? { required } : {}),
});

const text = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength });

export interface MockRuleDefinition {
  name: string;
  kind: 'condition' | 'validator' | 'post_action';
  label: string;
  description: string;
  params: Record<string, unknown>;
  available: boolean;
}

export function seedWorkRules(): MockRuleDefinition[] {
  const rule = (
    name: string,
    kind: MockRuleDefinition['kind'],
    label: string,
    description: string,
    params = object(),
  ): MockRuleDefinition => ({ name, kind, label, description, params, available: true });
  return [
    rule(
      'field_set',
      'condition',
      'Field is set',
      'The issue has a value in the named field',
      object({ field: text(60) }, ['field']),
    ),
    rule('subtasks_done', 'condition', 'Subtasks are done', 'Every subtask is in a done status'),
    rule(
      'linked_issues_resolved',
      'condition',
      'Linked issues are resolved',
      'Every issue that blocks this one is in a done status',
    ),
    rule(
      'lql_query',
      'condition',
      'Issue matches a query',
      'The issue matches the given LQL query',
      object({ query: text(4000) }, ['query']),
    ),
    rule(
      'required_fields',
      'validator',
      'Required fields',
      'The named fields must have a value, from the form or already on the issue',
      object({ fields: { minItems: 1, maxItems: 20, type: 'array', items: text(60) } }, ['fields']),
    ),
    rule('estimate_set', 'validator', 'Estimate is set', 'The issue has a positive estimate'),
    rule(
      'comment_required',
      'validator',
      'Comment required',
      'The move must carry a comment of at least the given length',
      object({ minLength: { default: 1, type: 'integer', minimum: 1, maximum: 2000 } }),
    ),
    rule(
      'assign_to_reporter',
      'post_action',
      'Assign to reporter',
      'Sets the assignee to the issue reporter',
    ),
    rule('clear_sprint', 'post_action', 'Clear sprint', 'Removes the issue from its sprint'),
    rule(
      'set_resolution',
      'post_action',
      'Set resolution',
      'Marks the issue resolved now, or clears its resolution',
      object({ resolved: { default: true, type: 'boolean' } }),
    ),
    rule(
      'fire_automation',
      'post_action',
      'Fire automation',
      'Runs an automation rule with the issue as input',
      object({ ruleId: { type: 'string', format: 'uuid' } }, ['ruleId']),
    ),
  ];
}
