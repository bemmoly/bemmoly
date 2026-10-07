import type { FastifyPluginAsync } from 'fastify';
import type { ModulesController } from '../controllers/modules.controller.ts';
import type { ModuleRegistry } from '../modules/registry.ts';

export function modulesRoutes(controller: ModulesController): FastifyPluginAsync {
  return async (app) => {
    app.get('/modules', async () => controller.list());
  };
}

/** Mounts each enabled module's resource routes under the API prefix. */
export function moduleResourceRoutes(registry: ModuleRegistry): FastifyPluginAsync {
  return async (app) => {
    for (const route of registry.routes()) {
      await app.register(route.plugin, { prefix: route.prefix });
    }
  };
}
