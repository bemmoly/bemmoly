import type { AiBudgetStatus } from '@bemmoly/shared';
import {
  Field,
  Input,
  ProgressBar,
  SettingsSection,
  SettingsValue,
  SettingsValues,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import type { AiAdminSettings } from '../../hooks/use-ai-admin.ts';
import { formatUsd, monthName, nextMonthStart } from '../../lib/ai-format.ts';
import { describeError } from '../../lib/errors.ts';
import { toast } from '../../lib/toast.ts';

/** The 80% and 100% states in plain words; null while there is nothing to say. */
export function budgetNotice(
  budget: AiBudgetStatus,
): { tone: 'warn' | 'danger'; text: string } | null {
  const reset = nextMonthStart(budget.month);
  if (budget.state === 'paused') {
    return {
      tone: 'danger',
      text: `This month’s budget is spent. Standard and strong are paused until ${reset} or until the budget is raised: summaries, briefs and palette plans wait. Fast suggestions and search keep working.`,
    };
  }
  if (budget.state === 'warning') {
    return {
      tone: 'warn',
      text: `Over 80% of this month’s budget is spent. Admins were told. At 100%, standard and strong pause until ${reset}.`,
    };
  }
  return null;
}

/** Parses the typed amount: empty means no limit; otherwise a non-negative number. */
export function parseBudget(text: string): { value: number | null } | { error: string } {
  const trimmed = text.trim().replace(/^\$/, '').replace(/,/g, '');
  if (trimmed === '') return { value: null };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    return { error: 'Enter an amount in US dollars, such as 150, or leave it empty for no limit' };
  }
  return { value: Math.round(value * 100) / 100 };
}

const FILL = { ok: 'bg-acc-500', unlimited: 'bg-acc-500', warning: 'bg-amber', paused: 'bg-red' };

/**
 * The monthly budget: a read view with Edit (the amount is typed, so it is not a toggle), the
 * month's spend against it, and what 80% and 100% mean.
 */
export function BudgetSection({
  admin,
  budget,
}: {
  admin: AiAdminSettings;
  budget: AiBudgetStatus | undefined;
}) {
  const limit = admin.settings?.budget.monthlyBudgetUsd ?? null;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const start = () => {
    setText(limit === null ? '' : String(limit));
    setError(null);
    setEditing(true);
  };
  const save = async () => {
    const parsed = parseBudget(text);
    if ('error' in parsed) return setError(parsed.error);
    try {
      await admin.save({ budget: { monthlyBudgetUsd: parsed.value } });
      toast(
        parsed.value === null
          ? 'No monthly limit'
          : `Monthly budget set to ${formatUsd(parsed.value)}`,
      );
      setEditing(false);
    } catch (failure) {
      setError(describeError(failure).message);
    }
  };
  const notice = budget ? budgetNotice(budget) : null;
  const ratio = budget?.ratio ?? null;
  return (
    <SettingsSection
      title="Monthly budget"
      hint={budget ? monthName(budget.month) : undefined}
      mode={editing ? 'edit' : 'read'}
      onEdit={start}
      onCancel={() => setEditing(false)}
      onSave={() => void save()}
      dirty={editing && text.trim() !== (limit === null ? '' : String(limit))}
      saving={admin.pending}
      note="Counted from every AI call this calendar month (UTC), at the catalog’s prices."
    >
      {editing ? (
        <Field
          label="Limit in US dollars"
          hint="Leave it empty for no limit"
          error={error ?? undefined}
        >
          <Input
            size="lg"
            inputMode="decimal"
            autoFocus
            prefix={<span className="text-tx-3">$</span>}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="tabular-nums"
          />
        </Field>
      ) : (
        <SettingsValues>
          <SettingsValue label="Limit">
            {limit === null ? 'No limit' : formatUsd(limit)}
          </SettingsValue>
          <SettingsValue label="Spent">
            <span className="tabular-nums">
              {budget ? formatUsd(budget.spentUsd) : '…'}
              {ratio !== null ? ` · ${Math.round(ratio * 100)}%` : ''}
            </span>
          </SettingsValue>
        </SettingsValues>
      )}
      {!editing && ratio !== null && budget ? (
        <ProgressBar
          value={ratio * 100}
          size="md"
          label="Share of this month’s budget spent"
          fillClassName={FILL[budget.state]}
        />
      ) : null}
      {notice ? (
        <p
          role={notice.tone === 'danger' ? 'alert' : 'status'}
          className={`m-0 flex items-start gap-2 rounded-control px-3 py-2.5 text-13 leading-body ${
            notice.tone === 'danger' ? 'bg-red-50 text-red-tx' : 'bg-amber-50 text-amber-tx'
          }`}
        >
          <Icon name="warning" className="mt-0.5 shrink-0" />
          {notice.text}
        </p>
      ) : null}
    </SettingsSection>
  );
}
