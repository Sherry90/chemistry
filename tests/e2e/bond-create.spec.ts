// Phase 15 §5 S12 — 결합 생성 (B 키).
// 같은 분자 atom 2개 선택 → B → addBond / setBondOrder cycle (1→2→3→1).
// 다른 분자 atom 끼리는 거부 + warn toast (`shortcuts.bondCreate.diffMolecule`).
import { test, expect } from './_fixtures';

test.describe('S12 — Bond creation', () => {
  test('selecting 2 atoms in same molecule + B adds a bond', async ({ app, page }) => {
    await app.gotoFresh();
    await app.seedMoleculeFromSmiles('CCO');

    const setup = await page.evaluate(() => {
      const m = window.__e2e__!.getMolecules()[0]!;
      // C(0) ↔ O(2) — 인접하지 않은 (보통 직접 결합 부재) pair 선택.
      return {
        molId: m.id,
        bondCountBefore: m.bondCount,
        a0: `${m.id}::a:${m.atomPositions[0]!.id}`,
        a2: `${m.id}::a:${m.atomPositions[2]!.id}`,
      };
    });

    await page.evaluate(({ a0, a2 }) => {
      window.__e2e__!.setSelection({ atomIds: [a0, a2], bondIds: [] });
    }, setup);

    // viewport focus → B.
    await page.getByTestId('viewport-canvas').focus();
    await page.keyboard.press('b');

    await expect
      .poll(async () => page.evaluate(() => window.__e2e__!.getMolecules()[0]!.bondCount))
      // 기존 bond 가 존재했으면 차수 cycle (count 동일), 미존재면 +1.
      // CCO 의 C(0)–O(2) 는 직접 결합 X → +1 기대.
      .toBeGreaterThanOrEqual(setup.bondCountBefore + 1);

    await app.axeScan();
  });

  test('selecting atoms across molecules → warn toast, no bond added', async ({ app, page }) => {
    await app.gotoFresh();
    await app.seedMoleculeFromSmiles('CC');
    await page.waitForTimeout(300);
    await app.seedMoleculeFromSmiles('OC');
    await page.waitForTimeout(300);

    const setup = await page.evaluate(() => {
      const mols = window.__e2e__!.getMolecules();
      const a = mols[0]!;
      const b = mols[1]!;
      return {
        bondCountTotalBefore: a.bondCount + b.bondCount,
        atomA: `${a.id}::a:${a.atomPositions[0]!.id}`,
        atomB: `${b.id}::a:${b.atomPositions[0]!.id}`,
      };
    });

    await page.evaluate(({ atomA, atomB }) => {
      window.__e2e__!.setSelection({ atomIds: [atomA, atomB], bondIds: [] });
    }, setup);

    await page.getByTestId('viewport-canvas').focus();
    await page.keyboard.press('b');

    // warn toast — i18n 키 `panels:shortcuts.bondCreate.diffMolecule` 의 ko/en 변환.
    const toast = page.locator('[role="status"], [role="alert"]').filter({
      hasText: /different molecule|다른 분자|cannot|불가|diff/i,
    });
    await expect(toast.first()).toBeVisible({ timeout: 5_000 });

    const after = await page.evaluate(() => {
      const mols = window.__e2e__!.getMolecules();
      return mols[0]!.bondCount + mols[1]!.bondCount;
    });
    expect(after).toBe(setup.bondCountTotalBefore);

    await app.axeScan();
  });
});
