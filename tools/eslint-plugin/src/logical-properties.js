/**
 * Right-to-left readiness (ADR 0024): spacing, position, borders, radii and alignment use the
 * logical utilities that follow `<html dir>` (ms-, pe-, start-, end-, border-s, rounded-e,
 * text-start), so a right-to-left language mirrors the layout without a second stylesheet.
 * Applied with the literal-strings rule to the screens already extracted.
 *
 * Checks every string and template in the file for whole class tokens, with any variant
 * prefix (`hover:ml-2`, `max-sm:right-0`); prose never matches, since a token needs its dash.
 */

const LOGICAL = {
  ml: 'ms',
  mr: 'me',
  pl: 'ps',
  pr: 'pe',
  left: 'start',
  right: 'end',
  'border-l': 'border-s',
  'border-r': 'border-e',
  'rounded-l': 'rounded-s',
  'rounded-r': 'rounded-e',
  'rounded-tl': 'rounded-ss',
  'rounded-tr': 'rounded-se',
  'rounded-bl': 'rounded-es',
  'rounded-br': 'rounded-ee',
  'scroll-ml': 'scroll-ms',
  'scroll-mr': 'scroll-me',
  'scroll-pl': 'scroll-ps',
  'scroll-pr': 'scroll-pe',
};
const EXACT = {
  'text-left': 'text-start',
  'text-right': 'text-end',
  'float-left': 'float-start',
  'float-right': 'float-end',
  'border-l': 'border-s',
  'border-r': 'border-e',
  'rounded-l': 'rounded-s',
  'rounded-r': 'rounded-e',
};

const PREFIXES = Object.keys(LOGICAL)
  .sort((a, b) => b.length - a.length)
  .join('|');
/** A class token, its variants peeled off: "-left-1", "border-r-2", "ml-auto". */
const TOKEN = new RegExp(`^(-?)(${PREFIXES})-([\\w./[\\]%-]+)$`);

/** Spacing and inset take sizes ("2", "1.5", "1/2", "auto", "[3px]"); prose like "left-to-right" does not. */
const SIZE = /^(\d+(\.\d+)?|\d+\/\d+|auto|full|px|\[[^\]]+\])$/;

function physical(token) {
  const bare = token.slice(token.lastIndexOf(':') + 1);
  if (EXACT[bare]) return { bare, logical: EXACT[bare] };
  const match = TOKEN.exec(bare);
  if (!match) return null;
  const [, minus, prefix, rest] = match;
  const sized = !prefix.startsWith('border') && !prefix.startsWith('rounded');
  if (sized && !SIZE.test(rest)) return null;
  return { bare, logical: `${minus}${LOGICAL[prefix]}-${rest}` };
}

/** @type {import('eslint').Rule.RuleModule} */
export const logicalProperties = {
  meta: {
    type: 'problem',
    docs: { description: 'Use logical spacing and position utilities so layouts mirror' },
    schema: [],
    messages: {
      physical: '"{{bare}}" stays on one side in a right-to-left language; use "{{logical}}".',
    },
  },
  create(context) {
    const check = (node, text) => {
      for (const token of text.split(/\s+/)) {
        const found = token && physical(token);
        if (found) context.report({ node, messageId: 'physical', data: found });
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
