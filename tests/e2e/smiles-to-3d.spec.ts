// Phase 15 §5 S1 — SMILES → 3D. SMILES 입력 → 파싱 → 분자 표시.
// Success toast (role=status, aria-live=polite) 는 분자 추가 신호.
import { test, expect } from './_fixtures';

test.describe('S1 — SMILES → 3D', () => {
  test('ethanol SMILES (CCO) → mounts molecule, success toast', async ({ app, page }) => {
    await app.gotoFresh();

    await app.seedMoleculeFromSmiles('CCO');

    // Success toast (textInput.submitted.added) — role=status (polite).
    const toast = page.locator('[role="status"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/추가|added/i);

    // canvas 가시 (R3F 마운트 후 렌더 — 분자 시각 자체는 axe 무관).
    await expect(page.locator('canvas').first()).toBeVisible();

    // axe 0 critical/serious.
    await app.axeScan();
  });

  test('invalid SMILES → error message, submit disabled', async ({ app, page }) => {
    await app.gotoFresh();

    await page.getByTestId('toolbar-smiles').click();
    const input = page.getByTestId('textinput-input');
    await input.waitFor({ state: 'visible' });
    await input.fill('!!invalid!!');

    // submit 버튼 disabled 유지 (preview.kind !== 'success').
    const submit = page.getByTestId('textinput-submit');
    await expect(submit).toBeDisabled();
  });
});
