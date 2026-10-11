/**
 * Tokens from @bemmoly/ui are the only source of colour and type size in rendered UI
 * (docs/design/system/tokens.md). A literal colour skips the theme, so it is wrong in every
 * preset but one and in dark mode; a literal font size skips the 11 to 24 scale.
 *
 * - A string that is nothing but a colour ("#fff", "rgb(0 0 0)", "hsl(…)", "oklch(…)") fails,
 *   whether it is a prop, a style value or a constant.
 * - A Tailwind arbitrary colour ("bg-[#2356c9]", "text-[rgb(…)]") fails anywhere in a string.
 * - A Tailwind arbitrary font size ("text-[13px]", "text-[0.8rem]") fails anywhere in a string,
 *   unless the `sizes: false` option turns that check off for a folder that still owes it.
 *
 * Colours that are data (a label's stored colour, a theme's brand input) arrive as values at
 * run time and never appear as literals in source, so they are untouched. Visible text is not
 * checked, so a sentence may still name a colour.
 */

const COLOR_FUNCTION = '(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\\(';
const wholeColor = new RegExp(`^\\s*(?:#[0-9a-f]{3,8}|${COLOR_FUNCTION}[^)]*\\))\\s*$`, 'i');
/** One class, with any variants in front ("hover:", "md:", "[&>svg]:"). */
const arbitraryColor = new RegExp(
  `^(?:\\S*:)?!?-?[a-z][\\w-]*-\\[(?:#[0-9a-f]{3,8}|${COLOR_FUNCTION}|color:)`,
  'i',
);
const arbitrarySize = /^(?:\S*:)?!?text-\[(?:length:)?\d*\.?\d+(?:px|rem|em|pt|vw|vh)\]$/i;

/** @type {import('eslint').Rule.RuleModule} */
export const noLiteralStyles = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Take colours and type sizes from the design tokens, never from literals',
    },
    schema: [
      {
        type: 'object',
        properties: { sizes: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      color:
        'The colour "{{value}}" is a literal; use a token from @bemmoly/ui (bg-card, text-tx-2, var(--acc), …).',
      arbitraryColor:
        'The class "{{value}}" sets a literal colour; use a token class from @bemmoly/ui (bg-acc-50, text-red-tx, …).',
      size: 'The class "{{value}}" sets a literal font size; use the type scale (text-11 to text-24).',
    },
  },
  create(context) {
    const sizes = context.options[0]?.sizes ?? true;
    const check = (node, value) => {
      if (wholeColor.test(value)) {
        context.report({ node, messageId: 'color', data: { value: value.trim() } });
        return;
      }
      for (const token of value.split(/[\s"'`]+/)) {
        if (arbitraryColor.test(token)) {
          context.report({ node, messageId: 'arbitraryColor', data: { value: token } });
          return;
        }
        if (sizes && arbitrarySize.test(token)) {
          context.report({ node, messageId: 'size', data: { value: token } });
          return;
        }
      }
    };

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        const parent = node.parent?.type;
        if (parent === 'ImportDeclaration' || parent?.startsWith('Export')) return;
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? '');
      },
    };
  },
};
