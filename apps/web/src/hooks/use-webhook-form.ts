import { queryKeys } from '@bemmoly/api-client';
import {
  createWebhookBodySchema,
  WEBHOOK_EVENTS,
  WEBHOOK_FORMATS,
  type CreateWebhookBody,
  type DomainEventKind,
  type ModuleManifest,
  type Webhook,
  type WebhookCatalog,
  type WebhookFormat,
  type WebhookFormatPreset,
  type WebhookWithSecret,
} from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { serverFieldErrors, validateForm, type FieldErrors } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { useModules } from './use-modules.ts';
import { webhookKey } from './use-webhooks.ts';

export interface WebhookForm {
  name: string;
  url: string;
  events: DomainEventKind[];
  format: WebhookFormat;
  enabled: boolean;
}

export const EMPTY_WEBHOOK: WebhookForm = {
  name: '',
  url: '',
  events: [],
  format: 'json',
  enabled: true,
};

export const formOf = (webhook: Webhook): WebhookForm => ({
  name: webhook.name,
  url: webhook.url,
  events: [...webhook.events],
  format: webhook.format,
  enabled: webhook.enabled,
});

export const toWebhookBody = (form: WebhookForm): CreateWebhookBody => ({
  ...form,
  name: form.name.trim(),
  url: form.url.trim(),
});

export interface EventGroup {
  moduleId: string;
  label: string;
  events: { kind: DomainEventKind; label: string }[];
}

/** The events each enabled module publishes, under the module's name; others offer none. */
export function groupEvents(
  events: readonly WebhookCatalog['events'][number][],
  modules: readonly Pick<ModuleManifest, 'id' | 'name'>[],
): EventGroup[] {
  return modules
    .map((module) => ({
      moduleId: module.id,
      label: module.name ?? module.id,
      events: events
        .filter((event) => event.moduleId === module.id)
        .map(({ kind, label }) => ({ kind, label })),
    }))
    .filter((group) => group.events.length > 0);
}

/** An example envelope for the JSON format, the shape a receiver parses. */
const SAMPLE_ENVELOPE = {
  version: '1',
  id: '0192f1c4-…',
  event: 'issue.transitioned',
  occurredAt: '2026-10-11T09:30:00.000Z',
  workspace: { url: 'https://bemmoly.example.com' },
  actor: { kind: 'user', id: '0192…' },
  entity: { kind: 'issue', id: '0192…' },
  summary: 'PLT-12 Fix the login moved to Done',
  url: 'https://bemmoly.example.com/work/issue/PLT-12',
  data: {},
};

/** What a preset sends, as indented JSON: the envelope, or the chat body with placeholders. */
export const formatPreview = (preset: Pick<WebhookFormatPreset, 'template'>) =>
  JSON.stringify(preset.template ?? SAMPLE_ENVELOPE, null, 2);

const toggle = <T>(list: readonly T[], value: T) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/**
 * New webhook and Edit: the form, its checks (the shared schema, so the words match the
 * server's), the catalog offered by the enabled modules, and the secret a create answers with.
 */
export function useWebhookForm(editing: Webhook | null, onClose: () => void) {
  const client = useQueryClient();
  const [form, setForm] = useState<WebhookForm>(editing ? formOf(editing) : EMPTY_WEBHOOK);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [created, setCreated] = useState<WebhookWithSecret | null>(null);
  const catalog = useQuery({
    queryKey: queryKeys.webhooks.catalog(),
    queryFn: () => api.webhooks.catalog(),
    staleTime: 5 * 60_000,
  });
  const modules = useModules();
  const groups = groupEvents(catalog.data?.events ?? WEBHOOK_EVENTS, modules.data ?? []);
  const formats = catalog.data?.formats ?? WEBHOOK_FORMATS;

  const save = useMutation({
    mutationFn: async (body: CreateWebhookBody) =>
      editing
        ? { webhook: await api.webhooks.update(editing.id, body), created: null }
        : { webhook: null, created: await api.webhooks.create(body) },
    onSuccess: async ({ webhook, created: made }) => {
      await client.invalidateQueries({ queryKey: queryKeys.webhooks.all() });
      if (made) return setCreated(made);
      if (!webhook) return undefined;
      client.setQueryData(webhookKey(webhook.id), webhook);
      toast(`${webhook.name} saved`);
      return close();
    },
    onError: (error) => setErrors(serverFieldErrors(error)),
  });

  const update = (patch: Partial<WebhookForm>) => setForm((current) => ({ ...current, ...patch }));
  const submit = (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    const checked = validateForm(createWebhookBodySchema, toWebhookBody(form));
    setErrors(checked.errors ?? {});
    if (checked.data) save.mutate(toWebhookBody(form));
  };
  const close = () => {
    setForm(EMPTY_WEBHOOK);
    setErrors({});
    setCreated(null);
    save.reset();
    onClose();
  };
  return {
    form,
    errors,
    update,
    toggleEvent: (kind: DomainEventKind) => update({ events: toggle(form.events, kind) }),
    setGroup: (group: EventGroup, on: boolean) => {
      const kinds = group.events.map((event) => event.kind);
      const rest = form.events.filter((kind) => !kinds.includes(kind));
      update({ events: on ? [...rest, ...kinds] : rest });
    },
    groups,
    formats,
    loading: catalog.isPending || modules.isPending,
    submit,
    close,
    save,
    created,
  };
}
