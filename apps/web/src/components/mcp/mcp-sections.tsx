import { Radio, SettingsRow, SettingsSection, Switch } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { useClipboard } from '../../hooks/use-clipboard.ts';
import { mcpEndpoint, mcpSnippet } from '../../hooks/use-mcp-settings.ts';
import { CopyField } from '../settings/copy-field.tsx';

interface ServerProps {
  enabled: boolean;
  pending: boolean;
  onChange: (on: boolean) => void;
}

export function McpServerSection({ enabled, pending, onChange }: ServerProps) {
  return (
    <SettingsSection title="Server" layout="rows">
      <SettingsRow
        title="Allow MCP clients"
        description="While this is off, no client can connect, whatever token it has. AI settings don’t affect it: clients bring their own model and act with the token owner’s access."
        control={
          <Switch
            aria-label="Allow MCP clients"
            checked={enabled}
            disabled={pending}
            onCheckedChange={onChange}
          />
        }
      />
    </SettingsSection>
  );
}

interface ModulesProps {
  available: readonly { id: string; name: string }[];
  all: boolean;
  isExposed: (id: string) => boolean;
  onAll: (all: boolean) => void;
  onToggle: (id: string, on: boolean) => void;
}

export function McpModulesSection({ available, all, isExposed, onAll, onToggle }: ModulesProps) {
  return (
    <SettingsSection
      title="Exposed modules"
      hint="Clients see only these modules, and within them only what the token’s owner can open."
      layout="rows"
    >
      <fieldset className="m-0 flex flex-col gap-2 border-0 px-0 py-3">
        <legend className="sr-only">Which modules clients can reach</legend>
        <Radio
          name="mcp-modules"
          label="Every enabled module"
          description="Modules turned on later are exposed too."
          checked={all}
          onChange={() => onAll(true)}
        />
        <Radio
          name="mcp-modules"
          label="Only the modules chosen below"
          checked={!all}
          onChange={() => onAll(false)}
        />
      </fieldset>
      {all
        ? null
        : available.map((module) => (
            <SettingsRow
              key={module.id}
              title={module.name}
              control={
                <Switch
                  aria-label={`Expose ${module.name}`}
                  checked={isExposed(module.id)}
                  onCheckedChange={(on) => onToggle(module.id, on)}
                />
              }
            />
          ))}
    </SettingsSection>
  );
}

interface ConnectProps {
  origin: string;
  modules: readonly { id: string; name: string }[];
}

/** Everything a person pastes into their client: the URL, a configuration, and a token. */
export function McpConnectSection({ origin, modules }: ConnectProps) {
  const clipboard = useClipboard();
  const url = mcpEndpoint(origin);
  const snippet = mcpSnippet(url);
  return (
    <SettingsSection title="Connect a client" layout="block">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-13 font-medium text-tx">Endpoint</span>
          <CopyField
            label="Endpoint"
            value={url}
            copied={clipboard.copied === url}
            onCopy={() => void clipboard.copy(url, 'Endpoint copied')}
          />
          <span className="text-12 leading-body text-tx-3">
            Streamable HTTP. Clients that support sign-in only need this address: each person signs
            in to this workspace and chooses what the client may do. Others send a personal access
            token in the Authorization header.
          </span>
        </div>
        {modules.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-13 font-medium text-tx">One module only</span>
            {modules.map((module) => {
              const one = mcpEndpoint(origin, module.id);
              return (
                <CopyField
                  key={module.id}
                  label={`${module.name} endpoint`}
                  value={one}
                  copied={clipboard.copied === one}
                  onCopy={() => void clipboard.copy(one, `${module.name} endpoint copied`)}
                />
              );
            })}
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <span className="text-13 font-medium text-tx">Client configuration</span>
          <CopyField
            multiline
            label="Client configuration"
            value={snippet}
            copied={clipboard.copied === snippet}
            onCopy={() => void clipboard.copy(snippet, 'Configuration copied')}
          />
          <span className="text-12 leading-body text-tx-3">
            For a client without sign-in: paste this into its MCP settings and replace the
            placeholder with a token from your{' '}
            <Link to="/settings/access-tokens" className="text-acc">
              access tokens
            </Link>
            .
          </span>
        </div>
      </div>
    </SettingsSection>
  );
}
