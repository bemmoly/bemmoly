import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RuleTester } from 'eslint';
import { afterAll, describe, expect, it } from 'vitest';
import { isAtlassianAsset, noAtlassianMarks } from './no-atlassian-marks.js';

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

const asset = (source) => ({ messageId: 'asset', data: { source } });
const named = (name) => ({ messageId: 'identifier', data: { name } });

tester.run('bemmoly/no-atlassian-marks', noAtlassianMarks, {
  valid: [
    "import { jiraClient } from './clients/jira.ts';",
    "import { fromConfluence } from './convert/from-confluence.ts';",
    "import github from 'simple-icons/icons/github.svg?no-inline';",
    "import { siGithub } from 'simple-icons';",
    'const a = <Icon name="import" />;',
    'const a = <p>Import from Jira</p>;',
    "const label = 'Confluence export';",
    'const heirloom = 1;',
  ],
  invalid: [
    {
      code: "import jira from 'simple-icons/icons/jira.svg?no-inline';",
      errors: [asset('simple-icons/icons/jira.svg?no-inline')],
    },
    {
      code: "import logo from './assets/confluence-logo.png';",
      errors: [asset('./assets/confluence-logo.png')],
    },
    { code: "const m = import('./trello.svg');", errors: [asset('./trello.svg')] },
    { code: "import { siJira } from 'simple-icons';", errors: [named('siJira')] },
    { code: 'function JiraLogo() { return null; }', errors: [named('JiraLogo')] },
    { code: 'const a = <ConfluenceMark />;', errors: [named('ConfluenceMark')] },
    { code: 'const ATLASSIAN_ICON = 1;', errors: [named('ATLASSIAN_ICON')] },
    { code: 'const logoBitbucket = 1;', errors: [named('logoBitbucket')] },
  ],
});

const root = join(import.meta.dirname, '../../..');
// coverage/ in any workspace: other workspaces' test runs write and delete files there meanwhile.
const SKIP = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-demo',
  '.turbo',
  'storybook-static',
  'coverage',
]);
const SKIP_PATHS = ['.claude/worktrees', 'test-results', 'playwright-report'];

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (SKIP_PATHS.some((skip) => relative(root, path).startsWith(skip))) continue;
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

/** Artwork of the family in text the linter does not parse: docs, mocks, the site, CSS. */
const EMBEDDED =
  /simple-icons\/icons\/(?:jira|confluence|atlassian|trello|bitbucket|statuspage|opsgenie|loom)\b|\bsi(?:Jira|Confluence|Atlassian|Trello|Bitbucket)\b/;
const TEXT = /\.(?:html?|md|mdx|astro|css|svg|js|jsx|ts|tsx|json)$/;
const SELF = /tools[/\\]eslint-plugin[/\\]src[/\\]no-atlassian-marks/;

describe('the repository', () => {
  const all = [...files(root)];

  it('holds no Atlassian-family logo files', () => {
    expect(all.map((path) => relative(root, path)).filter(isAtlassianAsset)).toEqual([]);
  });

  it('embeds no Atlassian-family marks in docs, mocks or the site', () => {
    const hits = all
      .filter((path) => TEXT.test(path) && !SELF.test(path))
      .filter((path) => EMBEDDED.test(readFileSync(path, 'utf8')))
      .map((path) => relative(root, path));
    expect(hits).toEqual([]);
  });
});
