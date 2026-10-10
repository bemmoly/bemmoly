import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import {
  addSpaceMembersBodySchema,
  addSpaceMembersResponseSchema,
  putSpaceMemberBodySchema,
  spaceMemberSchema,
  spaceMembersResponseSchema,
  type AddSpaceMembersBody,
} from '../../../shared/members.ts';
import { DOCS_BASE } from '../api/pages.ts';

/**
 * The people of a space. `list` carries each person's role, whether they
 * came in as a member or as an org admin, and canReview: the reviewer picker
 * offers exactly the people with canReview, which the server checks again.
 */
export function docsMembersEndpoints(http: Http) {
  const members = (ref: string, rest = '') => `${DOCS_BASE}/spaces/${enc(ref)}/members${rest}`;
  return {
    members: {
      list: async (spaceRef: string) => http.request(members(spaceRef), spaceMembersResponseSchema),
      add: async (spaceRef: string, body: AddSpaceMembersBody) =>
        http.request(members(spaceRef), addSpaceMembersResponseSchema, {
          method: 'POST',
          body: validated(addSpaceMembersBodySchema, body),
        }),
      /** Adds the person with the role, or changes a member's role. */
      put: async (spaceRef: string, userId: string, roleId: string) =>
        http.request(members(spaceRef, `/${enc(userId)}`), spaceMemberSchema, {
          method: 'PUT',
          body: validated(putSpaceMemberBodySchema, { roleId }),
        }),
      remove: async (spaceRef: string, userId: string) =>
        http.send(members(spaceRef, `/${enc(userId)}`), { method: 'DELETE' }),
    },
  };
}
