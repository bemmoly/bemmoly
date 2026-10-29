import type { ApprovalRequest } from '@bemmoly/shared/approvals';
import type { Person } from '@bemmoly/shared/people';
import {
  addDays,
  leaveDays,
  type LeavePolicy,
  type LeaveRequest,
  type MockPeople,
} from './people-hr-types.ts';
import { TEAM_IDS, USER_IDS } from './people.ts';
import { seedFields, seedJourneys } from './people-hr-journeys.ts';
import { ago, uid } from './time.ts';

export * from './people-hr-types.ts';

/*
 * People's demo company: a small org across Bengaluru and Berlin, with time off booked and
 * waiting, a joiner two weeks out and her onboarding under way. Dates move with today so the
 * screens always show something current.
 */

const today = () => new Date().toISOString().slice(0, 10);
/** The next Monday on or after `days` from today, so a start date is a working day. */
const mondayFrom = (days: number) => {
  const date = addDays(today(), days);
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, dow === 1 ? 0 : (8 - dow) % 7);
};
const stamp = ago(60 * 24 * 30);

export const LOCATION_IDS = { bengaluru: uid(12001), berlin: uid(12002) } as const;
export const COST_CENTRE_IDS = { platform: uid(12011), design: uid(12012) } as const;
const POLICY_IDS = { annual: uid(12021), berlin: uid(12022), sick: uid(12023) } as const;

function person(
  key: keyof typeof USER_IDS,
  name: string,
  email: string,
  fields: Partial<Person>,
): Person {
  return {
    userId: USER_IDS[key],
    name,
    email,
    state: 'active',
    startDate: '2024-03-04',
    endDate: null,
    jobTitle: null,
    level: null,
    managerId: null,
    teamId: null,
    locationId: LOCATION_IDS.bengaluru,
    costCentreId: COST_CENTRE_IDS.platform,
    createdAt: stamp,
    updatedAt: stamp,
    ...fields,
  };
}

function request(
  id: number,
  userId: string,
  policy: LeavePolicy,
  start: string,
  end: string,
  status: LeaveRequest['status'],
  note: string | null = null,
): LeaveRequest {
  return {
    id: uid(id),
    userId,
    policyId: policy.id,
    kind: policy.kind,
    startDate: start,
    endDate: end,
    halfDay: false,
    days: leaveDays(start, end),
    note,
    status,
    approvalRequestId: status === 'pending' ? uid(id + 100) : null,
    createdAt: ago(60 * 26),
  };
}

