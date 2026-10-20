/**
 * Jira's published per-user list prices, the only numbers the savings calculator on
 * /jira-alternative uses for the other column. Source: Atlassian's Jira pricing page,
 * https://www.atlassian.com/software/jira/pricing (cloud, billed monthly, per user, in US
 * dollars, before tax). Atlassian changes these prices, discounts annual billing and prices
 * large teams differently, so check the page and move JIRA_PRICING_AS_OF with any change.
 */
export const JIRA_PRICING_AS_OF = '2026-10-21';

export const JIRA_PRICING_SOURCE = 'https://www.atlassian.com/software/jira/pricing';

export type JiraPlan = 'standard' | 'premium';

export const JIRA_PLANS: Readonly<Record<JiraPlan, { label: string; perUserMonthly: number }>> = {
  standard: { label: 'Standard', perUserMonthly: 7.53 },
  premium: { label: 'Premium', perUserMonthly: 13.53 },
};
