import { classifyFile, classifyImport } from './classify.js';

const SERVER_ALLOWED = new Set(['core', 'shared']);
const WEB_ALLOWED = new Set(['core', 'shared', 'ui', 'core-web', 'editor', 'api-client']);

const hasSegment = (rel, name) => rel.split('/').slice(0, -1).includes(name);

/** @type {import('eslint').Rule.RuleModule} */
export const boundaries = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce the module, layering and kernel service boundaries of AGENTS.md',
    },
    schema: [
      {
        type: 'object',
        properties: { root: { type: 'string' } },
        required: ['root'],
        additionalProperties: false,
      },
    ],
    messages: {
      moduleEscape:
        'Module "{{moduleId}}" may import only @bemmoly/core, @bemmoly/shared and files inside modules/{{moduleId}}/ (found "{{specifier}}").',
      moduleWorkspace:
        'Module "{{moduleId}}" may not import {{specifier}}; cross-module behaviour goes through kernel registries and events.',
      serviceLayer:
        'Services never import routes or controllers (found "{{specifier}}"). Dependencies point routes -> controllers -> services.',
      serviceInternals:
        'Import the kernel service "{{service}}" through packages/core/src/services/{{service}}/index.ts, not its internals (found "{{specifier}}").',
      deepImport: 'Import {{name}} through its package exports, not "{{specifier}}".',
      appImportsModule:
        'Apps never import modules directly (found "{{specifier}}"); the host loads module packages by name at boot.',
    },
  },
  create(context) {
    const [{ root }] = context.options;
    const file = classifyFile(root, context.filename);

    const check = (node, specifier) => {
      const target = classifyImport(root, context.filename, specifier);
      if (target.kind === 'external') return;
      const report = (messageId, data = {}) =>
        context.report({ node, messageId, data: { specifier, moduleId: file.moduleId, ...data } });

      if (target.kind === 'workspace') {
        if (target.subpath.startsWith('/src'))
          return report('deepImport', { name: `@bemmoly/${target.name}` });
        if (file.inApp && target.moduleId) return report('appImportsModule');
        if (file.moduleId) {
          const allowed = file.moduleWeb ? WEB_ALLOWED : SERVER_ALLOWED;
          if (target.moduleId !== file.moduleId && !allowed.has(target.name))
            return report('moduleWorkspace');
        }
        return;
      }

      const rel = target.rel;
      if (file.inApp && rel.startsWith('modules/')) return report('appImportsModule');
      if (file.moduleId && !rel.startsWith(`modules/${file.moduleId}/`))
        return report('moduleEscape');
      if (file.inServices && (hasSegment(rel, 'routes') || hasSegment(rel, 'controllers'))) {
        return report('serviceLayer');
      }
      const service = /^packages\/core\/src\/services\/([^/]+)(\/(.*))?$/.exec(rel);
      if (service && service[1] !== file.kernelService) {
        const inner = service[3] ?? '';
        if (inner !== '' && inner !== 'index.ts' && inner !== 'index.js' && inner !== 'index') {
          return report('serviceInternals', { service: service[1] });
        }
      }
    };

    const fromSource = (node) => {
      if (node.source && typeof node.source.value === 'string')
        check(node.source, node.source.value);
    };

    return {
      ImportDeclaration: fromSource,
      ExportNamedDeclaration: fromSource,
      ExportAllDeclaration: fromSource,
      ImportExpression(node) {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          check(node.source, node.source.value);
        }
      },
    };
  },
};
