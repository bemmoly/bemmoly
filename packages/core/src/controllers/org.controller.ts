import { idParamsSchema, NotFoundError, parseOrThrow } from '@bemmoly/shared';
import {
  createCostCentreSchema,
  createLocationSchema,
  createPersonSchema,
  listPeopleQuerySchema,
  personParamsSchema,
  reportsQuerySchema,
  updateCostCentreSchema,
  updateLocationSchema,
  updatePersonSchema,
  type CostCentre,
  type Location,
  type PeoplePage,
  type Person,
} from '@bemmoly/shared/people';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ActorResolver } from '../middlewares/actor.ts';
import type { People } from '../services/people/index.ts';

export type { People };

const userIdOf = (request: FastifyRequest) =>
  parseOrThrow(personParamsSchema, request.params).userId;
const idOf = (request: FastifyRequest) => parseOrThrow(idParamsSchema, request.params).id;

/** The person record, locations and cost centres (ADR 0050). Reads need only a sign-in. */
export function createOrgController(people: People, actorOf: ActorResolver) {
  const { directory, records, org } = people;
  return {
    async list(request: FastifyRequest): Promise<PeoplePage> {
      await actorOf(request);
      return records.list(parseOrThrow(listPeopleQuerySchema, request.query));
    },
    async get(request: FastifyRequest): Promise<Person> {
      await actorOf(request);
      const person = await directory.get(userIdOf(request));
      if (!person) throw new NotFoundError('The person was not found');
      return person;
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<Person> {
      const body = parseOrThrow(createPersonSchema, request.body);
      const person = await records.create(await actorOf(request), body);
      reply.code(201);
      return person;
    },
    async update(request: FastifyRequest): Promise<Person> {
      const body = parseOrThrow(updatePersonSchema, request.body);
      return records.update(await actorOf(request), userIdOf(request), body);
    },
    async managers(request: FastifyRequest): Promise<{ items: Person[] }> {
      await actorOf(request);
      return { items: await directory.managerChain(userIdOf(request)) };
    },
    async reports(request: FastifyRequest): Promise<{ items: Person[] }> {
      await actorOf(request);
      const { all } = parseOrThrow(reportsQuerySchema, request.query);
      return { items: await directory.reports(userIdOf(request), { all }) };
    },

    async listLocations(request: FastifyRequest): Promise<{ items: Location[] }> {
      await actorOf(request);
      return { items: await org.listLocations() };
    },
    async getLocation(request: FastifyRequest): Promise<Location> {
      await actorOf(request);
      return org.getLocation(idOf(request));
    },
    async createLocation(request: FastifyRequest, reply: FastifyReply): Promise<Location> {
      const body = parseOrThrow(createLocationSchema, request.body);
      const location = await org.createLocation(await actorOf(request), body);
      reply.code(201);
      return location;
    },
    async updateLocation(request: FastifyRequest): Promise<Location> {
      const body = parseOrThrow(updateLocationSchema, request.body);
      return org.updateLocation(await actorOf(request), idOf(request), body);
    },
    async removeLocation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await org.removeLocation(await actorOf(request), idOf(request));
      reply.code(204).send();
    },

    async listCostCentres(request: FastifyRequest): Promise<{ items: CostCentre[] }> {
      await actorOf(request);
      return { items: await org.listCostCentres() };
    },
    async getCostCentre(request: FastifyRequest): Promise<CostCentre> {
      await actorOf(request);
      return org.getCostCentre(idOf(request));
    },
    async createCostCentre(request: FastifyRequest, reply: FastifyReply): Promise<CostCentre> {
      const body = parseOrThrow(createCostCentreSchema, request.body);
      const centre = await org.createCostCentre(await actorOf(request), body);
      reply.code(201);
      return centre;
    },
    async updateCostCentre(request: FastifyRequest): Promise<CostCentre> {
      const body = parseOrThrow(updateCostCentreSchema, request.body);
      return org.updateCostCentre(await actorOf(request), idOf(request), body);
    },
    async removeCostCentre(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await org.removeCostCentre(await actorOf(request), idOf(request));
      reply.code(204).send();
    },
  };
}

export type OrgController = ReturnType<typeof createOrgController>;