export function seedPeopleHr(): MockPeople {
  const { rohan, priya, aisha, jonas, lena, maya } = USER_IDS;
  const persons = [
    person('rohan', 'Rohan S.', 'rohan@acmelabs.dev', {
      jobTitle: 'Chief technology officer',
      level: 'L7',
      teamId: TEAM_IDS.leadership,
      startDate: '2021-06-01',
    }),
    person('priya', 'Priya N.', 'priya@acmelabs.dev', {
      jobTitle: 'Engineering manager',
      level: 'L6',
      managerId: rohan,
      teamId: TEAM_IDS.platform,
    }),
    person('aisha', 'Aisha K.', 'aisha@acmelabs.dev', {
      jobTitle: 'Backend engineer',
      level: 'L4',
      managerId: rohan,
      teamId: TEAM_IDS.platform,
    }),
    person('jonas', 'Jonas M.', 'jonas@acmelabs.dev', {
      jobTitle: 'Mobile engineer',
      level: 'L4',
      managerId: priya,
      teamId: TEAM_IDS.mobile,
      locationId: LOCATION_IDS.berlin,
      costCentreId: COST_CENTRE_IDS.design,
    }),
    person('lena', 'Lena T.', 'lena@acmelabs.dev', {
      state: 'offer_accepted',
      startDate: mondayFrom(10),
      jobTitle: 'Product designer',
      level: 'L3',
      managerId: priya,
      teamId: TEAM_IDS.design,
      locationId: LOCATION_IDS.berlin,
      costCentreId: COST_CENTRE_IDS.design,
    }),
    person('maya', 'Maya K.', 'maya@acmelabs.dev', {
      jobTitle: 'Head of People',
      level: 'L6',
      managerId: rohan,
      teamId: TEAM_IDS.people,
    }),
  ];
  const policies: LeavePolicy[] = [
    {
      id: POLICY_IDS.annual,
      name: 'Annual leave',
      kind: 'annual',
      locationId: null,
      allowanceDays: 21,
      carryOverDays: 8,
      needsApproval: true,
      archived: false,
    },
    {
      id: POLICY_IDS.berlin,
      name: 'Annual leave, Germany',
      kind: 'annual',
      locationId: LOCATION_IDS.berlin,
      allowanceDays: 28,
      carryOverDays: 5,
      needsApproval: true,
      archived: false,
    },
    {
      id: POLICY_IDS.sick,
      name: 'Sick leave',
      kind: 'sick',
      locationId: null,
      allowanceDays: null,
      carryOverDays: 0,
      needsApproval: false,
      archived: false,
    },
  ];
  const [annual, berlin, sick] = policies as [LeavePolicy, LeavePolicy, LeavePolicy];
  const requests = [
    request(12101, jonas, berlin, addDays(today(), -1), addDays(today(), 3), 'approved'),
    request(
      12102,
      aisha,
      annual,
      mondayFrom(14),
      addDays(mondayFrom(14), 4),
      'pending',
      'Family wedding in Mysuru',
    ),
    request(12103, rohan, annual, mondayFrom(21), addDays(mondayFrom(21), 1), 'approved'),
    request(12104, priya, sick, addDays(today(), -12), addDays(today(), -11), 'approved'),
    request(12105, rohan, annual, '2026-03-09', '2026-03-13', 'approved'),
  ];
  const pending = requests[1]!;
  const approvals: ApprovalRequest[] = [
    {
      id: pending.approvalRequestId!,
      moduleId: 'people',
      workflowKey: 'people.leave',
      workflowVersion: 1,
      subject: { kind: 'leave_request', id: pending.id },
      title: `Aisha K. · Annual leave, ${pending.startDate} to ${pending.endDate}`,
      url: `/people/time-off?request=${pending.id}`,
      requesterId: aisha,
      fields: { days: pending.days, kind: 'annual' },
      status: 'pending',
      currentStage: 0,
      autoApproved: false,
      tasks: [
        {
          id: uid(12301),
          stage: 0,
          approverId: rohan,
          onBehalfOf: null,
          status: 'pending',
          escalation: false,
          comment: null,
          dueAt: null,
          decidedAt: null,
        },
      ],
      createdAt: pending.createdAt,
      updatedAt: pending.createdAt,
      closedAt: null,
    },
  ];
  const { templates, journey, tasks } = seedJourneys(
    lena,
    priya,
    rohan,
    maya,
    persons[4]!.startDate!,
  );
  const fields = seedFields();
  return {
    persons,
    locations: [
      {
        id: LOCATION_IDS.bengaluru,
        name: 'Bengaluru',
        timezone: 'Asia/Kolkata',
        countryCode: 'IN',
        holidayCalendar: 'in-ka',
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: LOCATION_IDS.berlin,
        name: 'Berlin',
        timezone: 'Europe/Berlin',
        countryCode: 'DE',
        holidayCalendar: 'de-be',
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    costCentres: [
      {
        id: COST_CENTRE_IDS.platform,
        code: 'IN-PLT',
        name: 'Platform',
        ownerUserId: priya,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: COST_CENTRE_IDS.design,
        code: 'DE-DSN',
        name: 'Design',
        ownerUserId: rohan,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    levels: ['L3', 'L4', 'L5', 'L6', 'L7'].map((name, position) => ({
      id: uid(12031 + position),
      name,
      description: null,
      position,
    })),
    policies,
    requests,
    approvals,
    templates,
    journeys: [journey],
    tasks,
    fields,
    values: {
      [aisha]: { languages: 'English, Hindi, Kannada', shirt_size: 'm' },
      [jonas]: { languages: 'German, English' },
    },
  };
}
