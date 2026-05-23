// Phase 15 §6.1 — Smoke (S0). preview-server / base-path / WASM-load 사전 검증.
// app shell 가시 + axe 0 critical/serious + 기본 toolbar/viewport 마운트.
import { test, expect } from './_fixtures';

test.describe('S0 — app shell smoke', () => {
  test('boots, mounts toolbar + viewport, axe clean', async ({ app, page }) => {
    await app.gotoFresh();

    // Toolbar 가시 (Undo + SMILES + Export trigger).
    await expect(page.getByRole('button', { name: /undo|되돌리기/i })).toBeVisible();
    await expect(page.getByTestId('toolbar-smiles')).toBeVisible();
    await expect(page.getByTestId('toolbar-export')).toBeVisible();
    await expect(page.getByTestId('toolbar-language')).toBeVisible();

    // Viewport canvas mounted (R3F).
    await expect(page.locator('canvas').first()).toBeVisible();

    // html lang 동기.
    await expect(page.locator('html')).toHaveAttribute('lang', /^(ko|en)$/);

    // axe 0 critical/serious.
    await app.axeScan();
  });
});
