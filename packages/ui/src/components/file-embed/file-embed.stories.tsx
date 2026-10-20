import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileEmbed } from './file-embed.tsx';

/* A report the way an agent writes one: inline styles and a script that draws its bars. */
const REPORT = `<!doctype html><html><body style="font:14px system-ui;margin:16px">
<h2>Weekly throughput</h2><div id="bars"></div>
<script>
for (const [day, n] of [['Mon', 4], ['Tue', 7], ['Wed', 5], ['Thu', 9], ['Fri', 6]]) {
  const row = document.createElement('div');
  row.textContent = day + ' ' + '\\u2588'.repeat(n);
  document.getElementById('bars').append(row);
}
</script></body></html>`;

const meta = {
  title: 'Docs/File embed',
  component: FileEmbed,
  args: {
    src: `data:text/html;charset=utf-8,${encodeURIComponent(REPORT)}`,
    name: 'weekly-throughput.html',
    kind: 'html',
    byline: 'Added by Release agent',
  },
  render: (args) => <FileEmbed {...args} className="w-180" />,
} satisfies Meta<typeof FileEmbed>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Html: Story = {};

export const Image: Story = {
  args: {
    src: '/brand/logo-mark.png',
    name: 'architecture.png',
    kind: 'image',
  },
};
