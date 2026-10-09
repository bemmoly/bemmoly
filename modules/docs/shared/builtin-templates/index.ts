import type { PmNode } from './builders.ts';
import { POSTMORTEM, RFC, RUNBOOK } from './engineering.ts';
import { DECISION_LOG, MEETING_NOTES, PRODUCT_SPEC } from './product.ts';

export type { PmNode } from './builders.ts';

export interface TemplateFieldDefinition {
  key: string;
  label: string;
  kind: 'text' | 'user' | 'users' | 'date' | 'select';
  options?: string[];
}

export interface BuiltinTemplate {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: 'engineering' | 'product' | 'team';
  fields: TemplateFieldDefinition[];
  snapshot: PmNode;
}

/** The six templates the tech design names, in the order the Docs home lists them. */
export const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [
  {
    key: 'rfc',
    name: 'RFC',
    description: 'Propose a change, weigh the alternatives and record the decision.',
    icon: 'file-text',
    category: 'engineering',
    fields: [
      { key: 'status', label: 'Status', kind: 'select', options: ['Draft', 'Review', 'Final'] },
      { key: 'deciders', label: 'Deciders', kind: 'users' },
    ],
    snapshot: RFC,
  },
  {
    key: 'meeting-notes',
    name: 'Meeting notes',
    description: 'Agenda, notes, decisions and action items.',
    icon: 'users',
    category: 'team',
    fields: [
      { key: 'date', label: 'Date', kind: 'date' },
      { key: 'attendees', label: 'Attendees', kind: 'users' },
    ],
    snapshot: MEETING_NOTES,
  },
  {
    key: 'postmortem',
    name: 'Postmortem',
    description: 'A blameless account of an incident and the fixes it led to.',
    icon: 'alert-triangle',
    category: 'engineering',
    fields: [
      { key: 'severity', label: 'Severity', kind: 'select', options: ['SEV-1', 'SEV-2', 'SEV-3'] },
      { key: 'commander', label: 'Incident commander', kind: 'user' },
    ],
    snapshot: POSTMORTEM,
  },
  {
    key: 'product-spec',
    name: 'Product spec',
    description: 'The problem, the users, the requirements and the launch plan.',
    icon: 'layout',
    category: 'product',
    fields: [
      { key: 'owner', label: 'Product owner', kind: 'user' },
      { key: 'release', label: 'Target release', kind: 'text' },
    ],
    snapshot: PRODUCT_SPEC,
  },
  {
    key: 'runbook',
    name: 'Runbook',
    description: 'Step-by-step response for an alert or a routine operation.',
    icon: 'terminal',
    category: 'engineering',
    fields: [{ key: 'service', label: 'Service', kind: 'text' }],
    snapshot: RUNBOOK,
  },
  {
    key: 'decision-log',
    name: 'Decision log',
    description: 'One entry per decision, newest first, with its context and consequences.',
    icon: 'git-commit',
    category: 'team',
    fields: [{ key: 'area', label: 'Area', kind: 'text' }],
    snapshot: DECISION_LOG,
  },
];
