// Phase 15 §5 S2 — 원자 선택 (single / shift-multi / Esc clear).
// Playwright 에서 R3F 캔버스 raycast 는 픽셀단위 카메라 투영이 필요 (실용 불가).
// `?e2e=1` 백도어 — setSelection 으로 selection 계약을 직접 갱신, viewport-focused
// 'Escape' 단축키는 *진짜* keydown 으로 발화 (clearSelection 흐름 검증).
import { test, expect } from './_fixtures';

test.describe('S2 — Atom selection', () => {
  test('single → shift add → Esc clears', async ({ app, page }) => {
    await app.gotoFresh();
    await app.seedMoleculeFromSmiles('CCO');

    // 분자 atoms 조회 → atom 2개 viewportId 합성.
    const ids = await page.evaluate(() => {
      const mols = window.__e2e__!.getMolecules();
      const m = mols[0]!;
      return {
        molId: m.id,
        atom0: `${m.id}::a:${m.atomPositions[0]!.id}`,
        atom1: `${m.id}::a:${m.atomPositions[1]!.id}`,
      };
    });

    // single — 1개.
    await page.evaluate((a0) => {
      window.__e2e__!.setSelection({ atomIds: [a0], bondIds: [] });
    }, ids.atom0);
    let sel = await page.evaluate(() => window.__e2e__!.getSelection());
    expect(sel.atomIds).toHaveLength(1);
    expect(sel.atomIds[0]).toBe(ids.atom0);

    // shift add — 2개.
    await page.evaluate(({ atom0, atom1 }) => {
      window.__e2e__!.setSelection({ atomIds: [atom0, atom1], bondIds: [] });
    }, ids);
    sel = await page.evaluate(() => window.__e2e__!.getSelection());
    expect(sel.atomIds).toHaveLength(2);

    // Esc → clearSelection (viewport-focused shortcut, 실제 keydown).
    await page.getByTestId('viewport-canvas').focus();
    await page.keyboard.press('Escape');
    sel = await page.evaluate(() => window.__e2e__!.getSelection());
    expect(sel.atomIds).toHaveLength(0);
    expect(sel.bondIds).toHaveLength(0);

    await app.axeScan();
  });
});
