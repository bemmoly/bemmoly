import type {
  BoardLaneKind,
  CardColorRule,
  CardField,
  EstimationUnit,
  WorkMethod,
} from '@bemmoly/module-work/shared';

/** What Board settings call each setting value, in the mock's words. */

export const LANE_LABELS: Record<BoardLaneKind, string> = {
  none: 'None',
  epic: 'Epic',
  assignee: 'Assignee',
  priority: 'Priority',
  type: 'Issue type',
  query: 'Custom queries',
};

export const CARD_FIELD_LABELS: Record<CardField, string> = {
  type: 'Issue type',
  key: 'Issue key',
  priority: 'Priority',
  labels: 'Labels',
  estimate: 'Estimate',
  assignee: 'Assignee',
  docs: 'Linked docs',
  blocked: 'Blocked banner',
  due: 'Due date',
  subtasks: 'Subtask progress',
  reporter: 'Reporter',
  created: 'Created',
};

/** The right-hand note of each card field row: how the card shows it. */
export const CARD_FIELD_KINDS: Record<CardField, string> = {
  type: 'icon',
  key: 'PLT-211',
  priority: 'icon',
  labels: 'chips',
  estimate: 'badge',
  assignee: 'avatar',
  docs: 'link',
  blocked: 'banner',
  due: 'text',
  subtasks: 'text',
  reporter: 'avatar',
  created: 'text',
};

export const COLOR_RULE_LABELS: Record<CardColorRule, string> = {
  none: 'None',
  priority: 'By priority',
  type: 'By issue type',
  epic: 'By epic',
};

export const ESTIMATE_LABELS: Record<EstimationUnit, string> = {
  points: 'Story points',
  hours: 'Hours',
  tshirt: 'T-shirt',
  none: 'No estimation',
};

export const METHOD_LABELS: Record<WorkMethod, string> = { scrum: 'Scrum', kanban: 'Kanban' };
