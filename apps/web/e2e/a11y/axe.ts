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
 * practices (landmarks, heading order, one main). No rule is disabled. The shell's own
 * toasts region and the boot frame are part of the page and are checked with it.
 */
/**
 * The one node left out, and why (docs/accessibility-conformance.md, known exceptions): a task
 * list's checkbox while editing is the browser's own 13px control, sized by the browser, which
 * WCAG 2.5.8 exempts; axe cannot tell. The read-only view draws a disabled one instead.
 */
const EXEMPT = '[contenteditable="true"] li[data-checked] > label > input[type="checkbox"]';

export async function audit(page: Page): Promise<Finding[]> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .exclude(EXEMPT)
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
