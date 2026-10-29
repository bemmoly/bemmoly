import type { RequestContext } from '@bemmoly/core';
import { ForbiddenError, NotFoundError } from '@bemmoly/shared';
import type { CustomFieldDefinition, FieldValues } from '@bemmoly/shared/custom-fields';
import type {
  CreateProfileFieldBody,
  DirectoryQuery,
  DirectoryRow,
  Profile,
} from '../../../../shared/profiles.ts';
import {
  can,
  PROFILES_CAPABILITY,
  SETTINGS_CAPABILITY,
  requireDatabase,
  requireDirectory,
  requireUser,
  today,
  type PeopleServiceDeps,
} from '../common.ts';
import { happeningFor } from './happening.ts';

const ENTITY = 'person';

/**
 * The directory and profiles, read from the kernel's person record, which anyone signed in
 * may read (ADR 0050). Employment facts are written through the kernel's own API; this adds
 * what is happening to people and the company's fields on a profile.
 */
export function createDirectoryService(deps: PeopleServiceDeps) {
  async function withHappening(people: Parameters<typeof happeningFor>[1]) {
    const happening = await happeningFor(requireDatabase(deps), people, today(deps));
    return people.map((person) => ({ ...person, happening: happening.get(person.userId) ?? null }));
  }

  async function fieldsOf(ctx: RequestContext, userId: string) {
    const canEdit = requireUser(ctx) === userId || (await can(ctx, PROFILES_CAPABILITY));
    if (!deps.customFields) return { definitions: [], values: {}, canEdit: false };
    const [definitions, values] = await Promise.all([
      deps.customFields.list(ENTITY),
      deps.customFields.read(ctx.actor, ENTITY, [userId]),
    ]);
    const mine = values.get(userId) ?? {};
    // A field this viewer may not see comes back without a value; leave its label out too.
    const shown = definitions.filter(
      (field) => field.visibleTo.length === 0 || Object.hasOwn(mine, field.key),
    );
    return { definitions: shown, values: mine, canEdit };
  }

  return {
    async list(_ctx: RequestContext, query: DirectoryQuery): Promise<DirectoryRow[]> {
      const people = await requireDirectory(deps).list({
        ...(query.teamId ? { teamId: query.teamId } : {}),
        ...(query.locationId ? { locationId: query.locationId } : {}),
        ...(query.costCentreId ? { costCentreId: query.costCentreId } : {}),
        ...(query.includeLeft
          ? {}
          : { states: ['offer_accepted', 'active', 'on_leave', 'leaving'] as const }),
      });
      const needle = query.q?.toLowerCase();
      const found = needle
        ? people.filter(
            (person) =>
              person.name.toLowerCase().includes(needle) ||
              person.email.toLowerCase().includes(needle) ||
              (person.jobTitle ?? '').toLowerCase().includes(needle),
          )
        : people;
      return withHappening(found);
    },

    async profile(ctx: RequestContext, userId: string): Promise<Profile> {
      const directory = requireDirectory(deps);
      const person = await directory.get(userId);
      if (!person) throw new NotFoundError('That person has no record');
      const [[row], managers, reports, fields] = await Promise.all([
        withHappening([person]),
        directory.managerChain(userId),
        directory.reports(userId),
        fieldsOf(ctx, userId),
      ]);
      return { person: row!, managers, reports, fields };
    },

    /** The person edits their own fields; others need the profiles capability. */
    async updateFields(ctx: RequestContext, userId: string, values: FieldValues) {
      const me = requireUser(ctx);
      if (me !== userId && !(await can(ctx, PROFILES_CAPABILITY))) {
        throw new ForbiddenError('You can change your own profile fields only');
      }
      if (!(await requireDirectory(deps).get(userId))) {
        throw new NotFoundError('That person has no record');
      }
      if (!deps.customFields) throw new NotFoundError('Profile fields are not available');
      await deps.customFields.write(ctx.actor, ENTITY, userId, values, { mode: 'update' });
      return fieldsOf(ctx, userId);
    },

    /**
     * Every field for those who manage People's fields or edit anyone's profile; others see
     * only the fields open to everyone, so a restricted field's existence stays private.
     */
    async fieldDefinitions(ctx: RequestContext): Promise<CustomFieldDefinition[]> {
      if (!deps.customFields) return [];
      const all = await deps.customFields.list(ENTITY);
      const full = (await can(ctx, SETTINGS_CAPABILITY)) || (await can(ctx, PROFILES_CAPABILITY));
      return full ? all : all.filter((field) => field.visibleTo.length === 0);
    },

    /** The kernel checks `workspace.settings.manage` and validates the definition. */
    async createField(ctx: RequestContext, body: CreateProfileFieldBody) {
      if (!deps.customFields) throw new NotFoundError('Profile fields are not available');
      return deps.customFields.create(ctx.actor, ENTITY, {
        key: body.key,
        label: body.label,
        kind: body.kind,
        options: body.options ?? [],
        visibleTo: body.visibleTo ?? [],
        editableBy: body.editableBy ?? [],
      });
    },
  };
}

export type DirectoryService = ReturnType<typeof createDirectoryService>;
