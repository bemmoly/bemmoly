import type { ApprovalRequest } from '@bemmoly/shared/approvals';
import type { CustomFieldDefinition } from '@bemmoly/shared/custom-fields';
import type { CostCentre, Location, Person } from '@bemmoly/shared/people';

/*
 * The shapes People's server answers with (modules/people/shared), restated here because the
 * shell never imports a module, mocks included.
 */
export type LeaveKind = 'annual' | 'sick' | 'parental' | 'unpaid' | 'other';
export interface Level {
  id: string;
  name: string;
  description: string | null;
  position: number;
}
export interface LeavePolicy {
  id: string;
  name: string;
  kind: LeaveKind;
  locationId: string | null;
  allowanceDays: number | null;
  carryOverDays: number;
  needsApproval: boolean;
  archived: boolean;
}
export interface LeaveRequest {
  id: string;
  userId: string;
  policyId: string;
  kind: LeaveKind;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  days: number;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  approvalRequestId: string | null;
  createdAt: string;
}
export type TaskOwner = { type: 'person' } | { type: 'manager' } | { type: 'user'; userId: string };
export interface JourneyTemplate {
  id: string;
  name: string;
  kind: 'onboarding' | 'offboarding';
  locationId: string | null;
  jobTitle: string | null;
  tasks: { title: string; owner: TaskOwner; offsetDays: number }[];
  archived: boolean;
}
export interface JourneyTask {
  id: string;
  journeyId: string;
  title: string;
  ownerId: string | null;
  dueDate: string;
  doneAt: string | null;
  doneBy: string | null;
}

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
export const addDays = (date: string, days: number) =>
  new Date(utc(date) + days * DAY).toISOString().slice(0, 10);
/** Working days in the range, as People's server counts them. */
export function leaveDays(start: string, end: string, halfDay = false): number {
  let days = 0;
  for (let at = utc(start); at <= utc(end); at += DAY) {
    const dow = new Date(at).getUTCDay();
    if (dow !== 0 && dow !== 6) days += 1;
  }
  return halfDay && days > 0 ? days - 0.5 : days;
}

export interface MockJourney {
  id: string;
  userId: string;
  kind: 'onboarding' | 'offboarding';
  templateId: string | null;
  templateName: string;
  anchorDate: string;
  state: 'open' | 'done' | 'cancelled';
  createdAt: string;
}

export interface MockPeople {
  persons: Person[];
  locations: Location[];
  costCentres: CostCentre[];
  levels: Level[];
  policies: LeavePolicy[];
  requests: LeaveRequest[];
  approvals: ApprovalRequest[];
  templates: JourneyTemplate[];
  journeys: MockJourney[];
  tasks: JourneyTask[];
  fields: CustomFieldDefinition[];
  values: Record<string, Record<string, unknown>>;
}
