import type { FastifyRequest } from 'fastify';
import type { Actor } from './authz.ts';

/**
 * Resolves the actor of a request from its session cookie or API token, or
 * rejects with a 401 (`unauthenticated`). Routes call it before their controller.
 */
export type AuthenticateRequest = (request: FastifyRequest) => Promise<Actor>;
