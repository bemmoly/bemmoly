/**
 * Atlassian's trademark guidelines need written approval to use their logos, and we have none,
 * so no Atlassian-family mark (Jira, Confluence, Atlassian, Trello, Bitbucket, Statuspage,
 * Opsgenie, Loom, Jira Service Management) is drawn anywhere. Import cards take the neutral
 * `import` glyph from @bemmoly/ui/icons; the names stay as plain words ("Import from Jira").
 *
 * Fails:
 * - an import whose path names a family mark as artwork: `simple-icons/icons/jira.svg`,
 *   `./confluence-logo.png`, any image or icon file named after the family;
 * - a named import of a simple-icons entry for the family (`siJira`, `siConfluence`);
 * - an identifier that names a family logo, mark, icon or glyph (`JiraLogo`, `ConfluenceMark`,
 *   `TrelloIcon`, `AtlassianGlyph`, `JIRA_LOGO`).
 *
 * Plain words are untouched: an importer client called `jira.ts`, `fromConfluence`, a label.
 */

const FAMILY =
  'jira|confluence|atlassian|trello|bitbucket|statuspage|opsgenie|loom|jira-?service-?management';
const ASSET = new RegExp(
  `(?:^|[/\\\\._-])(?:${FAMILY})(?:[._-][\\w.-]*)?\\.(?:svg|png|jpe?g|webp|gif|ico|avif)(?:[?#].*)?$`,
  'i',
);
const ICON_PACKAGE = new RegExp(
  `(?:simple-icons|@icons-pack|devicon|logos?)[/\\\\].*(?:${FAMILY})`,
  'i',
);
const SIMPLE_ICON = new RegExp(`^si(?:${FAMILY.replace(/-\?/g, '')})$`, 'i');
const ARTWORK = new RegExp(
  `^(?:(?:${FAMILY})_?(?:logo|mark|icon|glyph|brand|wordmark)s?|(?:logo|mark|icon|glyph|brand)_?(?:${FAMILY}))$`,
  'i',
);

/** @type {import('eslint').Rule.RuleModule} */
export const noAtlassianMarks = {
  meta: {
    type: 'problem',
    docs: { description: 'Never draw an Atlassian-family logo; use the neutral import glyph' },
    schema: [],
    messages: {
      asset:
        '"{{ source }}" is Atlassian-family logo artwork, which needs their written approval. Use <Icon name="import" /> and the product name as text.',
      identifier:
        '"{{ name }}" names an Atlassian-family logo, which needs their written approval. Use <Icon name="import" /> and the product name as text.',
    },
  },
  create(context) {
    const checkSource = (node) => {
      const source = node?.value;
      if (typeof source !== 'string') return;
      if (ASSET.test(source) || ICON_PACKAGE.test(source)) {
        context.report({ node, messageId: 'asset', data: { source } });
      }
    };
    return {
      ImportDeclaration(node) {
        checkSource(node.source);
        for (const spec of node.specifiers) {
          const name = spec.imported?.name;
          if (name && SIMPLE_ICON.test(name)) {
            context.report({ node: spec, messageId: 'identifier', data: { name } });
          }
        }
      },
      ImportExpression(node) {
        checkSource(node.source);
      },
      Identifier(node) {
        const name = node.name;
        if (
          ARTWORK.test(name) ||
          (SIMPLE_ICON.test(name) && node.parent?.type !== 'ImportSpecifier')
        ) {
          context.report({ node, messageId: 'identifier', data: { name } });
        }
      },
      JSXIdentifier(node) {
        if (ARTWORK.test(node.name)) {
          context.report({ node, messageId: 'identifier', data: { name: node.name } });
        }
      },
    };
  },
};

/** For the repository scan: a file whose name makes it Atlassian-family artwork. */
export const isAtlassianAsset = (path) => ASSET.test(path);
