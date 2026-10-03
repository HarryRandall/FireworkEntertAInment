/** Catalogue lookups shared by the admin browser journeys. */
import { expect, type Page } from '@playwright/test';

/** Searches the effects grid and opens the exact match, whichever page it would land on. */
export async function openCatalogueEffect(page: Page, name: string) {
  await page.getByLabel('Search effects').fill(name);
  // Several effects share a word (for example the peony variations), so show every match.
  const rowsPerPage = page.getByLabel('Rows per page');
  const largest = await rowsPerPage.locator('option').last().getAttribute('value');
  if (largest !== null) await rowsPerPage.selectOption(largest);
  const link = page.getByRole('table').getByRole('link', { name, exact: true });
  await expect(link).toBeVisible();
  await link.click();
}
