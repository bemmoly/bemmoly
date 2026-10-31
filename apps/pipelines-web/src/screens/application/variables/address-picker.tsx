import { useT } from '@bemmoly/core-web';
import { appReferenceText } from '@bemmoly/module-pipelines/shared';
import { Select } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { api } from '../../../lib/api.ts';

const PICK = 'pick';

/**
 * Inserts another application's address into a plain value: `${{ apps.<key>.url }}` for the
 * address services in the same environment call, `.publicUrl` for the internet's. Each is
 * filled in per environment when the application deploys there.
 */
export function AddressPicker({
  application,
  onPick,
}: {
  application: string;
  onPick: (reference: string) => void;
}) {
  const t = useT(pipelinesText);
  const others = useQuery({
    queryKey: ['pipelines', 'address-picker'],
    queryFn: () => api.pipelines.applications({ limit: 200 }),
  });
  const items = (others.data?.items ?? []).filter((item) => item.key !== application);
  return (
    <Select
      size="sm"
      searchable
      aria-label={t('pipelines.variables.insertAddress')}
      value={PICK}
      options={[
        { value: PICK, label: t('pipelines.variables.insertAddress') },
        ...items.flatMap((item) => [
          {
            value: appReferenceText(item.key, 'url'),
            label: t('pipelines.variables.addressUrl', { application: item.key }),
            description: appReferenceText(item.key, 'url'),
          },
          {
            value: appReferenceText(item.key, 'publicUrl'),
            label: t('pipelines.variables.addressPublic', { application: item.key }),
            description: appReferenceText(item.key, 'publicUrl'),
          },
        ]),
      ]}
      onChange={(event) => event.value !== PICK && onPick(event.value)}
    />
  );
}
