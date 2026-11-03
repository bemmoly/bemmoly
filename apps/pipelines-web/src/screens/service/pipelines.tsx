import { useT } from '@bemmoly/core-web';
import { editorText, servicesText } from '../../i18n/catalog.ts';
import { PlannedScreen } from '../screen-frame.tsx';

/** A service's Pipelines tab: setup and the editor (stream S4 builds it; placeholder until then). */
export default function ServicePipelines() {
  const t = useT(servicesText);
  const editor = useT(editorText);
  return (
    <PlannedScreen
      title={t('pipelinesServices.tab.pipelines')}
      icon="branch"
      description={editor('pipelinesEditor.pipelines.planned')}
    />
  );
}
