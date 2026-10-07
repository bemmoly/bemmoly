import type { FastifyPluginAsync } from 'fastify';
import type {
  ModuleAdminController,
  ModulesController,
} from '../controllers/modules.controller.ts';
import { moduleGate, type ModuleGateDeps } from '../middlewares/module-gate.ts';
import type { ModuleRegistry } from '../modules/registry.ts';

export function modulesRoutes(controller: ModulesController): FastifyPluginAsync {
  return async (app) => {
    app.get('/modules', async (request) => controller.list(request));
  };
}

export function adminModulesRoutes(controller: ModuleAdminController): FastifyPluginAsync {
  return async (app) => {
    app.get('/admin/modules', async (request) => controller.list(request));
    app.get('/admin/modules/:id', async (request) => controller.get(request));
    app.post('/admin/modules/:id/enable', async (request) => controller.enable(request));
    app.post('/admin/modules/:id/disable', async (request) => controller.disable(request));
    app.post('/admin/modules/:id/remove-data', async (request) => controller.removeData(request));
  };
}

/**
 * Mounts every loaded module's resource routes under the API prefix, each
 * behind the gate so a disabled module answers 404 module_not_enabled.
 */
export function moduleResourceRoutes(
  registry: ModuleRegistry,
  gate: ModuleGateDeps,
): FastifyPluginAsync {
  return async (app) => {
    for (const route of registry.routes()) {
      await app.register(async (scoped) => {
        scoped.addHook('onRequest', moduleGate(route.moduleId, gate));
        await scoped.register(route.plugin, { prefix: route.prefix });
      });
    }
  };
}
