import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Editor } from '@tiptap/core';
import DocEditor from '../doc-editor.tsx';
import { OPEN_QUESTIONS_DOC } from './story-docs.ts';
import { Page } from './story-page.tsx';
import { WORK_OFF, WORK_ON } from './story-services.tsx';

/*
 * The / menu of the Doc Editor mock, opened on the empty line under "Open questions". The
 * stories type the slash for you; type more to filter, use the arrows and Enter to insert.
 */

/** Puts the caret on the last line and types what a person would. */
const typeAtEnd = (text: string) => (editor: Editor | null) => {
  if (!editor) return;
  setTimeout(() => {
    editor.chain().focus('end').run();
    for (const char of text) {
      const { from, to } = editor.state.selection;
      const handled = editor.view.someProp('handleTextInput', (f) =>
        f(editor.view, from, to, char, () => editor.state.tr.insertText(char, from, to)),
      );
      if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to));
    }
  }, 50);
};

const meta = {
  title: 'Editor/Slash menu',
  component: DocEditor,
  args: { label: 'Page body', initialDoc: OPEN_QUESTIONS_DOC, services: WORK_ON },
  parameters: {
    layout: 'padded',
    mock: [
      {
        file: 'Bemmoly Doc Editor.dc.html',
        viewport: { width: 1440, height: 1700 },
        x: 360,
        y: 1182,
        w: 640,
        h: 419,
        note: 'Open questions and the / menu',
      },
    ],
  },
  render: (args) => (
    <Page>
      <div className="min-h-110">
        <DocEditor {...args} />
      </div>
    </Page>
  ),
} satisfies Meta<typeof DocEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The empty line's hint, before anything is typed. */
export const Hint: Story = { args: { autoFocus: true } };

/** AI first, then Blocks, as the mock shows them. */
export const Open: Story = { args: { onEditor: typeAtEnd('/') } };

/** Typing filters: "/ta" keeps the tables. */
export const Filtered: Story = { args: { onEditor: typeAtEnd('/ta') } };

/** No AI handler lent: the AI group is gone and Blocks lead. */
export const WithoutAi: Story = { args: { services: WORK_OFF, onEditor: typeAtEnd('/') } };

export const NoMatches: Story = { args: { onEditor: typeAtEnd('/zzz') } };

/** [[ searches pages; # searches issues when Work is on. */
export const PageSearch: Story = { args: { onEditor: typeAtEnd('[[run') } };
