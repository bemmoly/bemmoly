import { currentUser } from '../db.ts';
import type { MockTemplateField } from '../seed/docs-templates.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import { docsState } from './docs-state.ts';

/*
 * Settings › Docs on the in-memory backend: the org templates with their use, add, edit,
 * archive, restore, duplicate and order, in the Docs server's shapes. Built-ins read only.
 */

const BASE = '/api/v1/docs';

interface TemplateBody {
  spaceId: string | null;
  name: string;
  description: string | null;
  icon: string;
  category: string;
  fields: MockTemplateField[];
  snapshot: object;
}

type Template = ReturnType<typeof docsState>['templates'][number];

function withUse(db: Parameters<MockRoute['handle']>[1], template: Template) {
  const usedBy = docsState(db).pages.filter((page) => page.templateId === template.id).length;
  return { ...template, usedBy };
}

function find(request: MockRequest, db: Parameters<MockRoute['handle']>[1]) {
  return docsState(db).templates.find((item) => item.id === request.params['templateId']);
}

const builtinRefused = () =>
  fail(409, 'conflict', 'Built-in templates cannot be changed. Duplicate it to edit a copy.');

const orgOrder = (templates: Template[]) =>
  templates
    .filter((item) => item.spaceId === null)
    .sort(
      (a, b) =>
        Number(a.archivedAt !== null) - Number(b.archivedAt !== null) || a.position - b.position,
    );

export const docsTemplateRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/org-templates`,
    handle: (_request, db) =>
      ok({ items: orgOrder(docsState(db).templates).map((item) => withUse(db, item)) }),
  },
  {
    method: 'POST',
    pattern: `${BASE}/templates`,
    handle: (request, db) => {
      const body = bodyOf<TemplateBody>(request);
      const state = docsState(db);
      const me = currentUser(db);
      const now = new Date().toISOString();
      const siblings = state.templates.filter((item) => item.spaceId === (body.spaceId ?? null));
      const template: Template = {
        id: newId(),
        spaceId: body.spaceId ?? null,
        key: null,
        name: body.name ?? 'Untitled',
        description: body.description ?? null,
        icon: body.icon ?? null,
        category: body.category ?? null,
        fields: body.fields ?? [],
        isBuiltin: false,
        position: Math.max(-1, ...siblings.map((item) => item.position)) + 1,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        createdBy: me ? { id: me.id, name: me.name } : null,
        snapshot: body.snapshot ?? { type: 'doc', content: [] },
      };
      state.templates.push(template);
      return ok(template, 201);
    },
  },
  {
    method: 'PATCH',
    pattern: `${BASE}/templates/:templateId`,
    handle: (request, db) => {
      const template = find(request, db);
      if (!template) return notFound('The template');
      if (template.isBuiltin) return builtinRefused();
      const body = bodyOf<TemplateBody>(request);
      Object.assign(template, {
        ...body,
        ...('description' in body ? { description: body.description ?? null } : {}),
        updatedAt: new Date().toISOString(),
      });
      return ok(template);
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/templates/:templateId/archive`,
    handle: (request, db) => {
      const template = find(request, db);
      if (!template) return notFound('The template');
      template.archivedAt = new Date().toISOString();
      return ok(withUse(db, template));
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/templates/:templateId/restore`,
    handle: (request, db) => {
      const template = find(request, db);
      if (!template) return notFound('The template');
      template.archivedAt = null;
      return ok(withUse(db, template));
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/templates/:templateId/duplicate`,
    handle: (request, db) => {
      const template = find(request, db);
      if (!template) return notFound('The template');
      const state = docsState(db);
      for (const item of state.templates) {
        if (item.spaceId === template.spaceId && item.position > template.position)
          item.position += 1;
      }
      const me = currentUser(db);
      const now = new Date().toISOString();
      const copy: Template = {
        ...template,
        id: newId(),
        key: null,
        name: `${template.name} (copy)`,
        isBuiltin: false,
        position: template.position + 1,
        createdAt: now,
        updatedAt: now,
        createdBy: me ? { id: me.id, name: me.name } : null,
      };
      state.templates.push(copy);
      return ok({ ...copy, snapshot: copy.snapshot ?? { type: 'doc', content: [] } }, 201);
    },
  },
  {
    method: 'PUT',
    pattern: `${BASE}/org-templates/order`,
    handle: (request, db) => {
      const ids = bodyOf<{ ids: string[] }>(request).ids ?? [];
      const active = docsState(db).templates.filter(
        (item) => item.spaceId === null && !item.archivedAt,
      );
      if (ids.length !== active.length || active.some((item) => !ids.includes(item.id))) {
        return fail(409, 'conflict', 'The templates changed since the list loaded.');
      }
      for (const item of active) item.position = ids.indexOf(item.id);
      return ok();
    },
  },
  {
    method: 'DELETE',
    pattern: `${BASE}/templates/:templateId`,
    handle: (request, db) => {
      const template = find(request, db);
      if (!template) return notFound('The template');
      if (template.isBuiltin) return builtinRefused();
      const state = docsState(db);
      state.templates = state.templates.filter((item) => item !== template);
      return ok();
    },
  },
];
