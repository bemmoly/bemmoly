import type { AiPrompt } from '@bemmoly/shared';
import { Badge, Card, CardHeader, RelativeTime, Table, type TableColumn } from '@bemmoly/ui';
import { PromptEditor } from '../../../components/ai/prompt-editor.tsx';
import { SettingsPage } from '../../../components/settings/settings-page.tsx';
import { SettingsSkeleton } from '../../../components/settings/settings-states.tsx';
import { useAiAdminSettings } from '../../../hooks/use-ai-admin.ts';
import { useAiPrompts } from '../../../hooks/use-ai-prompts.ts';
import { ROLE_COPY } from '../../../hooks/use-ai-roles.ts';
import { useSearchParam } from '../../../hooks/use-search-param.ts';
import { AI_PAGE_DESCRIPTION, AI_PAGE_TITLE } from './ai-setup-page.tsx';

const columns: TableColumn<AiPrompt>[] = [
  {
    key: 'name',
    header: 'Prompt',
    width: 'minmax(0,2.4fr)',
    render: (prompt) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-tx">{prompt.description}</span>
        <span className="truncate font-mono text-12 text-tx-3">{prompt.id}</span>
      </span>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    width: '100px',
    hideOnPhone: true,
    render: (prompt) => <span className="text-tx-2">{ROLE_COPY[prompt.role].label}</span>,
  },
  {
    key: 'state',
    header: 'Used',
    width: '150px',
    render: (prompt) =>
      prompt.override ? (
        <span className="flex flex-col items-start gap-0.5">
          <Badge tone="accent">Changed</Badge>
          <RelativeTime iso={prompt.override.updatedAt} className="text-12 text-tx-3" />
        </span>
      ) : (
        <span className="text-tx-3">Default · v{prompt.version}</span>
      ),
  },
];

/**
 * Settings › AI › Prompts: every prompt the runtime ships, read-only, with the admin's
 * override where one is saved. Opening one (`?prompt=<id>`) edits the override.
 */
export function AiPromptsPage() {
  const admin = useAiAdminSettings();
  const prompts = useAiPrompts(admin.canConfigure);
  const [open, setOpen] = useSearchParam('prompt');
  const changed = prompts.items.filter((prompt) => prompt.override).length;
  return (
    <SettingsPage
      title={AI_PAGE_TITLE}
      description={AI_PAGE_DESCRIPTION}
      loading={prompts.list.isPending}
      skeleton={<SettingsSkeleton sections={1} rows={5} />}
      error={prompts.list.error}
    >
      <Card>
        <CardHeader
          title="Prompts"
          hint={changed > 0 ? `${changed} changed from the default` : 'All on their defaults'}
        />
        <Table
          label="Prompts"
          className="rounded-none! border-0!"
          columns={columns}
          rows={prompts.items}
          rowKey={(prompt) => prompt.id}
          onRowClick={(prompt) => setOpen(prompt.id)}
          selectedKey={open ?? undefined}
          empty={
            <span className="block px-4 py-5 text-13 text-tx-3">
              This install ships no prompts yet.
            </span>
          }
        />
      </Card>
      <PromptEditor prompt={prompts.find(open)} prompts={prompts} onClose={() => setOpen(null)} />
    </SettingsPage>
  );
}
