import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';
import { boundaries } from './boundaries.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const root = '/repo';
const options = [{ root }];
const at = (rel) => `${root}/${rel}`;
const tester = new RuleTester({ languageOptions: { ecmaVersion: 2024, sourceType: 'module' } });

tester.run('bemmoly/boundaries', boundaries, {
  valid: [
    {
      filename: at('modules/work/server/src/services/issues.ts'),
      code: "import { x } from '@bemmoly/core';",
      options,
    },
    {
      filename: at('modules/work/server/src/services/issues.ts'),
      code: "import { y } from '@bemmoly/shared';",
      options,
    },
    {
      filename: at('modules/work/server/src/services/issues.ts'),
      code: "import { z } from '../models/issue.ts';",
      options,
    },
    {
      filename: at('modules/work/web/src/board.tsx'),
      code: "import { Button } from '@bemmoly/ui';",
      options,
    },
    {
      filename: at('modules/work/module.ts'),
      code: "import { routes } from './server/src/routes/index.ts';",
      options,
    },
    {
      filename: at('packages/core/src/controllers/a.ts'),
      code: "import { s } from '../services/settings/index.ts';",
      options,
    },
    {
      filename: at('packages/core/src/services/email/outbox.ts'),
      code: "import { t } from './templates.ts';",
      options,
    },
    {
      filename: at('packages/core/src/services/email/outbox.ts'),
      code: "import { a } from '../authz/index.ts';",
      options,
    },
    { filename: at('apps/server/src/config/modules.ts'), code: 'await import(name);', options },
    {
      filename: at('apps/server/src/app.ts'),
      code: "import { kernelRoutes } from '@bemmoly/core';",
      options,
    },
    { filename: at('apps/web/src/main.tsx'), code: "import React from 'react';", options },
    {
      filename: at('modules/docs/server/src/services/collab/extract.ts'),
      code: "import { plainText } from '@bemmoly/editor/convert';",
      options,
    },
    {
      filename: at('modules/docs/server/src/services/collab/seed.ts'),
      code: "import { editorSchema } from '@bemmoly/editor/schema';",
      options,
    },
    {
      filename: at('modules/docs/shared/outline.ts'),
      code: "export { buildToc } from '@bemmoly/editor/convert';",
      options,
    },
    {
      filename: at('modules/docs/web/src/page/page-screen.tsx'),
      code: "import { DocEditor } from '@bemmoly/editor';",
      options,
    },
  ],
  invalid: [
    {
      filename: at('modules/docs/server/src/services/collab/extract.ts'),
      code: "import { DocEditor } from '@bemmoly/editor';",
      options,
      errors: [{ messageId: 'moduleWorkspace' }],
    },
    {
      filename: at('modules/docs/shared/pages.ts'),
      code: "const editor = () => import('@bemmoly/editor');",
      options,
      errors: [{ messageId: 'moduleWorkspace' }],
    },
    {
      filename: at('modules/docs/server/src/services/collab/extract.ts'),
      code: "import { x } from '@bemmoly/editor/src/convert/text.ts';",
      options,
      errors: [{ messageId: 'deepImport' }],
    },
    {
      filename: at('modules/work/server/src/services/issues.ts'),
      code: "import { page } from '@bemmoly/module-docs';",
      options,
      errors: [{ messageId: 'moduleWorkspace' }],
    },
    {
      filename: at('modules/work/server/src/services/issues.ts'),
      code: "import { page } from '../../../../docs/server/src/services/pages.ts';",
      options,
      errors: [{ messageId: 'moduleEscape' }],
    },
    {
      filename: at('modules/work/server/src/services/issues.ts'),
      code: "import { Button } from '@bemmoly/ui';",
      options,
      errors: [{ messageId: 'moduleWorkspace' }],
    },
    {
      filename: at('modules/work/server/src/services/issues.ts'),
      code: "import { db } from '../../../../../packages/core/src/clients/db.ts';",
      options,
      errors: [{ messageId: 'moduleEscape' }],
    },
    {
      filename: at('packages/core/src/services/settings/index.ts'),
      code: "import { settingsRoutes } from '../../routes/settings.routes.ts';",
      options,
      errors: [{ messageId: 'serviceLayer' }],
    },
    {
      filename: at('modules/work/server/src/services/issues.ts'),
      code: "export { c } from '../controllers/issues.controller.ts';",
      options,
      errors: [{ messageId: 'serviceLayer' }],
    },
    {
      filename: at('packages/core/src/services/email/outbox.ts'),
      code: "import { hash } from '../identity/passwords.ts';",
      options,
      errors: [{ messageId: 'serviceInternals' }],
    },
    {
      filename: at('packages/core/src/controllers/users.controller.ts'),
      code: "import { hash } from '../services/identity/passwords.ts';",
      options,
      errors: [{ messageId: 'serviceInternals' }],
    },
    {
      filename: at('apps/server/src/server.ts'),
      code: "import sample from '@bemmoly/module-sample';",
      options,
      errors: [{ messageId: 'appImportsModule' }],
    },
    {
      filename: at('apps/web/src/app.tsx'),
      code: "const chunk = () => import('../../../modules/work/web/src/index.tsx');",
      options,
      errors: [{ messageId: 'appImportsModule' }],
    },
    {
      filename: at('apps/server/src/app.ts'),
      code: "import { x } from '@bemmoly/core/src/services/system/readiness.ts';",
      options,
      errors: [{ messageId: 'deepImport' }],
    },
  ],
});
