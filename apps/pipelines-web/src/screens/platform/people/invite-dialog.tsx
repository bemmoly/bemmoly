import { ApiError } from '@bemmoly/api-client';
import { useT } from '@bemmoly/core-web';
import { personRoleSchema, type PersonRole } from '@bemmoly/module-pipelines/shared';
import type { IssuedInvitation } from '@bemmoly/shared';
import { Button, Field, Modal, Select, Textarea, useToast, type SelectOption } from '@bemmoly/ui';
import { useState } from 'react';
import { looksLikeEmail, parseEmails, useInvitePeople } from '../../../hooks/use-invite.ts';
import { useReturnToChecklist } from '../../../hooks/use-setup.ts';
import { rolesText } from '../../../i18n/catalog.ts';
import { PickMany } from './pick-many.tsx';

/**
 * Invite people with one role and, optionally, approval groups. When the install sends no
 * email, the accept links come back to share by hand.
 */
export function InviteDialog({
  open,
  onClose,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  groups: readonly SelectOption[];
}) {
  const t = useT(rolesText);
  const toast = useToast();
  const invite = useInvitePeople();
  const backToChecklist = useReturnToChecklist();
  const [text, setText] = useState('');
  const [role, setRole] = useState<PersonRole>('developer');
  const [picked, setPicked] = useState<string[]>([]);
  const [links, setLinks] = useState<IssuedInvitation[]>([]);
  const emails = parseEmails(text);
  const bad = emails.find((email) => !looksLikeEmail(email));
  const close = () => {
    invite.reset();
    setText('');
    setPicked([]);
    setLinks([]);
    onClose();
  };
  const submit = () => {
    if (emails.length === 0 || bad) return;
    invite.mutate(
      { emails, role, groups: picked },
      {
        onSuccess: (outcome) => {
          const sent = t('pipelinesRoles.invite.sent', { count: outcome.count });
          if (outcome.links.length > 0) {
            toast.show({ tone: 'ok', title: sent });
            setLinks(outcome.links);
            return;
          }
          close();
          // A finished setup step goes back to the checklist; the helper shows the toast.
          void backToChecklist(sent);
        },
      },
    );
  };
  if (links.length > 0) {
    return (
      <Modal
        open={open}
        onClose={close}
        title={t('pipelinesRoles.invite.shareTitle')}
        description={t('pipelinesRoles.invite.shareBody')}
        footer={
          <Button variant="primary" onClick={close}>
            {t('pipelinesRoles.invite.done')}
          </Button>
        }
      >
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.id} className="flex flex-col gap-0.5">
              <span className="text-13 font-medium text-tx">{link.email}</span>
              <span className="font-mono text-12 break-all text-tx-2">{link.acceptUrl}</span>
            </li>
          ))}
        </ul>
      </Modal>
    );
  }
  return (
    <Modal
      open={open}
      onClose={close}
      title={t('pipelinesRoles.invite.title')}
      description={t('pipelinesRoles.invite.description')}
      footer={
        <Button
          variant="primary"
          disabled={emails.length === 0 || Boolean(bad)}
          loading={invite.isPending}
          onClick={submit}
        >
          {t('pipelinesRoles.invite.send')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field
          label={t('pipelinesRoles.invite.emails')}
          hint={t('pipelinesRoles.invite.emailsHint')}
          error={
            bad
              ? t('pipelinesRoles.invite.badEmail', { email: bad })
              : invite.error instanceof ApiError
                ? invite.error.message
                : null
          }
        >
          <Textarea
            value={text}
            autoFocus
            rows={3}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
        <Field label={t('pipelinesRoles.invite.role')}>
          <Select
            value={role}
            options={personRoleSchema.options.map((value) => ({
              value,
              label: t(`pipelinesRoles.role.${value}`),
              description: t(`pipelinesRoles.roleCard.${value}`),
            }))}
            onChange={(event) => setRole(event.value as PersonRole)}
          />
        </Field>
        {groups.length > 0 && (
          <Field
            label={t('pipelinesRoles.invite.groups')}
            hint={t('pipelinesRoles.invite.groupsHint')}
          >
            <PickMany
              label={t('pipelinesRoles.invite.groups')}
              options={groups}
              value={picked}
              onChange={setPicked}
              placeholder={t('pipelinesRoles.invite.pickGroups')}
              removeLabel={(name) => name}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
