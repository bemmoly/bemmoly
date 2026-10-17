import { z } from 'zod';
import type { GcpHttp } from './http.ts';

/* Cloud Billing Budgets v1: one monthly budget per project, with alert thresholds. */

const BASE = 'https://billingbudgets.googleapis.com/v1';

const budgetSchema = z.object({
  name: z.string(),
  displayName: z.string().optional(),
  amount: z
    .object({
      specifiedAmount: z
        .object({ currencyCode: z.string().optional(), units: z.string().optional() })
        .optional(),
    })
    .optional(),
  thresholdRules: z.array(z.object({ thresholdPercent: z.number() })).default([]),
});

export interface GcpBudget {
  name: string;
  displayName: string;
  amount: number | null;
  currency: string | null;
  thresholds: number[];
}

export interface BudgetInput {
  displayName: string;
  /** The project's number, not its id: budgets filter on "projects/123456789". */
  projectNumber: string;
  amount: number;
  currency: string;
  thresholds: readonly number[];
}

const toBudget = (raw: z.infer<typeof budgetSchema>): GcpBudget => ({
  name: raw.name,
  displayName: raw.displayName ?? '',
  amount: raw.amount?.specifiedAmount?.units ? Number(raw.amount.specifiedAmount.units) : null,
  currency: raw.amount?.specifiedAmount?.currencyCode ?? null,
  thresholds: raw.thresholdRules.map((rule) => rule.thresholdPercent),
});

const bodyOf = (input: BudgetInput) => ({
  displayName: input.displayName,
  budgetFilter: { projects: [`projects/${input.projectNumber}`] },
  amount: {
    specifiedAmount: { currencyCode: input.currency, units: String(Math.round(input.amount)) },
  },
  thresholdRules: input.thresholds.map((thresholdPercent) => ({ thresholdPercent })),
});

export function createBudgetsClient(http: GcpHttp) {
  return {
    async findByName(billingAccountId: string, displayName: string): Promise<GcpBudget | null> {
      let pageToken: string | undefined;
      do {
        const page = await http.send({
          url: `${BASE}/billingAccounts/${billingAccountId}/budgets`,
          query: { pageToken, pageSize: 100 },
          schema: z.object({
            budgets: z.array(budgetSchema).default([]),
            nextPageToken: z.string().optional(),
          }),
        });
        const found = page.budgets.find((budget) => budget.displayName === displayName);
        if (found) return toBudget(found);
        pageToken = page.nextPageToken || undefined;
      } while (pageToken);
      return null;
    },

    async create(billingAccountId: string, input: BudgetInput): Promise<GcpBudget> {
      const created = await http.send({
        method: 'POST',
        url: `${BASE}/billingAccounts/${billingAccountId}/budgets`,
        body: bodyOf(input),
        schema: budgetSchema,
      });
      return toBudget(created);
    },

    async update(name: string, input: BudgetInput): Promise<GcpBudget> {
      const updated = await http.send({
        method: 'PATCH',
        url: `${BASE}/${name}`,
        query: { updateMask: 'amount,thresholdRules' },
        body: bodyOf(input),
        schema: budgetSchema,
      });
      return toBudget(updated);
    },
  };
}

export type BudgetsClient = ReturnType<typeof createBudgetsClient>;
