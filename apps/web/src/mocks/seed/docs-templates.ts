import { ago, uid } from './time.ts';

/** A template field as the page form asks for it. */
export interface MockTemplateField {
  key: string;
  label: string;
  kind: 'text' | 'user' | 'users' | 'date' | 'select';
  options?: string[];
}

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
    spaceId: null as string | null,
    key: key as string | null,
    name,
    description: description as string | null,
    icon: null as string | null,
    category: category as string | null,
    fields: [] as MockTemplateField[],
    isBuiltin: true,
    position: index,
    createdAt: ago(60 * 24 * 40),
    updatedAt: ago(60 * 24 * 40),
    archivedAt: null as string | null,
    createdBy: null as { id: string; name: string } | null,
    /** A template written in Settings › Docs keeps its body; built-ins draw one. */
    snapshot: null as object | null,
  }));
}
