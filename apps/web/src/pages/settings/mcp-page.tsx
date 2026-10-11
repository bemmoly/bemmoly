import {
  McpConnectSection,
  McpModulesSection,
  McpServerSection,
} from '../../components/mcp/mcp-sections.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { SettingsSkeleton } from '../../components/settings/settings-states.tsx';
import { useMcpSettings } from '../../hooks/use-mcp-settings.ts';

/**
 * Settings › MCP server: lets MCP clients and IDEs reach the workspace over the Model Context
 * Protocol with a person's access token. Off by default; every switch applies at once.
 */
export function McpPage() {
  const mcp = useMcpSettings();
  const exposed = mcp.available.filter((module) => mcp.isExposed(module.id));
  return (
    <SettingsPage
      title="MCP server"
      description="Let MCP clients and IDEs read and change work in this workspace, as the person whose token they use."
      loading={mcp.loading}
      skeleton={<SettingsSkeleton sections={3} rows={2} />}
      error={mcp.error}
    >
      <McpServerSection enabled={mcp.enabled} pending={mcp.pending} onChange={mcp.setEnabled} />
      <McpModulesSection
        available={mcp.available}
        all={mcp.exposed === null}
        isExposed={mcp.isExposed}
        onAll={mcp.setAll}
        onToggle={mcp.toggleModule}
      />
      <McpConnectSection origin={window.location.origin} modules={exposed} />
    </SettingsPage>
  );
}
