import type { SqlExecutor } from './sql.ts';

/** The containers whose membership the kernel keeps: a module's projects and spaces. */
export type MembershipContainer = 'project' | 'space';

/** One person in a container, with the role that applies inside it. */
export interface ContainerMember {
  userId: string;
  name: string;
  email: string;
  /** `active`, `invited` or `deactivated`; a deactivated member keeps the row but has no access. */
  status: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  addedAt: string;
}

/** A role a container member can hold: every role of the roles matrix. */
export interface ContainerRole {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
}

export interface AddMembersInput {
  userIds?: readonly string[];
  /** Every current member of these teams is added. */
  teamIds?: readonly string[];
  /**
   * The role to add them with. Without one, people added through a team take
   * that team's default role, and everyone else the Member role.
   */
  roleId?: string;
}

/**
 * Who belongs to a project or space and with which role, the second layer of
 * authorization. Modules change membership through this and never write the
 * kernel's tables; the module checks its own capability and audits first.
 * Every call takes an optional transaction so the change commits with the
 * module's own rows. Deactivated people are never added.
 */
export interface ContainerMemberships {
  list(
    kind: MembershipContainer,
    containerId: string,
    transaction?: SqlExecutor,
  ): Promise<ContainerMember[]>;
  /** Adds the people not yet in the container; existing members keep their role. */
  add(
    kind: MembershipContainer,
    containerId: string,
    input: AddMembersInput,
    transaction?: SqlExecutor,
  ): Promise<ContainerMember[]>;
  /** The member after the change, or null when the person is not a member. */
  setRole(
    kind: MembershipContainer,
    containerId: string,
    userId: string,
    roleId: string,
    transaction?: SqlExecutor,
  ): Promise<ContainerMember | null>;
  /** False when the person was not a member. */
  remove(
    kind: MembershipContainer,
    containerId: string,
    userId: string,
    transaction?: SqlExecutor,
  ): Promise<boolean>;
  roles(transaction?: SqlExecutor): Promise<ContainerRole[]>;
}
