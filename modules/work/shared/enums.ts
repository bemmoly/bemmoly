import { z } from 'zod';

/*
 * Every closed set the Work screens show, read from the Board Settings, Workflow
 * and Issue mocks. The changelog's CHECK constraints list the same values.
 */

export const WORK_METHODS = ['scrum', 'kanban'] as const;
export const workMethodSchema = z.enum(WORK_METHODS);
export type WorkMethod = z.infer<typeof workMethodSchema>;

export const ESTIMATION_UNITS = ['points', 'hours', 'tshirt', 'none'] as const;
export const estimationUnitSchema = z.enum(ESTIMATION_UNITS);
export type EstimationUnit = z.infer<typeof estimationUnitSchema>;

export const ISSUE_TYPE_LEVELS = ['epic', 'standard', 'subtask'] as const;
export const issueTypeLevelSchema = z.enum(ISSUE_TYPE_LEVELS);
export type IssueTypeLevel = z.infer<typeof issueTypeLevelSchema>;

export const FIELD_KINDS = [
  'text',
  'richtext',
  'number',
  'select',
  'multiselect',
  'user',
  'date',
  'datetime',
  'url',
  'doc',
] as const;
export const fieldKindSchema = z.enum(FIELD_KINDS);
export type FieldKind = z.infer<typeof fieldKindSchema>;

export const STATUS_CATEGORIES = ['todo', 'in_progress', 'done'] as const;
export const statusCategorySchema = z.enum(STATUS_CATEGORIES);
export type StatusCategory = z.infer<typeof statusCategorySchema>;

export const ISSUE_LINK_KINDS = ['blocks', 'relates', 'duplicates'] as const;
export const issueLinkKindSchema = z.enum(ISSUE_LINK_KINDS);
export type IssueLinkKind = z.infer<typeof issueLinkKindSchema>;

/** Highest first, the order the Board Settings mock gives priority lanes. */
export const ISSUE_PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'] as const;
export const issuePrioritySchema = z.enum(ISSUE_PRIORITIES);
export type IssuePriority = z.infer<typeof issuePrioritySchema>;

export const SPRINT_STATES = ['future', 'active', 'closed'] as const;
export const sprintStateSchema = z.enum(SPRINT_STATES);
export type SprintState = z.infer<typeof sprintStateSchema>;

export const VERSION_STATUSES = ['unreleased', 'released', 'archived'] as const;
export const versionStatusSchema = z.enum(VERSION_STATUSES);
export type VersionStatus = z.infer<typeof versionStatusSchema>;

export const BOARD_LANE_KINDS = ['none', 'epic', 'assignee', 'priority', 'type', 'query'] as const;
export const boardLaneKindSchema = z.enum(BOARD_LANE_KINDS);
export type BoardLaneKind = z.infer<typeof boardLaneKindSchema>;

export const CARD_COLOR_RULES = ['none', 'priority', 'type', 'epic'] as const;
export const cardColorRuleSchema = z.enum(CARD_COLOR_RULES);
export type CardColorRule = z.infer<typeof cardColorRuleSchema>;

export const AUTOMATION_RUN_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const;
export const automationRunStatusSchema = z.enum(AUTOMATION_RUN_STATUSES);
export type AutomationRunStatus = z.infer<typeof automationRunStatusSchema>;
