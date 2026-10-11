import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';
import { logicalProperties } from './logical-properties.js';
import { noLiteralUiStrings } from './no-literal-ui-strings.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const literal = (text) => ({ messageId: 'literal', data: { text } });
const physical = (bare, logical) => ({ messageId: 'physical', data: { bare, logical } });

tester.run('bemmoly/no-literal-ui-strings', noLiteralUiStrings, {
  valid: [
    "const a = <span>{t('shell.nav.home')}</span>;",
    'const a = <Row label={t(\'shell.nav.inbox\')} icon="inbox" path="/inbox" />;',
    'const a = <span aria-hidden>·</span>;',
    'const a = <span>{count} · {total}</span>;',
    'const a = <Logo label="Bemmoly" />;',
    'const a = <b>Bemmoly</b>;',
    'const a = <img alt="" />;',
    'const a = <Kbd keys="Mod+K" />;',
    'const a = <div className="flex gap-2" data-testid="nav-home" />;',
    "const label = 'Not checked outside JSX';",
  ],
  invalid: [
    { code: 'const a = <span>Search</span>;', errors: [literal('Search')] },
    { code: 'const a = <button aria-label="Close menu" />;', errors: [literal('Close menu')] },
    {
      code: "const a = <Tooltip label={'Expand sidebar'} />;",
      errors: [literal('Expand sidebar')],
    },
    {
      code: 'const a = <Field label={pending ? `Saving ${name}` : t("x.y")} />;',
      errors: [literal('Saving')],
    },
    {
      code: "const a = <p>{reason ? 'Sign in again' : title}</p>;",
      errors: [literal('Sign in again')],
    },
    {
      code: 'const a = <p>Use a different account</p>;',
      options: [{ allow: ['Bemmoly'] }],
      errors: [literal('Use a different account')],
    },
    {
      code: 'const a = <Row hint="Opens the guide" />;',
      options: [{ attributes: ['hint'] }],
      errors: [literal('Opens the guide')],
    },
  ],
});

tester.run('bemmoly/logical-properties', logicalProperties, {
  valid: [
    'const a = <div className="ms-auto ps-3 border-s text-start rounded-s-control end-0" />;',
    "const c = 'mx-2 px-3 inset-x-0 border-x left-to-right';",
    "const prose = 'Turn left at the light, then right';",
    'const a = <div className={`${base} ms-${size}`} />;',
  ],
  invalid: [
    {
      code: 'const a = <div className="ml-auto pl-3" />;',
      errors: [physical('ml-auto', 'ms-auto'), physical('pl-3', 'ps-3')],
    },
    {
      code: "const ASIDE = 'flex border-r border-line text-left';",
      errors: [physical('border-r', 'border-e'), physical('text-left', 'text-start')],
    },
    {
      code: 'const a = <span className={`${FILL} -top-0.5 -right-1 hover:mr-2`} />;',
      errors: [physical('-right-1', '-end-1'), physical('mr-2', 'me-2')],
    },
    {
      code: "const a = cx('rounded-l-control', on && 'border-l-2');",
      errors: [
        physical('rounded-l-control', 'rounded-s-control'),
        physical('border-l-2', 'border-s-2'),
      ],
    },
  ],
});
