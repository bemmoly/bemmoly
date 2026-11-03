import { useT } from '@bemmoly/core-web';
import { editorText } from '../../../i18n/catalog.ts';
import { PlannedScreen } from '../../screen-frame.tsx';

/** Platform › Templates (stream S4 builds it; placeholder until then). */
export default function TemplatesScreen() {
  const t = useT(editorText);
  return (
    <PlannedScreen
      title={t('pipelinesEditor.templates.title')}
      icon="shapes"
      description={t('pipelinesEditor.templates.planned')}
    />
  );
}
