import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';

export interface Finding {
  rule: string;
  impact: string;
  targets: string[];
  /** Why each target failed, in axe's words (the colours and ratio, for contrast). */
  why: string[];
}

/**
 * Every rule axe ships, colour contrast included: WCAG 2.0 to 2.2 A and AA plus axe's best
 * practices (landmarks, heading order, one main). Nothing is disabled. The shell's own
 * toasts region and the boot frame are part of the page and are checked with it.
 */
export async function audit(page: Page): Promise<Finding[]> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  return violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact ?? 'unknown',
    targets: violation.nodes.map((node) => node.target.join(' ')),
    why: violation.nodes.map((node) => node.failureSummary?.split('\n')[1]?.trim() ?? ''),
  }));
}

export const describe = (findings: Finding[]) =>
  findings.map((finding) => `${finding.rule}: ${finding.targets.join(', ')}`);
