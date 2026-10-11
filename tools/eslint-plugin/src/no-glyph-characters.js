/**
 * Icons are drawn, never typed (ADR 0015). The bundled fonts carry none of the arrow, shape,
 * symbol or keyboard characters, so each operating system draws them in its own fallback font.
 *
 * - JSX text may not contain one, except inside an allowed element (Kbd draws keys as icons).
 * - A string literal or template that is nothing but glyphs ("✓", "⌘K", "›", "↑↓") is an icon
 *   set as text and fails too, except as the value of an allowed prop (`keys`, `shortcut`) or
 *   inside an allowed element. Prose with punctuation is fine.
 * - JSX text that leads or trails with a bullet, chevron or plus ("+ Add", "Next ›") is an icon
 *   beside a label and fails.
 */

/** Arrows, misc technical (⌘ ⌥ ⏎), geometric shapes (▮ ● ◆ ▲), misc symbols (⚙ ◐), dingbats (✓ ✕). */
const STRONG = '←-⇿⌀-⏿■-◿☀-⛿✀-➿';
/** Characters fonts do draw, which are still icons when they stand alone or lead a label. */
const WEAK = '•‹›×';

const strong = new RegExp(`[${STRONG}]`, 'u');
const onlyGlyphs = new RegExp(
  `^[${STRONG}${WEAK}\\s+]+$|^[${STRONG}${WEAK}]+\\s*[A-Za-z0-9]{1,2}$`,
  'u',
);
const anyGlyph = new RegExp(`[${STRONG}${WEAK}]`, 'u');
const iconBeside = new RegExp(`^\\s*([${WEAK}+])\\s+\\S|\\S\\s+([${WEAK}])\\s*$`, 'u');

const DEFAULT_ELEMENTS = ['Kbd'];
const DEFAULT_PROPS = ['keys', 'shortcut'];

function elementName(node) {
  const name = node.openingElement?.name;
  if (!name) return null;
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') return name.property.name;
  return null;
}

/** True inside an allowed element or as the value of an allowed prop or property. */
function allowed(node, elements, props) {
  for (let at = node.parent; at; at = at.parent) {
    if (at.type === 'JSXElement' && elements.has(elementName(at))) return true;
    if (at.type === 'JSXAttribute' && props.has(at.name?.name)) return true;
    if (at.type === 'Property' && props.has(at.key?.name ?? at.key?.value)) return true;
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export const noGlyphCharacters = {
  meta: {
    type: 'problem',
    docs: { description: 'Draw icons with Icon or a glyph component, never with characters' },
    schema: [
      {
        type: 'object',
        properties: {
          elements: { type: 'array', items: { type: 'string' } },
          props: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      text: 'The character "{{glyph}}" is an icon set as text; draw it with <Icon>, a glyph component or <Kbd>.',
      literal:
        'The string "{{value}}" is an icon set as text; draw it with <Icon>, a glyph component or <Kbd>.',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const elements = new Set(options.elements ?? DEFAULT_ELEMENTS);
    const props = new Set(options.props ?? DEFAULT_PROPS);

    const checkText = (node, text) => {
      const match = strong.exec(text);
      const beside = !match && iconBeside.exec(text);
      if (!match && !beside) return;
      if (allowed(node, elements, props)) return;
      context.report({
        node,
        messageId: 'text',
        data: { glyph: match ? match[0] : (beside[1] ?? beside[2]) },
      });
    };

    const checkString = (node, value) => {
      const glyphsOnly = onlyGlyphs.test(value.trim()) && anyGlyph.test(value);
      if (!glyphsOnly && !iconBeside.test(value)) return;
      if (allowed(node, elements, props)) return;
      context.report({ node, messageId: 'literal', data: { value: value.trim() } });
    };

    return {
      JSXText(node) {
        checkText(node, node.value);
      },
      Literal(node) {
        if (typeof node.value !== 'string') return;
        const parent = node.parent?.type;
        if (parent === 'ImportDeclaration' || parent?.startsWith('Export')) return;
        checkString(node, node.value);
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0) checkString(node, node.quasis[0]?.value.cooked ?? '');
      },
    };
  },
};
