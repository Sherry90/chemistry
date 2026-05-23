// Phase 15 §5 S11 — atom 드래그 + Undo. Playwright 에서 픽셀단위 드래그는
// raycast/카메라 투영 의존 (재현 불가). usePointerDrag 가 호출하는 동일 액션
// (`moveAtom`) 을 백도어로 호출 → Cmd+Z (real keydown via shortcut layer) 로
// 원좌표 복원되는 undo 계약을 검증.
import { test, expect } from './_fixtures';

// Cmd (Mac) / Ctrl (Win/Linux) — Playwright Chromium 런타임은 OS 의존. 두 modifier
// 모두 시도해 cmdCtrl 매처 어느 쪽이든 발화 보장.

test.describe('S11 — Atom move + undo', () => {
  test('moveAtom changes position; Cmd+Z restores', async ({ app, page }) => {
    await app.gotoFresh();
    await app.seedMoleculeFromSmiles('CCO');

    const before = await page.evaluate(() => {
      const m = window.__e2e__!.getMolecules()[0]!;
      return { molId: m.id, pos: m.atomPositions[0]! };
    });

    // moveAtom — atomIndex 0 을 (x+5, y+5, z+5) 만큼 평행이동.
    await page.evaluate(({ molId, pos }) => {
      window.__e2e__!.moveAtom(molId, 0, [pos.x + 5, pos.y + 5, pos.z + 5]);
    }, before);

    const moved = await page.evaluate(() => window.__e2e__!.getMolecules()[0]!.atomPositions[0]!);
    expect(moved.x).toBeCloseTo(before.pos.x + 5, 4);
    expect(moved.y).toBeCloseTo(before.pos.y + 5, 4);

    // viewport focus → Cmd+Z 또는 Ctrl+Z (cmdCtrl 매처). OS 분기로 정확히 1회.
    await page.getByTestId('viewport-canvas').focus();
    const isMac = await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.userAgent));
    await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z');

    await expect
      .poll(async () => {
        const cur = await page.evaluate(() => window.__e2e__!.getMolecules()[0]!.atomPositions[0]!);
        return Math.abs(cur.x - before.pos.x) < 1e-4 && Math.abs(cur.y - before.pos.y) < 1e-4;
      })
      .toBe(true);

    await app.axeScan();
  });
});
