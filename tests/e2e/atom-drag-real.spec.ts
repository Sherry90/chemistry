// Phase 15 hotfix A — 실 마우스 드래그 → DragController → moveAtom 체인 검증.
// atom-drag-undo.spec.ts (S11) 는 moveAtom 백도어 사용. 본 spec 은 실 pointerdown/move/up
// 으로 R3F → usePointerDrag controller → store action 까지 라이브 경로.
import { test, expect } from './_fixtures';

test.describe('실 canvas drag — DragController → moveAtom', () => {
  test('seed CCO → atom 0 drag +60px → position delta', async ({ app, page }) => {
    await app.gotoFresh();
    await app.seedMoleculeFromSmiles('CCO');

    // Camera settle.
    await expect
      .poll(
        async () => {
          const m1 = (await page.evaluate(() => window.__e2e__!.getCameraMatrix())) ?? [];
          await page.waitForTimeout(60);
          const m2 = (await page.evaluate(() => window.__e2e__!.getCameraMatrix())) ?? [];
          if (m1.length !== 16 || m2.length !== 16) return false;
          for (let i = 0; i < 16; i++) if (Math.abs(m1[i]! - m2[i]!) > 1e-4) return false;
          return true;
        },
        { timeout: 5_000 },
      )
      .toBe(true);

    const before = await page.evaluate(() => {
      const m = window.__e2e__!.getMolecules()[0]!;
      return { id: m.id, pos: m.atomPositions[0]! };
    });

    const screen = await page.evaluate(({ id }) => window.__e2e__!.projectAtomToScreen(id, 0), {
      id: before.id,
    });
    expect(screen).not.toBeNull();

    await page.getByTestId('viewport-canvas').focus();
    await page.mouse.move(screen!.x, screen!.y);
    await page.mouse.down();
    // 60 px 평행이동 — DragController unproject 가 카메라 거리에 따라 월드 단위로 변환.
    await page.mouse.move(screen!.x + 60, screen!.y + 60, { steps: 6 });
    await page.mouse.up();

    // 좌표 변화 — x or y 변화량 > 0 (정확 값은 카메라 거리 의존).
    await expect
      .poll(
        async () => {
          const after = await page.evaluate(
            () => window.__e2e__!.getMolecules()[0]!.atomPositions[0]!,
          );
          return Math.hypot(after.x - before.pos.x, after.y - before.pos.y) > 0.01;
        },
        { timeout: 5_000 },
      )
      .toBe(true);

    await app.axeScan();
  });
});
