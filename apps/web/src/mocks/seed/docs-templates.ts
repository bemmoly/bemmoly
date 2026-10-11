import { ago, uid } from './time.ts';

/** The built-in templates as the template list returns them. */
export function seedDocsTemplates() {
  const names: ReadonlyArray<readonly [string, string, string, string]> = [
    [
      'rfc',
      'RFC',
      'Propose a change, weigh the alternatives and record the decision.',
      'engineering',
    ],
    ['meeting-notes', 'Meeting notes', 'Agenda, notes, decisions and action items.', 'team'],
    [
      'postmortem',
      'Postmortem',
      'A blameless account of an incident and the fixes it led to.',
      'engineering',
    ],
    [
      'product-spec',
      'Product spec',
      'The problem, the users, the requirements and the launch plan.',
      'product',
    ],
    [
      'runbook',
      'Runbook',
      'Step-by-step response for an alert or a routine operation.',
      'engineering',
    ],
    [
      'decision-log',
      'Decision log',
      'One entry per decision, newest first, with its context.',
      'team',
    ],
  ];
  return names.map(([key, name, description, category], index) => ({
    id: uid(5200 + index),
    spaceId: null,
    key,
    name,
    description,
    icon: null,
    category,
    fields: [],
    isBuiltin: true,
    position: index,
    createdAt: ago(60 * 24 * 40),
    updatedAt: ago(60 * 24 * 40),
  }));
}
