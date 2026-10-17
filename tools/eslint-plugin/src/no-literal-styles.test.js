import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';
import { noLiteralStyles } from './no-literal-styles.js';

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

const color = (value) => ({ messageId: 'color', data: { value } });
const arbitraryColor = (value) => ({ messageId: 'arbitraryColor', data: { value } });
const size = (value) => ({ messageId: 'size', data: { value } });

tester.run('bemmoly/no-literal-styles', noLiteralStyles, {
  valid: [
    'const a = <div className="bg-card text-13 text-tx-2" />;',
    'const a = <span className="text-red-tx bg-red-50 border-line" />;',
    'const a = <svg><path fill="currentColor" stroke=\'var(--acc)\' /></svg>;',
    'const a = <Label name="api" color={label.color} />;',
    'const a = <p>The accent is #2356C9, the logo blue.</p>;',
    "const ref = 'PLT-204 mentions #4821 in passing';",
    "const width = 'w-[85vw] max-w-[min(420px,100%)]';",
    "const cls = 'rounded-[2px] tracking-[-0.01em]';",
    "const cls = 'shadow-[inset_0_0_0_1px_var(--line)]';",
    "const cls = 'text-[length:var(--text-base)]';",
    `const cls = 'text-[${'0'.repeat(50_000)}x]';`,
    "import x from './colors-#fff.ts';",
    'const style = { color: `var(--${tone})` };',
    "const id = '#main';",
    { code: 'const a = <h1 className="text-[36px]" />;', options: [{ sizes: false }] },
  ],
  invalid: [
    { code: "const brand = '#2356c9';", errors: [color('#2356c9')] },
    { code: 'const a = <rect fill="#fff" />;', errors: [color('#fff')] },
    { code: "const a = <div style={{ color: '#E5484D' }} />;", errors: [color('#E5484D')] },
    {
      code: "const a = <div style={{ background: 'rgba(16,24,40,.45)' }} />;",
      errors: [color('rgba(16,24,40,.45)')],
    },
    { code: "const c = 'hsl(220 70% 50%)';", errors: [color('hsl(220 70% 50%)')] },
    { code: "const c = 'oklch(0.6 0.2 260)';", errors: [color('oklch(0.6 0.2 260)')] },
    {
      code: 'const a = <div className="flex bg-[#2356c9] p-2" />;',
      errors: [arbitraryColor('bg-[#2356c9]')],
    },
    {
      code: 'const a = <div className="hover:text-[rgb(0,0,0)]" />;',
      errors: [arbitraryColor('hover:text-[rgb(0,0,0)]')],
    },
    {
      code: "const cls = cx('border', 'border-[color:var(--acc)]');",
      errors: [arbitraryColor('border-[color:var(--acc)]')],
    },
    {
      code: 'const a = <h1 className="text-[28px] font-semibold" />;',
      errors: [size('text-[28px]')],
    },
    { code: 'const cls = `md:text-[0.8rem] ${extra}`;', errors: [size('md:text-[0.8rem]')] },
    { code: "const cls = 'text-[.75em]';", errors: [size('text-[.75em]')] },
    {
      code: 'const a = <h1 className="text-[36px] bg-[#fff]" />;',
      options: [{ sizes: false }],
      errors: [arbitraryColor('bg-[#fff]')],
    },
  ],
});
