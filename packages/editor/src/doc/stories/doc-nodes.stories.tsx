import type { Meta, StoryObj } from '@storybook/react-vite';
import { RichTextView } from '../../view.tsx';
import DocEditor from '../doc-editor.tsx';
import type { DocEditorProps } from '../doc-editor-props.ts';
import {
  CALLOUT_DOC,
  CODE_DOC,
  DECISION_DOC,
  IMAGE_DOC,
  ISSUE_TABLE_DOC,
  MIGRATION_DOC,
  PAGE_LINK_DOC,
  TABLE_DOC,
  TOC_DOC,
} from './story-docs.ts';
import { Page } from './story-page.tsx';
import { WORK_OFF, WORK_ON } from './story-services.tsx';

const MOCK = 'Bemmoly Doc Editor.dc.html';
const TALL = { width: 1440, height: 1700 };

const meta = {
  title: 'Editor/Docs nodes',
  component: DocEditor,
  args: { label: 'Page body', services: WORK_ON },
  parameters: { layout: 'padded' },
  render: (args) => (
    <Page>
      <DocEditor {...args} />
    </Page>
  ),
} satisfies Meta<typeof DocEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

const story = (initialDoc: DocEditorProps['initialDoc'], mock?: object): Story => ({
  args: { initialDoc },
  ...(mock ? { parameters: { mock: [{ file: MOCK, viewport: TALL, ...mock }] } } : {}),
});

/** The TL;DR box's tint is the info callout; the other variants follow the status pairs. */
export const Callout = story(CALLOUT_DOC, { x: 360, y: 290, w: 640, h: 93, note: 'TL;DR box' });

/** Issue chips drawn by Work's renderer: type square, key, status, as in the mock's list. */
export const IssueEmbed = story(MIGRATION_DOC, {
  x: 360,
  y: 565,
  w: 640,
  h: 169,
  note: 'Migration order',
});

/** With Work disabled, a chip prints the key with a neutral square and nothing else. */
export const IssueEmbedWithoutWork: Story = {
  args: { initialDoc: MIGRATION_DOC, services: WORK_OFF },
  parameters: { mock: [{ file: MOCK, viewport: TALL, x: 360, y: 565, w: 640, h: 169 }] },
};

/** A saved query drawn live; a new one asks for its filter. */
export const IssueTable = story(ISSUE_TABLE_DOC);

/** Without Work the query shows on a quiet card, so the page still reads. */
export const IssueTableWithoutWork: Story = {
  args: { initialDoc: ISSUE_TABLE_DOC, services: WORK_OFF },
};

export const Decision = story(DECISION_DOC);

export const TableOfContents = story(TOC_DOC);

/** Click a cell to see the row and column tools. */
export const Table = story(TABLE_DOC);

export const CodeBlock = story(CODE_DOC);

/** A stored image with its alt text as caption, and a new one asking for a file or a link. */
export const Image = story(IMAGE_DOC);

export const PageLinkAndImportedMacro = story(PAGE_LINK_DOC, {
  x: 360,
  y: 411,
  w: 640,
  h: 140,
  note: 'Context, with its page link',
});

/** The same nodes in the read-only view, which never loads ProseMirror. */
export const ReadOnlyView: Story = {
  render: () => (
    <Page>
      <div className="flex flex-col gap-10">
        {[CALLOUT_DOC, MIGRATION_DOC, DECISION_DOC, TABLE_DOC, ISSUE_TABLE_DOC].map((doc, i) => (
          <RichTextView key={i} doc={doc} size="doc" services={WORK_ON} />
        ))}
      </div>
    </Page>
  ),
};
