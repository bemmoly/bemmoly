/* Row shape of the webhook inbox as the inbox service selects it. */

export interface InboxRow {
  id: string;
  provider: string;
  delivery_id: string;
  event: string;
  repository_full_name: string | null;
  payload: unknown;
  state: 'pending' | 'processing' | 'done' | 'failed' | 'ignored';
  attempts: number;
}
