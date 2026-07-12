import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const WCAG_AA_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
] as const;

export async function expectNoWcagViolations(page: Page, view: string): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags([...WCAG_AA_TAGS])
    .analyze();
  const violations = result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({
      target: node.target.join(' '),
      html: node.html,
      summary: node.failureSummary,
    })),
  }));

  expect(violations, `${view} must have no automated WCAG A/AA violations`).toEqual([]);
}
