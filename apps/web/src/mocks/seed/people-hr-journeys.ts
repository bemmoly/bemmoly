import type { CustomFieldDefinition } from '@bemmoly/shared/custom-fields';
import {
  addDays,
  type JourneyTask,
  type JourneyTemplate,
  type MockJourney,
} from './people-hr-types.ts';
import { ago, uid } from './time.ts';

const today = () => new Date().toISOString().slice(0, 10);

/** The onboarding and offboarding templates, and the joiner's onboarding under way. */
export function seedJourneys(
  lena: string,
  priya: string,
  rohan: string,
  maya: string,
  lenaStart: string,
) {
  const onboarding: JourneyTemplate = {
    id: uid(12201),
    name: 'Everyone joining',
    kind: 'onboarding',
    locationId: null,
    jobTitle: null,
    archived: false,
    tasks: [
      { title: 'Sign the offer and the contract', owner: { type: 'person' }, offsetDays: -14 },
      { title: 'Order a laptop', owner: { type: 'user', userId: rohan }, offsetDays: -10 },
      { title: 'Share bank details for payroll', owner: { type: 'person' }, offsetDays: -7 },
      { title: 'Plan the first week', owner: { type: 'manager' }, offsetDays: -3 },
      {
        title: 'Welcome with the People team',
        owner: { type: 'user', userId: maya },
        offsetDays: 0,
      },
      { title: 'First one-to-one', owner: { type: 'manager' }, offsetDays: 0 },
      { title: 'Pair on a starter issue', owner: { type: 'manager' }, offsetDays: 3 },
      { title: 'Probation review', owner: { type: 'manager' }, offsetDays: 90 },
    ],
  };
  const offboarding: JourneyTemplate = {
    id: uid(12202),
    name: 'Everyone leaving',
    kind: 'offboarding',
    locationId: null,
    jobTitle: null,
    archived: false,
    tasks: [
      { title: 'Hand over open work', owner: { type: 'person' }, offsetDays: -7 },
      { title: 'Exit conversation', owner: { type: 'user', userId: maya }, offsetDays: -3 },
      { title: 'Collect the laptop', owner: { type: 'manager' }, offsetDays: 0 },
    ],
  };
  const journey: MockJourney = {
    id: uid(12401),
    userId: lena,
    kind: 'onboarding',
    templateId: onboarding.id,
    templateName: onboarding.name,
    anchorDate: lenaStart,
    state: 'open',
    createdAt: ago(60 * 24 * 6),
  };
  const owners: Record<string, string> = { person: lena, manager: priya };
  const tasks: JourneyTask[] = onboarding.tasks.map((task, index) => {
    const due = addDays(lenaStart, task.offsetDays);
    const done = due < today();
    return {
      id: uid(12500 + index),
      journeyId: journey.id,
      title: task.title,
      ownerId: task.owner.type === 'user' ? task.owner.userId : (owners[task.owner.type] ?? null),
      dueDate: due,
      doneAt: done ? ago(60 * 24) : null,
      doneBy: done ? lena : null,
    };
  });
  return { templates: [onboarding, offboarding], journey, tasks };
}

/** Three profile fields: two for everyone, the emergency contact for admins only. */
export function seedFields(): CustomFieldDefinition[] {
  return [
    {
      id: uid(12601),
      moduleId: 'people',
      entityType: 'person',
      key: 'languages',
      label: 'Languages',
      description: null,
      kind: 'text',
      required: false,
      options: [],
      validation: {},
      defaultValue: null,
      visibleTo: [],
      editableBy: [],
      position: 0,
      archived: false,
    },
    {
      id: uid(12602),
      moduleId: 'people',
      entityType: 'person',
      key: 'shirt_size',
      label: 'T-shirt size',
      description: 'For the welcome pack',
      kind: 'select',
      required: false,
      options: [
        { value: 's', label: 'S' },
        { value: 'm', label: 'M' },
        { value: 'l', label: 'L' },
      ],
      validation: {},
      defaultValue: null,
      visibleTo: [],
      editableBy: [],
      position: 1,
      archived: false,
    },
    {
      id: uid(12603),
      moduleId: 'people',
      entityType: 'person',
      key: 'emergency_contact',
      label: 'Emergency contact',
      description: null,
      kind: 'text',
      required: false,
      options: [],
      validation: {},
      defaultValue: null,
      visibleTo: ['org_admin'],
      editableBy: [],
      position: 2,
      archived: false,
    },
  ];
}
