import { useT } from '@bemmoly/core-web';
import { Button, Card, CardHeader, CustomFieldControl, FormGrid, useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ProfileFields } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { peopleKeys } from '../shared/keys.ts';

/**
 * The company's custom fields on a profile (ADR 0052). The kernel decides which the viewer
 * sees and may change; the person edits their own, People's admins anyone's.
 */
export function FieldsCard({ userId, fields }: { userId: string; fields: ProfileFields }) {
  const t = useT(peopleText);
  const toast = useToast();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Record<string, unknown>>(fields.values);
  const changed = Object.keys(draft).filter((key) => draft[key] !== fields.values[key]);
  const save = useMutation({
    mutationFn: () =>
      api.people.updateFields(
        userId,
        Object.fromEntries(changed.map((key) => [key, draft[key] ?? null])),
      ),
    onSuccess: async (saved) => {
      setDraft(saved.values);
      await client.invalidateQueries({ queryKey: peopleKeys.profile(userId) });
      toast.show({ tone: 'ok', title: t('people.profile.fieldsSaved') });
    },
  });
  const issues = new Map(
    (
      (save.error as { details?: { issues?: { path: string; message: string }[] } } | null)?.details
        ?.issues ?? []
    ).map((issue) => [issue.path, issue.message]),
  );
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={t('people.profile.fields')}
        actions={
          fields.canEdit && fields.definitions.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={changed.length === 0}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              {t('people.profile.saveFields')}
            </Button>
          ) : null
        }
      />
      <div className="px-3.5 py-3">
        {fields.definitions.length === 0 ? (
          <p className="m-0 text-13 text-tx-3">{t('people.profile.noFields')}</p>
        ) : (
          <FormGrid columns={2}>
            {fields.definitions.map((field) => (
              <CustomFieldControl
                key={field.key}
                field={{
                  key: field.key,
                  label: field.label,
                  kind: field.kind,
                  description: field.description,
                  required: field.required,
                  options: field.options,
                }}
                value={draft[field.key] ?? null}
                onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
                disabled={!fields.canEdit}
                error={issues.get(field.key)}
              />
            ))}
          </FormGrid>
        )}
      </div>
    </Card>
  );
}
