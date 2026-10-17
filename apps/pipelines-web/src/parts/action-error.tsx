import { useT } from '@bemmoly/core-web';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../i18n/catalog.ts';
import { refusalOf } from '../lib/refusal.ts';

/**
 * Why an action did not happen, where it was asked for: a refusal names the rule and who can
 * grant it; any other failure says to try again. Announced politely, never as a toast alone.
 */
export function ActionError({ error }: { error: unknown }) {
  const t = useT(pipelinesText);
  if (!error) return null;
  const refusal = refusalOf(error);
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-control bg-amber-50 px-3 py-2 text-12 text-amber-tx"
    >
      <Icon name={refusal ? 'lock' : 'warning'} size={14} className="mt-0.5 shrink-0" />
      <span className="flex flex-col gap-0.5">
        <span>{refusal ? refusal.sentence : t('pipelines.common.actionFailed')}</span>
        {refusal?.askWho ? <span className="font-medium">{refusal.askWho}</span> : null}
      </span>
    </div>
  );
}
