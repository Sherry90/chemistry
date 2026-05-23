// Phase 15 §5 S7 — 단축키 스코프 분리.
// 1) viewport focus → Cmd+Z 가 undo 발화 (마지막 분자 추가 reversed).
// 2) text input focus → Cmd+Z 가 isTextInputTarget guard 에 의해 native (분자 store 무변).
import { test, expect } from './_fixtures';

test.describe('S7 — Shortcut scope', () => {
  test('Cmd+Z in viewport undoes; in text input does not affect molecules', async ({
    app,
    page,
  }) => {
    await app.gotoFresh();
    const isMac = await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.userAgent));
    const undoKey = isMac ? 'Meta+z' : 'Control+z';

    await app.seedMoleculeFromSmiles('CCO');
    await page.waitForTimeout(300);
    await app.seedMoleculeFromSmiles('CC');
    await page.waitForTimeout(300);

    let mols = await page.evaluate(() => window.__e2e__!.getMolecules());
    expect(mols).toHaveLength(2);

    // viewport focus → Cmd+Z → 마지막 분자(CC) 제거.
    await page.getByTestId('viewport-canvas').focus();
    await page.keyboard.press(undoKey);
    await expect
      .poll(async () => (await page.evaluate(() => window.__e2e__!.getMolecules())).length)
      .toBe(1);
    mols = await page.evaluate(() => window.__e2e__!.getMolecules());
    expect(mols).toHaveLength(1);

    // text input focus → Cmd+Z 가 분자 store 영향 없음 (isTextInputTarget guard).
    await page.getByTestId('toolbar-smiles').click();
    const input = page.getByTestId('textinput-input');
    await input.waitFor({ state: 'visible' });
    await input.fill('CCC');
    await input.focus();
    await page.keyboard.press(undoKey);
    // 약간 대기 — undo 가 흘러갔다면 detected.
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.__e2e__!.getMolecules());
    expect(after).toHaveLength(1); // viewport 의 한 분자 유지.

    await app.axeScan();
  });
});
