/** Composer-run publication, posters and lossless version history across themes and screen sizes. */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signInAs } from './auth-helpers';
import {
  openStudioCopy,
  studioSaved,
  openStudioHistory,
  studioRows,
} from './studio-publish-helpers';
import { RENDERER_VERSION } from '../../packages/fireworks/src/version';
const viewports = { desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } };
async function screenshot(page: Page, info: TestInfo, label: string, selector: string) {
  await info.attach(label, {
    body: await page.locator(selector).screenshot({ path: `output/playwright/${label}.png` }),
    contentType: 'image/png',
  });
}
async function review(page: Page) {
  await expect(async () => {
    if (!(await page.getByRole('dialog').isVisible()))
      await page.getByRole('button', { name: 'Review and publish', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }).toPass();
}
async function publish(page: Page) {
  const dialog = page.getByRole('dialog');
  const button = dialog.getByRole('button', { name: /^Publish version / });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-hydrated', 'true');
}
async function postersReady(page: Page, effectId: string) {
  let currentId = '';
  await expect
    .poll(async () => {
      const effect = await studioRows(
        page,
        'effects',
        `id=eq.${effectId}&select=current_version_id`,
      );
      currentId = String(effect[0]?.current_version_id ?? '');
      if (currentId === '') return 0;
      const posters = await studioRows(
        page,
        'poster_renders',
        `effect_version_id=eq.${currentId}&renderer=eq.${RENDERER_VERSION}&status=eq.ready`,
      );
      expect(
        posters.every(
          (row) =>
            Number(row.width) > 0 && Number(row.height) > 0 && String(row.path).endsWith('.png'),
        ),
      ).toBe(true);
      return posters.length;
    })
    .toBe(4);
  return currentId;
}
for (const [size, viewport] of Object.entries(viewports))
  for (const theme of ['light', 'dark']) {
    test(`${size} ${theme} publishes browser posters and restores history without losing the current draft`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await signInAs(page, 'admin');
      const effectId = await openStudioCopy(page);
      const name = page.getByRole('textbox', { name: 'Star group name', exact: true });
      const original = await name.inputValue();
      await name.fill('Published group');
      await name.blur();
      await studioSaved(page);
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(name).toHaveValue(original);
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      await expect(name).toHaveValue('Published group');
      await studioSaved(page);
      await page.reload();
      await studioSaved(page);
      await expect(name).toHaveValue('Published group');
      await review(page);
      await expect(page.getByRole('region', { name: 'Publish changes' })).toContainText(
        'Published group',
      );
      await page
        .getByLabel('What changed', { exact: true })
        .fill('Tuned the stars for publication');
      await screenshot(page, info, `publish-review-${size}-${theme}`, '[role="dialog"]');
      for (const section of ['Publish checks', 'Publish changes', 'Used by'])
        await screenshot(
          page,
          info,
          `publish-${section.replaceAll(' ', '-')}-${size}-${theme}`,
          `[aria-label="${section}"]`,
        );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await publish(page);
      await postersReady(page, effectId);
      await name.fill('Work kept before restore');
      await name.blur();
      await studioSaved(page);
      await openStudioHistory(page);
      const history = page.getByRole('dialog', { name: 'Version history' });
      await expect(history).toContainText('Tuned the stars for publication');
      await screenshot(page, info, `publish-history-${size}-${theme}`, '[role="dialog"]');
      await history.getByRole('button', { name: 'Preview version 1', exact: true }).click();
      await expect(page.getByText('Previewing version 1. Editing is paused.')).toBeVisible();
      await expect(name).toBeDisabled();
      await screenshot(page, info, `publish-history-preview-${size}-${theme}`, '.sc-studio');
      await page.getByRole('button', { name: 'Back to current', exact: true }).click();
      await expect(name).toHaveValue('Work kept before restore');
      await openStudioHistory(page);
      await history.getByRole('button', { name: 'Preview version 1', exact: true }).click();
      await page.getByRole('button', { name: 'Restore this version', exact: true }).click();
      await expect(page.getByText('Previewing version 1. Editing is paused.')).not.toBeVisible();
      await expect(name).toHaveValue('Published group');
      await studioSaved(page);
      const versions = await studioRows(
        page,
        'effect_versions',
        `effect_id=eq.${effectId}&order=number.desc`,
      );
      expect(versions).toHaveLength(3);
      expect(versions[1]?.status).toBe('superseded');
      expect(JSON.stringify(versions[1]?.design)).toContain('Work kept before restore');
      await page.reload();
      await studioSaved(page);
      await expect(name).toHaveValue('Published group');
      await screenshot(page, info, `publish-layers-${size}-${theme}`, '.sc-studio-layers');
      for (const tab of ['Launch', 'Burst', 'Stars', 'Trail', 'Effect']) {
        const trigger = page.getByRole('tab', { name: tab, exact: true });
        await expect(async () => {
          await trigger.click();
          await expect(trigger).toHaveAttribute('aria-selected', 'true');
        }).toPass();
        await screenshot(
          page,
          info,
          `publish-inspector-${tab}-${size}-${theme}`,
          '.sc-studio-inspector',
        );
      }
      await expect(async () => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }).toPass();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await screenshot(page, info, `publish-full-${size}-${theme}`, '.sc-shell');
    });
  }
