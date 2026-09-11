import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";

/** Serious/critical only -- this pass is a release gate, not a full WCAG audit. Moderate/minor
 * findings are real but out of scope for "does this block go-live." */
export async function checkA11y(page: Page, testInfo: TestInfo, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");

  await testInfo.attach(`axe-${label}`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });

  return blocking.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(" ")),
  }));
}
