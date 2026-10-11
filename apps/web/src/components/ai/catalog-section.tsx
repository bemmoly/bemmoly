import { queryKeys } from '@bemmoly/api-client';
import type { AiCatalogStatus, CatalogData } from '@bemmoly/shared';
import { Button, SettingsRow, SettingsSection, Switch } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import type { AiAdminSettings } from '../../hooks/use-ai-admin.ts';
import { aiCatalogQuery } from '../../hooks/use-ai-catalog.ts';
import { api } from '../../lib/api.ts';
import { describeError } from '../../lib/errors.ts';
import { toast } from '../../lib/toast.ts';

/** The status line's dot: green while live, grey when the catalog is a stored copy. */
export function CatalogStatusLine({ status }: { status: AiCatalogStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-12 text-tx-3">
      <span
        aria-hidden
        className={`size-1.75 shrink-0 rounded-full ${status.offline ? 'bg-tx-3' : 'bg-green'}`}
      />
      {status.line}
    </span>
  );
}

async function readCatalogFile(file: File): Promise<CatalogData> {
  try {
    return JSON.parse(await file.text()) as CatalogData;
  } catch {
    throw new Error(`${file.name} isn't JSON. Upload the api.json file from models.dev.`);
  }
}

/**
 * Where the provider list comes from: the status line, the live fetch (on by default; off
 * means uploads and releases only), and uploading a newer catalog file from any machine.
 */
export function CatalogSection({ admin }: { admin: AiAdminSettings }) {
  const client = useQueryClient();
  const catalog = useQuery(aiCatalogQuery);
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => api.ai.catalog.upload(await readCatalogFile(file)),
    onSuccess: async (status) => {
      toast(`Catalog updated · ${status.providerCount} providers, ${status.modelCount} models`);
      await client.invalidateQueries({ queryKey: queryKeys.ai.all() });
    },
    onError: (error) => toast(describeError(error).message, 'danger'),
  });
  const live = admin.settings?.liveCatalog ?? true;
  return (
    <SettingsSection
      title="Catalog"
      hint={catalog.data ? <CatalogStatusLine status={catalog.data.status} /> : undefined}
      layout="rows"
    >
      <SettingsRow
        title="Fetch the catalog live"
        description="The server asks models.dev for new providers and models, sending no workspace data. Off, Bemmoly uses uploads and the copy each release ships."
        control={
          <Switch
            aria-label="Fetch the catalog live"
            checked={live}
            onCheckedChange={(value) =>
              admin.change(
                { liveCatalog: value },
                { title: value ? 'Live catalog on' : 'Live catalog off' },
              )
            }
          />
        }
      />
      <SettingsRow
        title="Upload a catalog file"
        description="For servers that can't reach models.dev: download api.json on any machine that can, then upload it here."
        control={
          <>
            <input
              ref={input}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) upload.mutate(file);
              }}
            />
            <Button
              size="sm"
              icon={<Icon name="upload" />}
              loading={upload.isPending}
              onClick={() => input.current?.click()}
            >
              Upload catalog file…
            </Button>
          </>
        }
      />
    </SettingsSection>
  );
}