test('asking for review records a review row and freezes the submitted draft', async ({ page }) => {
  await signInAs(page, 'admin');
  const effectId = await openStudioCopy(page);
  await review(page);
  await page.getByLabel('What changed', { exact: true }).fill('Please check the colours');
  await page.getByRole('button', { name: 'Ask for review', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const versions = await studioRows(
    page,
    'effect_versions',
    `effect_id=eq.${effectId}&status=eq.in_review`,
  );
  expect(versions).toHaveLength(1);
  const reviews = await studioRows(
    page,
    'reviews',
    `effect_version_id=eq.${String(versions[0]?.id)}`,
  );
  expect(reviews).toHaveLength(1);
  expect(reviews[0]?.note).toBe('Please check the colours');
  await expect(page.getByRole('textbox', { name: 'Star group name', exact: true })).toBeDisabled();
});
test('poster upload failure leaves publication intact and the Posters queue retries the version', async ({
  page,
}) => {
  await signInAs(page, 'admin');
  const effectId = await openStudioCopy(page);
  await page.route('**/storage/v1/object/posters/**', async (route) => {
    await route.abort('failed');
  });
  await review(page);
  await publish(page);
  await expect(page.getByRole('button', { name: 'Retry posters', exact: true })).toBeVisible();
  const effect = await studioRows(
    page,
    'effects',
    `id=eq.${effectId}&select=status,current_version_id,name`,
  );
  expect(effect[0]?.status).toBe('published');
  const versionId = String(effect[0]?.current_version_id);
  const failed = await studioRows(
    page,
    'poster_renders',
    `effect_version_id=eq.${versionId}&status=eq.failed`,
  );
  expect(failed).toHaveLength(4);
  await page.unroute('**/storage/v1/object/posters/**');
  await page.getByRole('button', { name: 'Retry posters', exact: true }).click();
  await postersReady(page, effectId);
  await expect(page.getByRole('button', { name: 'Retry posters', exact: true })).not.toBeVisible();
  await page.goto('/admin/posters');
  await expect(page.getByRole('heading', { name: 'Posters', exact: true })).toBeVisible();
  const renderButton = page.locator('[data-poster-version]').first();
  const queuedId = await renderButton.getAttribute('data-poster-version');
  expect(queuedId).not.toBeNull();
  await renderButton.click();
  await expect
    .poll(
      async () =>
        (
          await studioRows(
            page,
            'poster_renders',
            `effect_version_id=eq.${queuedId}&renderer=eq.${RENDERER_VERSION}&status=eq.ready`,
          )
        ).length,
    )
    .toBe(4);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test('non-admin cannot reach publication, history or poster maintenance', async ({ page }) => {
  await signInAs(page, 'owner');
  for (const path of ['/admin/studio/40000000-0000-0000-0000-000000000001', '/admin/posters']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(page.getByRole('button', { name: 'Review and publish', exact: true })).toHaveCount(
      0,
    );
  }
});
for (const [size, viewport] of Object.entries(viewports))
  for (const theme of ['light', 'dark']) {
    test(`${size} ${theme} poster maintenance has no overflow or accessibility violations`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await signInAs(page, 'admin');
      await page.goto('/admin/posters');
      await expect(page.getByRole('heading', { name: 'Posters', exact: true })).toBeVisible();
      await screenshot(
        page,
        info,
        `poster-queue-${size}-${theme}`,
        '[aria-label="Poster render queue"]',
      );
      await expect(async () => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }).toPass();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }
