import { Button, EntityTile } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ThemeSource } from '@bemmoly/ui/tokens';
import { useRef, useState, type DragEvent } from 'react';
import type { WorkspaceLogoState } from '../../hooks/use-workspace-logo.ts';
import { LOGO_ACCEPT, LOGO_HINT } from '../../lib/logo-file.ts';
import { FormAlert } from '../form.tsx';
import { AppearanceRow } from './appearance-row.tsx';
import { LogoPreview } from './logo-preview.tsx';

interface LogoRowProps {
  state: WorkspaceLogoState;
  source: ThemeSource;
}

/**
 * Settings › Appearance › Logo: drop or browse for the workspace's logo, see it in the sidebar
 * and the rail in both modes, then replace or remove it. Saved as soon as it is chosen.
 */
export function LogoRow({ state, source }: LogoRowProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const locked = !state.canManage || state.busy;
  const browse = () => input.current?.click();
  const pick = (files: FileList | null | undefined) => {
    const file = files?.[0];
    if (file) void state.choose(file);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (!locked) pick(event.dataTransfer.files);
  };

  return (
    <AppearanceRow
      label="Logo"
      help="Replaces line one of the sidebar and leads the sign-in page. “on Bemmoly” always stays under it."
    >
      {(labelId) => (
        <div className="flex flex-col gap-3">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!locked) setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            data-testid="logo-drop"
            className={`flex flex-wrap items-center gap-3 rounded-card border border-dashed px-4 py-3.5 motion-safe:transition-colors ${
              over ? 'border-acc bg-acc-50' : 'border-line bg-side'
            }`}
          >
            {state.logo ? (
              <EntityTile name={state.logo.name} src={state.logo.src} size={40} />
            ) : (
              <span className="grid size-10 place-items-center rounded-control bg-card text-tx-3">
                <Icon name="image" size={18} />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-13 text-tx-2">
                {state.logo ? 'Drop a new logo here to replace it' : 'Drop your logo here'}
              </span>
              <span className="text-12 text-tx-3">{LOGO_HINT}</span>
            </div>
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<Icon name="upload" />}
                disabled={locked}
                loading={state.busy}
                onClick={browse}
              >
                {state.logo ? 'Replace' : 'Upload logo'}
              </Button>
              {state.logo ? (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Icon name="trash" />}
                  disabled={locked}
                  onClick={state.remove}
                >
                  Remove
                </Button>
              ) : null}
            </span>
            <input
              ref={input}
              type="file"
              accept={LOGO_ACCEPT}
              aria-labelledby={labelId}
              className="sr-only"
              tabIndex={-1}
              disabled={locked}
              onChange={(event) => {
                pick(event.target.files);
                event.target.value = '';
              }}
            />
          </div>
          {state.error ? <FormAlert>{state.error}</FormAlert> : null}
          <LogoPreview source={source} workspaceName={state.workspaceName} logo={state.logo} />
          <span className="text-12 text-tx-3">
            The favicon, the tab title and the Bemmoly mark never change. Emails show your logo
            above a “Sent by Bemmoly for {state.workspaceName}” footer.
          </span>
        </div>
      )}
    </AppearanceRow>
  );
}
