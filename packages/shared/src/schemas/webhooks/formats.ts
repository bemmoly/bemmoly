import { z } from 'zod';

/*
 * What a delivery's body looks like. `json` sends the versioned envelope as it
 * is; the others are chat presets: plain data, a body shape with placeholders
 * the kernel fills in. Chat tools that take incoming webhooks accept one of
 * these shapes, so no tool needs code of its own. Placeholders: {{summary}},
 * {{url}} (absolute), {{event}} (the kind) and {{label}} (its name).
 */

export const WEBHOOK_FORMAT_IDS = ['json', 'chat_text', 'chat_blocks', 'chat_card'] as const;

export const webhookFormatSchema = z.enum(WEBHOOK_FORMAT_IDS);

export type WebhookFormat = z.infer<typeof webhookFormatSchema>;

export interface WebhookFormatPreset {
  id: WebhookFormat;
  label: string;
  description: string;
  /** The body with placeholders; null sends the envelope itself. */
  template: Record<string, unknown> | null;
}

export const WEBHOOK_FORMATS: readonly WebhookFormatPreset[] = [
  {
    id: 'json',
    label: 'JSON event',
    description: 'The versioned event envelope, for your own services',
    template: null,
  },
  {
    id: 'chat_text',
    label: 'Chat message, text',
    description: 'A "text" field, which most chat tools accept on an incoming webhook',
    template: { text: '{{summary}}\n{{url}}' },
  },
  {
    id: 'chat_blocks',
    label: 'Chat message, blocks',
    description: 'A text fallback plus a section block with a link',
    template: {
      text: '{{summary}}',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: '*{{label}}*\n<{{url}}|{{summary}}>' } },
      ],
    },
  },
  {
    id: 'chat_card',
    label: 'Chat card',
    description: 'A message card with a title, the summary and an open button',
    template: {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: '{{summary}}',
      title: '{{label}}',
      text: '{{summary}}',
      potentialAction: [
        { '@type': 'OpenUri', name: 'Open', targets: [{ os: 'default', uri: '{{url}}' }] },
      ],
    },
  },
];

export const webhookFormatPresetSchema = z.object({
  id: webhookFormatSchema,
  label: z.string(),
  description: z.string(),
  template: z.record(z.string(), z.unknown()).nullable(),
});
