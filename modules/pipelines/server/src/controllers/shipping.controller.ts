import { contextOf } from '@bemmoly/core';
import { parseOrThrow, ProviderError } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  deploymentParamsSchema,
  listDeploymentsQuerySchema,
  resumeDeploymentBodySchema,
  rollbackBodySchema,
} from '../../../shared/deployments.ts';
import {
  approvalBodySchema,
  cancelPromotionBodySchema,
  createPromotionBodySchema,
  freezeOverrideBodySchema,
  listPromotionsQuerySchema,
  promotionParamsSchema,
  promotionPreviewQuerySchema,
} from '../../../shared/promotions.ts';
import type { ShippingService } from '../services/shipping/index.ts';

/** Promotions, approvals and deployments: validate, call one service function, shape. */
export function createShippingController(service: ShippingService | undefined) {
  const shipping = () => {
    if (!service) throw new ProviderError('Pipelines needs the database');
    return service;
  };
  const id = (request: FastifyRequest) => parseOrThrow(promotionParamsSchema, request.params).id;
  const deployment = (request: FastifyRequest) =>
    parseOrThrow(deploymentParamsSchema, request.params).id;

  return {
    listPromotions: (request: FastifyRequest) =>
      shipping().listPromotions(
        contextOf(request),
        parseOrThrow(listPromotionsQuerySchema, request.query),
      ),
    previewPromotion: (request: FastifyRequest) =>
      shipping().previewPromotion(
        contextOf(request),
        parseOrThrow(promotionPreviewQuerySchema, request.query),
      ),
    getPromotion: (request: FastifyRequest) =>
      shipping().getPromotion(contextOf(request), id(request)),
    async requestPromotion(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createPromotionBodySchema, request.body);
      const { promotion, created } = await shipping().requestPromotion(contextOf(request), body);
      reply.code(created ? 201 : 200);
      return promotion;
    },
    async decide(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(approvalBodySchema, request.body);
      const promotion = await shipping().decide(contextOf(request), id(request), body);
      reply.code(201);
      return promotion;
    },
    overrideFreeze: (request: FastifyRequest) =>
      shipping().overrideFreeze(
        contextOf(request),
        id(request),
        parseOrThrow(freezeOverrideBodySchema, request.body),
      ),
    cancel: (request: FastifyRequest) =>
      shipping().cancel(
        contextOf(request),
        id(request),
        parseOrThrow(cancelPromotionBodySchema, request.body ?? {}),
      ),
    listDeployments: (request: FastifyRequest) =>
      shipping().listDeployments(
        contextOf(request),
        parseOrThrow(listDeploymentsQuerySchema, request.query),
      ),
    getDeployment: (request: FastifyRequest) =>
      shipping().getDeployment(contextOf(request), deployment(request)),
    canary: (request: FastifyRequest) => shipping().canary(contextOf(request), deployment(request)),
    rollback: (request: FastifyRequest) =>
      shipping().rollback(
        contextOf(request),
        deployment(request),
        parseOrThrow(rollbackBodySchema, request.body ?? {}),
      ),
    resume: (request: FastifyRequest) =>
      shipping().resume(
        contextOf(request),
        deployment(request),
        parseOrThrow(resumeDeploymentBodySchema, request.body),
      ),
  };
}

export type ShippingController = ReturnType<typeof createShippingController>;
