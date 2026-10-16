import { useT } from '@bemmoly/core-web';
import type { DiscoveryProposal } from '@bemmoly/module-pipelines/shared';
import {
  Button,
  Checkbox,
  Field,
  Select,
  Table,
  Tag,
  useToast,
  type TableColumn,
} from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useDomains } from '../../hooks/use-catalog-tree.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { api } from '../../lib/api.ts';
import { refusalOf } from '../../parts/load-failed.tsx';
import { Panel } from '../../parts/screen.tsx';

/** Every group as "domain/group", for proposals that found no group of their own. */
function useGroupOptions() {
  const domains = useDomains().data?.items ?? [];
  return useQuery({
    queryKey: ['pipelines', 'all-groups', domains.map((domain) => domain.key)],
    queryFn: async () => {
      const pages = await Promise.all(domains.map((domain) => api.pipelines.groups(domain.key)));
      return pages.flatMap((page) =>
        page.items.map((group) => ({
          value: `${group.domain.key}/${group.key}`,
          label: `${group.domain.name} › ${group.name}`,
        })),
      );
    },
    enabled: domains.length > 0,
    staleTime: 5 * 60_000,
  });
}

/**
 * What the scan found: deployable things with the signals that gave them away and the owner
 * CODEOWNERS or a Backstage file names. Accepting adds them to the catalog and opens one pull
 * request per repository with their application.yaml.
 */
export function Proposals({ items }: { items: readonly DiscoveryProposal[] }) {
  const t = useT(pipelinesText);
  const toast = useToast();
  const client = useQueryClient();
  const groups = useGroupOptions();
  const [picked, setPicked] = useState<ReadonlySet<string>>(
    () => new Set(items.map((item) => item.id)),
  );
  const [group, setGroup] = useState('');
  const needsGroup = items.some((item) => picked.has(item.id) && !item.group);
  const accept = useMutation({
    mutationFn: () =>
      api.platform.acceptProposals({
        items: items.filter((item) => picked.has(item.id)).map((item) => ({ id: item.id })),
        ...(group ? { group } : {}),
        openPullRequests: true,
      }),
    onSuccess: (result) => {
      toast.show({
        tone: result.failed.length ? 'warn' : 'ok',
        title: t('pipelines.start.accepted', { count: result.created.length }),
        body: result.failed.length
          ? t('pipelines.start.acceptFailed', { count: result.failed.length })
          : t('pipelines.start.pullRequests', { count: result.pullRequests.length }),
      });
      void client.invalidateQueries({ queryKey: ['pipelines'] });
    },
    onError: (error) =>
      toast.show({
        tone: 'danger',
        title: t('pipelines.start.acceptError'),
        body: refusalOf(error)?.sentence ?? t('pipelines.common.loadFailed'),
      }),
  });
  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const columns: TableColumn<DiscoveryProposal>[] = [
    {
      key: 'pick',
      header: '',
      width: '28px',
      render: (item) => (
        <Checkbox
          checked={picked.has(item.id)}
          onChange={() => toggle(item.id)}
          aria-label={t('pipelines.start.pick', { name: item.name })}
        />
      ),
    },
    {
      key: 'name',
      header: t('pipelines.releases.colApplication'),
      width: 'minmax(0,1.2fr)',
      render: (item) => (
        <span className="flex min-w-0 flex-col leading-card">
          <span className="truncate font-medium text-tx">{item.name}</span>
          <span className="truncate font-mono text-11 text-tx-3">
            {item.repository.fullName}
            {item.path ? `/${item.path}` : ''}
          </span>
        </span>
      ),
    },
    {
      key: 'signals',
      header: t('pipelines.start.found'),
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (item) => (
        <span className="flex flex-wrap gap-1">
          {item.signals.slice(0, 3).map((signal) => (
            <Tag key={signal} size="sm">
              {t(`pipelines.signal.${signal}`)}
            </Tag>
          ))}
        </span>
      ),
    },
    {
      key: 'owner',
      header: t('pipelines.start.owner'),
      width: 'minmax(0,0.8fr)',
      render: (item) =>
        item.owner?.team ? (
          <span className="truncate text-12 text-tx">{item.owner.team.name}</span>
        ) : (
          <span className="truncate text-12 text-amber-tx">
            {item.owner
              ? t('pipelines.start.ownerUnknown', { raw: item.owner.raw })
              : t('pipelines.start.noOwner')}
          </span>
        ),
    },
  ];
  return (
    <Panel
      flush
      title={t('pipelines.start.reviewTitle')}
      meta={t('pipelines.start.reviewMeta', { picked: picked.size, total: items.length })}
    >
      <Table
        label={t('pipelines.start.reviewTitle')}
        columns={columns}
        rows={items}
        rowKey={(item) => item.id}
        density="sm"
      />
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-end">
        {needsGroup && (
          <Field
            label={t('pipelines.start.group')}
            hint={t('pipelines.start.groupHint')}
            className="md:w-80"
          >
            <Select
              value={group}
              searchable
              placeholder={t('pipelines.start.pickGroup')}
              options={groups.data ?? []}
              onChange={(event) => setGroup(event.value)}
            />
          </Field>
        )}
        <p className="flex-1 text-12 text-tx-3">{t('pipelines.start.noOwnerNote')}</p>
        <Button
          variant="primary"
          disabled={picked.size === 0 || (needsGroup && !group)}
          loading={accept.isPending}
          onClick={() => accept.mutate()}
        >
          {t('pipelines.start.accept', { count: picked.size })}
        </Button>
      </div>
    </Panel>
  );
}
