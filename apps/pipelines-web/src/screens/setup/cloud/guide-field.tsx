import { useT } from '@bemmoly/core-web';
import { Field, Input } from '@bemmoly/ui';
import { setupText } from '../../../i18n/catalog.ts';
import { fieldValid, type GuideField } from './guide-values.ts';
import type { Guide } from './use-guide.ts';

/** One value a step's command needs: what was typed, or a suggestion marked as one. */
export function GuideFieldInput({ guide, field }: { guide: Guide; field: GuideField }) {
  const t = useT(setupText);
  const value = guide.valueOf(field);
  const wrong = value.trim().length > 0 && !fieldValid(field, value);
  return (
    <Field
      label={t(`pipelinesSetup.guide.field.${field}`)}
      hint={
        guide.suggestedOnly(field)
          ? t('pipelinesSetup.guide.suggested')
          : t(`pipelinesSetup.guide.field.${field}Hint`)
      }
      error={wrong ? t(`pipelinesSetup.guide.field.${field}Invalid`) : null}
    >
      <Input
        mono={field !== 'folderName' && field !== 'you'}
        value={value}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => guide.setValue([field, event.target.value])}
      />
    </Field>
  );
}
