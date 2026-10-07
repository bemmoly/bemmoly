import { useSetupAi } from '../../hooks/use-ai-settings.ts';
import { ConnectionShell } from '../ai/connection-shell.tsx';
import { PrivacyRows } from '../ai/privacy-rows.tsx';
import { ProviderPicker } from '../ai/provider-picker.tsx';
import { StepFooter, type StepNav } from './step-footer.tsx';

/** Step 4: pick a provider (or none), see its connection form, and set the privacy rows. */
export function StepAi({ nav }: { nav: StepNav }) {
  const ai = useSetupAi(nav.next);
  return (
    <>
      <ProviderPicker picker={ai.picker} choice={ai.choice} onPick={ai.pick} />
      <ConnectionShell picker={ai.picker} />
      <PrivacyRows
        shareContent={ai.shareContent}
        onShareContent={ai.setShareContent}
        allowActions={ai.allowActions}
        onAllowActions={ai.setAllowActions}
      />
      <StepFooter nav={nav} onPrimary={ai.submit} loading={ai.save.isPending} />
    </>
  );
}
