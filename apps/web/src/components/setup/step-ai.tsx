import { Card, CardBody } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { LOCAL_SERVER } from '../../hooks/use-ai-catalog.ts';
import { useConnection } from '../../hooks/use-ai-connection.ts';
import { NO_AI_OPTION } from '../../hooks/use-ai-settings.ts';
import { useSetupAi, type SetupAi } from '../../hooks/use-setup-ai.ts';
import { NO_AI } from '../../store/setup.ts';
import { ConnectionForm } from '../ai/connection-form.tsx';
import { PrivacyRows } from '../ai/privacy-rows.tsx';
import { ProviderPicker } from '../ai/provider-picker.tsx';
import { RolesSection } from '../ai/roles-section.tsx';
import { TestResult } from '../ai/test-result.tsx';
import { ChoiceCard } from './choice-card.tsx';
import { StepFooter, StepForm, type StepNav } from './step-footer.tsx';

function Connected({ ai }: { ai: SetupAi }) {
  const row = ai.provider;
  if (!row) return null;
  return (
    <TestResult
      result={{
        ok: row.status !== 'failed',
        message:
          row.status === 'failed'
            ? (row.lastError ?? `${row.name} didn’t answer.`)
            : `${row.name} is connected. Suggested models are chosen below; change any of them.`,
        latencyMs: null,
        model: null,
        modelsFound: null,
        checkedAt: row.updatedAt,
      }}
      error={null}
    />
  );
}

/**
 * AI: no AI by default, and skipping is a first-class answer. Otherwise the Popular row and
 * the whole catalog, the form the chosen entry generates with Test and Connect, the four roles
 * with the suggested models chosen, and the two privacy choices. Same API as Settings › AI.
 */
export function StepAi({ nav }: { nav: StepNav }) {
  const ai = useSetupAi(nav.next);
  const selected = ai.selected;
  const connection = useConnection(selected ?? LOCAL_SERVER, (row) => void ai.onConnected(row));
  const busy = ai.save.isPending || connection.connect.pending;
  const submit = async () => {
    if (ai.none || ai.provider) return ai.submit();
    const row = await connection.connect.runAsync().catch(() => null);
    if (row) {
      await ai.onConnected(row);
      ai.submit(row);
    }
  };
  const label = ai.none
    ? 'Continue without AI'
    : ai.provider
      ? 'Save AI settings'
      : 'Connect and continue';
  return (
    <StepForm label="AI" onSubmit={() => void submit()} busy={busy}>
      <div role="radiogroup" aria-label="No AI" className="grid gap-2.5 sm:grid-cols-2">
        <ChoiceCard
          initials="0"
          icon={<Icon name="minus" />}
          name={NO_AI_OPTION.name}
          description={NO_AI_OPTION.description}
          selected={ai.none}
          onSelect={() => ai.pick(NO_AI)}
        />
      </div>
      <h2 className="m-0 text-13 font-semibold text-tx">Or connect a provider</h2>
      <ProviderPicker
        catalog={ai.catalog}
        query={ai.query}
        onQuery={ai.setQuery}
        choice={ai.choice}
        onPick={ai.pick}
      />
      {selected ? (
        <>
          <Card aria-label={`Connect ${selected.name}`}>
            <CardBody className="flex flex-col gap-3">
              {ai.provider ? (
                <Connected ai={ai} />
              ) : (
                <ConnectionForm connection={connection} inline />
              )}
            </CardBody>
          </Card>
          {ai.provider ? <RolesSection roles={ai.roles} /> : null}
          <PrivacyRows
            title="What AI may see and do"
            shareContent={ai.shareContent}
            onShareContent={ai.setShareContent}
            allowActions={ai.allowActions}
            onAllowActions={ai.setAllowActions}
          />
        </>
      ) : null}
      <StepFooter
        nav={{
          ...nav,
          skip: () => {
            ai.skip();
            nav.skip();
          },
        }}
        label={label}
        skipLabel="Skip, no AI"
        loading={busy}
        error={ai.save.error}
      />
    </StepForm>
  );
}
