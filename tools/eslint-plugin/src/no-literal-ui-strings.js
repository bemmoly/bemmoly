/**
 * Words people read come from a message catalog (ADR 0024), never from a literal in the
 * component. Applied to the screens already extracted, so a new literal there fails review
 * while the rest of the product is still being moved over.
 *
 * - JSX text with a letter in it fails ("Sign in", "3 issues").
 * - A string or template with a letter fails as a JSX child (`{'Sign in'}`) or as the value of
 *   a prop people read or hear (`aria-label`, `title`, `placeholder`, `label`, …), including
 *   either side of a conditional.
 * - Names that are never translated (the product's own) can be allowed.
 */

const DEFAULT_ATTRIBUTES = [
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'alt',
  'title',
  'placeholder',
  'label',
  'description',
  'lede',
  'hint',
  'subtitle',
  'submitLabel',
  'searchPlaceholder',
  'emptyLabel',
];
const DEFAULT_ALLOW = ['Bemmoly'];

const LETTER = /\p{L}/u;

/** The literal strings an expression can evaluate to: `a ? 'x' : 'y'`, `a || 'x'`. */
function literalsOf(node) {
  if (!node) return [];
  if (node.type === 'Literal' && typeof node.value === 'string') return [[node, node.value]];
  if (node.type === 'TemplateLiteral') {
    return [[node, node.quasis.map((quasi) => quasi.value.cooked ?? '').join(' ')]];
  }
  if (node.type === 'ConditionalExpression') {
    return [...literalsOf(node.consequent), ...literalsOf(node.alternate)];
  }
  if (node.type === 'LogicalExpression') return literalsOf(node.right);
  return [];
}

/** @type {import('eslint').Rule.RuleModule} */
export const noLiteralUiStrings = {
  meta: {
    type: 'problem',
    docs: { description: 'Take UI text from a message catalog through useT, not from a literal' },
    schema: [
      {
        type: 'object',
        properties: {
          attributes: { type: 'array', items: { type: 'string' } },
          allow: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      literal:
        '"{{text}}" is UI text; add it to the namespace catalog and render it with t() (docs/i18n.md).',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const attributes = new Set(options.attributes ?? DEFAULT_ATTRIBUTES);
    const allow = new Set(options.allow ?? DEFAULT_ALLOW);

    const check = (node, raw) => {
      const text = raw.replace(/\s+/g, ' ').trim();
      if (!LETTER.test(text) || allow.has(text)) return;
      context.report({ node, messageId: 'literal', data: { text: text.slice(0, 60) } });
    };

    return {
      JSXText(node) {
        check(node, node.value);
      },
      JSXExpressionContainer(node) {
        const parent = node.parent;
        const child = parent?.type === 'JSXElement' || parent?.type === 'JSXFragment';
        const readAttribute =
          parent?.type === 'JSXAttribute' && attributes.has(String(parent.name?.name ?? ''));
        if (!child && !readAttribute) return;
        for (const [literal, value] of literalsOf(node.expression)) check(literal, value);
      },
      JSXAttribute(node) {
        if (!attributes.has(String(node.name?.name ?? ''))) return;
        if (node.value?.type === 'Literal' && typeof node.value.value === 'string') {
          check(node.value, node.value.value);
        }
      },
    };
  },
};
