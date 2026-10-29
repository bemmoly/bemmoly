import { useT } from '@bemmoly/core-web';
import { Button, Tooltip, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useExportDownload } from '../../hooks/use-exports.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { sentenceOf } from '../../lib/refusal.ts';

/**
 * This application's services as Terraform and Helm, in every environment it runs in: the
 * same export as Platform › Export, narrowed to it. A refusal or nothing to export says why.
 */
export function ExportButton({ application, ready }: { application: string; ready: boolean }) {
  const t = useT(pipelinesText);
  const toast = useToast();
  const download = useExportDownload();
  return (
    <Tooltip label={t('pipelines.application.exportTip')}>
      <Button
        variant="ghost"
        disabled={!ready}
        loading={download.isPending}
        onClick={() =>
          download.mutate(
            { application },
            {
              onSuccess: (preview) =>
                toast.show({
                  tone: 'ok',
                  title: t('pipelines.export.started', { file: preview.fileName }),
                }),
              onError: (error) =>
                toast.show({
                  tone: 'danger',
                  title: t('pipelines.application.exportFailed'),
                  body: sentenceOf(error) ?? t('pipelines.common.actionFailed'),
                }),
            },
          )
        }
      >
        <Icon name="download" size={14} />
        {t('pipelines.application.export')}
      </Button>
    </Tooltip>
  );
}
