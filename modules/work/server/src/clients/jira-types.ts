/*
 * The parts of Jira's REST responses the importer reads, for Cloud (v3) and Data Center (v2).
 * They differ mostly in people (accountId on Cloud, name and key on Data Center) and in text
 * (the document format on Cloud, wiki markup on Data Center); both are kept as unknown here
 * and narrowed where they are read.
 */

export type JiraDeployment = 'cloud' | 'datacenter';

export interface JiraUser {
  accountId?: string;
  name?: string;
  key?: string;
  emailAddress?: string;
  displayName?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  projectTypeKey?: string;
  style?: string;
  lead?: JiraUser;
  issueTypes?: JiraIssueType[];
  /** Cloud's expand=insight, marked experimental in Jira's API reference. */
  insight?: { totalIssueCount?: number };
}

export interface JiraIssueType {
  id: string;
  name: string;
  subtask?: boolean;
  hierarchyLevel?: number;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory?: { key?: string };
}

export interface JiraTypeStatuses {
  id: string;
  name: string;
  statuses: JiraStatus[];
}

export interface JiraField {
  id: string;
  name: string;
  custom: boolean;
  schema?: { type?: string; items?: string; custom?: string; system?: string };
}

export interface JiraVersion {
  id: string;
  name: string;
  description?: string;
  released?: boolean;
  archived?: boolean;
  releaseDate?: string;
}

export interface JiraComponent {
  id: string;
  name: string;
  description?: string;
  lead?: JiraUser;
}

export interface JiraComment {
  id: string;
  author?: JiraUser;
  body?: unknown;
  created?: string;
  updated?: string;
}

export interface JiraAttachment {
  id: string;
  filename: string;
  mimeType?: string;
  size?: number;
  content?: string;
  author?: JiraUser;
  created?: string;
}

export interface JiraIssueLink {
  id: string;
  type?: { name?: string; inward?: string; outward?: string };
  inwardIssue?: { id: string; key: string };
  outwardIssue?: { id: string; key: string };
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: Record<string, unknown> & {
    summary?: string;
    description?: unknown;
    issuetype?: JiraIssueType;
    status?: JiraStatus;
    priority?: { name?: string } | null;
    assignee?: JiraUser | null;
    reporter?: JiraUser | null;
    parent?: { id: string; key: string } | null;
    labels?: string[];
    fixVersions?: { id: string }[];
    components?: { id: string }[];
    duedate?: string | null;
    created?: string;
    updated?: string;
    resolutiondate?: string | null;
    comment?: { comments?: JiraComment[]; total?: number; maxResults?: number };
    attachment?: JiraAttachment[];
    issuelinks?: JiraIssueLink[];
  };
}

export interface JiraBoard {
  id: number;
  name: string;
  type?: string;
}

export interface JiraBoardColumn {
  name: string;
  statuses: { id: string }[];
}

export interface JiraSprint {
  id: number;
  name: string;
  state?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  originBoardId?: number;
}

export interface JiraIssuePage {
  issues: JiraIssue[];
  /** The cursor of the next page, or null on the last. */
  next: string | null;
}
