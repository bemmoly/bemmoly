import type {
  ApprovalDelegation,
  ApprovalFields,
  ApprovalRequest,
  ApprovalRequestPage,
  ApprovalSubject,
  ApproverRule,
  DecideApprovalBody,
  DelegationBody,
  ListApprovalsQuery,
  SaveWorkflowBody,
  StartApprovalInput,
  WithdrawApprovalBody,
} from '@bemmoly/shared/approvals';
import type { Actor } from './authz.ts';
import type { SqlExecutor } from './sql.ts';

/** What an approver rule is resolved against: the request as it starts a stage. */
export interface ApproverContext {
  requesterId: string;
  moduleId: string;
  subject: ApprovalSubject;
  fields: ApprovalFields;
}

/**
 * Turns one approver rule into user ids (ADR 0051). The engine drops the requester and
 * inactive people afterwards, so an implementation need not. The person record replaces the
 * default one, or only its `OrgLookup`.
 */
export interface ApproverResolver {
  /** `transaction` is the engine's open one; reads through it see the request's own writes. */
  resolve(
    rule: ApproverRule,
    context: ApproverContext,
    transaction?: SqlExecutor,
  ): Promise<string[]>;
}

/** Org-chart questions the default resolver cannot answer from users and roles alone. */
export interface OrgLookup {
  /** Managers above `userId`, nearest first, at most `levels` long. */
  managerChain(userId: string, levels: number, transaction?: SqlExecutor): Promise<string[]>;
  /** The owner of the request's cost centre: `fields.costCentre`, else the requester's own. */
  costCentreOwner(context: ApproverContext, transaction?: SqlExecutor): Promise<string | null>;
}

/**
 * The engine as modules call it. A module authorizes its own subject before `start`; the
 * engine authorizes deciding, withdrawing and reading by who is on the request.
 */
export interface Approvals {
  start(actor: Actor, input: StartApprovalInput): Promise<ApprovalRequest>;
  decide(actor: Actor, requestId: string, body: DecideApprovalBody): Promise<ApprovalRequest>;
  withdraw(actor: Actor, requestId: string, body?: WithdrawApprovalBody): Promise<ApprovalRequest>;
  get(actor: Actor, requestId: string): Promise<ApprovalRequest>;
  /** Waiting on the caller (`scope: 'waiting'`) or started by them, across modules. */
  list(actor: Actor, query?: ListApprovalsQuery): Promise<ApprovalRequestPage>;
  /** Every request a module opened on one subject, newest first; no person check. */
  forSubject(moduleId: string, subject: ApprovalSubject): Promise<ApprovalRequest[]>;
  /**
   * Saves a module's default workflow as version 1 when none exists; an existing one, with
   * whatever versions admins saved, is left as it is.
   */
  ensureWorkflow(input: SaveWorkflowBody): Promise<void>;
  delegation(actor: Actor): Promise<ApprovalDelegation | null>;
  setDelegation(actor: Actor, body: DelegationBody): Promise<ApprovalDelegation>;
  clearDelegation(actor: Actor): Promise<void>;
}
