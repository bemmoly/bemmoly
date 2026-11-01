import { useT } from '@bemmoly/core-web';
import { Button, Field, Input, Modal, Select } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { pipelinesKeys } from '../../api/pipelines.ts';
import { useDomains } from '../../hooks/use-catalog-tree.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { api } from '../../lib/api.ts';
import { slugOf } from '../../lib/slug.ts';
import { ActionError } from '../../parts/action-error.tsx';

/** The domain choice that asks for a new domain's name instead; never a valid key. */
const NEW_DOMAIN = '_new';

/**
 * A group, and its domain when there is none to put it in, made from Set up: an install starts
 * with no catalog, and accepting what discovery found needs a group for the applications that
 * name none. Keys come from the names; both can be renamed later.
 */
export function NewGroupDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** The new group as "domain/group", the value the group picker takes. */
  onCreated: (value: string) => void;
}) {
  const t = useT(pipelinesText);
  const client = useQueryClient();
  const domains = useDomains().data?.items ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const [domainName, setDomainName] = useState('');
  const [groupName, setGroupName] = useState('');
  const domain = picked ?? domains[0]?.key ?? NEW_DOMAIN;
  const newDomain = domain === NEW_DOMAIN;
  const ready = groupName.trim() !== '' && (!newDomain || domainName.trim() !== '');

  const close = () => {
    setPicked(null);
    setDomainName('');
    setGroupName('');
    create.reset();
    onClose();
  };
  const create = useMutation({
    mutationFn: async () => {
      const domainKey = newDomain
        ? (await api.catalog.createDomain({ key: slugOf(domainName), name: domainName.trim() })).key
        : domain;
      return api.catalog.createGroup({
        domain: domainKey,
        key: slugOf(groupName),
        name: groupName.trim(),
      });
    },
    onSuccess: (group) => {
      void client.invalidateQueries({ queryKey: pipelinesKeys.domains() });
      void client.invalidateQueries({ queryKey: ['pipelines', 'all-groups'] });
      onCreated(`${group.domain.key}/${group.key}`);
      close();
    },
  });
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (ready && !create.isPending) create.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      width="sm"
      title={t('pipelines.newGroup.title')}
      description={t('pipelines.newGroup.description')}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('pipelines.common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => submit()}
            loading={create.isPending}
            disabled={!ready}
          >
            {t('pipelines.newGroup.create')}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <ActionError error={create.error} />
        {domains.length > 0 && (
          <Field label={t('pipelines.newGroup.domain')}>
            <Select
              value={domain}
              onChange={(event) => setPicked(event.value)}
              options={[
                ...domains.map((item) => ({ value: item.key, label: item.name })),
                { value: NEW_DOMAIN, label: t('pipelines.newGroup.newDomain') },
              ]}
            />
          </Field>
        )}
        {newDomain && (
          <Field
            label={t('pipelines.newGroup.domainName')}
            hint={t('pipelines.newGroup.domainHint')}
          >
            <Input
              value={domainName}
              maxLength={80}
              autoFocus
              onChange={(event) => setDomainName(event.target.value)}
            />
          </Field>
        )}
        <Field label={t('pipelines.newGroup.groupName')} hint={t('pipelines.newGroup.groupHint')}>
          <Input
            value={groupName}
            maxLength={80}
            autoFocus={!newDomain}
            onChange={(event) => setGroupName(event.target.value)}
          />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
