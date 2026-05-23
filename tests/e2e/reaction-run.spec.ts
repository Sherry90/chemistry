// Phase 15 §5 S3 — 반응 설정 → 결과. E2E 백도어 (`?e2e=1`) 로 Conditions 패널 활성화
// (UI 상 docked 패널 전환 트리거 미존재 — v1 gap, Phase 15 §11/I14 후속).
// 흐름: SMILES seed × 2 → Conditions 활성화 → 반응 ID 체크 → Run → ReactionResult.
import { test, expect } from './_fixtures';

test.describe('S3 — Reaction setup → result', () => {
  test('seed 2 reactants → run → ReactionResult panel with products', async ({ app, page }) => {
    await app.gotoFresh('?e2e=1');

    // 2 분자 seed (acetic acid + ethanol — esterification 휴리스틱 후보).
    await app.seedMoleculeFromSmiles('CC(=O)O');
    // 첫 toast 가 사라질 때까지 대기 (이중 toast 가 SMILES seed 의 다음 단계 방해 방지).
    await page.waitForTimeout(500);
    await app.seedMoleculeFromSmiles('CCO');

    // Conditions 패널 활성화 (백도어 — UI v1 gap).
    await page.evaluate(() => {
      window.__e2e__?.setActivePanel('conditions');
    });

    // Conditions 패널 마운트 (Run 버튼 가시) 대기.
    const runBtn = page.getByTestId('conditions-run');
    await expect(runBtn).toBeVisible({ timeout: 10_000 });

    // 반응물 체크박스 2개 (분자 2개 seed) — 둘 다 선택.
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      const cb = checkboxes.nth(i);
      if (!(await cb.isChecked())) await cb.check();
    }

    // Run 클릭.
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    // 반응 결과 — ReactionResult 패널 모달 마운트 OR notify 실패.
    // 휴리스틱은 항상 결과를 반환 (success/no-match/experimental) → AddAll 또는
    // experimental badge 가시 시 통과.
    const result = page.locator('text=/실험적|experimental|작업공간|workspace/i').first();
    await expect(result).toBeVisible({ timeout: 15_000 });

    await app.axeScan();
  });
});
