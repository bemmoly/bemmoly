import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { applicationKeyParamsSchema } from '../../../shared/catalog.ts';
import { forYouQuerySchema } from '../../../shared/for-you.ts';
import { mapQuerySchema } from '../../../shared/map.ts';
import type { ForYouService } from '../services/for-you/index.ts';
import type { MapService } from '../services/map/index.ts';
import type { StripService } from '../services/strip/index.ts';

/** For you, the Release map and an application's environments. */
export function createDeliveryController(services: {
  forYou: ForYouService;
  map: MapService;
  strip: StripService;
}) {
  return {
    forYou(request: FastifyRequest) {
      const query = parseOrThrow(forYouQuerySchema, request.query);
      return services.forYou.get(contextOf(request), query);
    },
    map(request: FastifyRequest) {
      const query = parseOrThrow(mapQuerySchema, request.query);
      return services.map.get(contextOf(request), query);
    },
    strip(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      return services.strip.get(contextOf(request), key);
    },
  };
}

export type DeliveryController = ReturnType<typeof createDeliveryController>;
