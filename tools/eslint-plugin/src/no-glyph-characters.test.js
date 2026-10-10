import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';
import { noGlyphCharacters } from './no-glyph-characters.js';

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

const text = (glyph) => ({ messageId: 'text', data: { glyph } });
const literal = (value) => ({ messageId: 'literal', data: { value } });

tester.run('bemmoly/no-glyph-characters', noGlyphCharacters, {
  valid: [
    'const a = <Icon name="check" />;',
    'const a = <span>Settings · Modules, about 3 minutes…</span>;',
    'const a = <p>Open Settings › Modules to turn it on.</p>;',
    'const a = <Kbd>⌘K</Kbd>;',
    'const a = <Kbd keys="⌘⏎" />;',
    'const a = <AiAskButton shortcut="⌘K" />;',
    "const keys = [{ keys: '↑↓', label: 'navigate' }];",
    "const sep = parts.join(' · ');",
    "const plus = a + '+' + b;",
    "import x from './arrows→.ts';",
    "const label = 'In progress to In review';",
    'const sentence = `Moved from ${a} → ${b}`;',
  ],
  invalid: [
    { code: 'const a = <span>✓</span>;', errors: [text('✓')] },
    { code: 'const a = <button>✕</button>;', errors: [text('✕')] },
    { code: 'const a = <a>Provider documentation ↗</a>;', errors: [text('↗')] },
    { code: 'const a = <th>Change ▲</th>;', errors: [text('▲')] },
    { code: 'const a = <Button>+ Add</Button>;', errors: [text('+')] },
    { code: 'const a = <span>Next ›</span>;', errors: [text('›')] },
    { code: "const glyph = '▮';", errors: [literal('▮')] },
    { code: "const item = action('go', 'Go to Home', '›');", errors: [literal('›')] },
    { code: "const x = { glyph: '⚙' };", errors: [literal('⚙')] },
    { code: "const tick = (on) => (on ? '✓' : undefined);", errors: [literal('✓')] },
    { code: 'const a = <Hint value="⌘K" />;', errors: [literal('⌘K')] },
    { code: 'const a = <span>{`→`}</span>;', errors: [literal('→')] },
    { code: "const bullet = '•';", errors: [literal('•')] },
    { code: 'const a = <Lanes addLabel="+ Add lane" />;', errors: [literal('+ Add lane')] },
    {
      code: "const label = done ? 'Change' : '+ Add reviewers';",
      errors: [literal('+ Add reviewers')],
    },
  ],
});
