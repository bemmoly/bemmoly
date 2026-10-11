import { useSetupImport } from '../../hooks/use-setup-import.ts';
import { Loading } from '../form.tsx';
import { ImportFlowBody } from '../import/import-flow-body.tsx';
import { SourcePicker } from '../import/source-picker.tsx';
import { StepFooter, StepForm, type StepNav } from './step-footer.tsx';

/**
 * Import: the same flow as Settings › Import beside Start clean. The connection form and the
 * run sit below the cards, outside the step's form, so Connect never submits the step.
 */
export function StepImport({ nav }: { nav: StepNav }) {
  const { flow, cards, selected, select, loading, notice, label, canStart, start } = useSetupImport(
    nav.next,
  );
  return (
    <div className="flex flex-col gap-6">
      {loading ? (
        <Loading label="Loading import sources" />
      ) : (
        <SourcePicker cards={cards} selected={selected} onSelect={select} />
      )}
      {selected === 'clean' ? null : <ImportFlowBody flow={flow} />}
      <StepForm label="Import" onSubmit={start}>
        <p className="m-0 text-13 text-tx-3">{notice}</p>
        <StepFooter nav={nav} label={label} disabled={!canStart} />
      </StepForm>
    </div>
  );
}
