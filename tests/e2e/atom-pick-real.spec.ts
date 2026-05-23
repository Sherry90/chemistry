// Phase 15 hotfix A — 실 캔버스 마우스 클릭 → R3F → InstancedMesh.instanceId → picking.ts
// 전체 체인 검증. S2 atom-selection 은 백도어 setSelection 사용 → 본 spec 이 실 경로 보충.
// 단일 분자 가정 (transform.translation = (0,0,0)). 멀티-mol 케이스는 별도 spec (deferred).
import { test, expect } from './_fixtures';

test.describe('실 canvas raycast — picking → selection', () => {
  test('seed CCO → atom 0 projected click → selection state 갱신', async ({ app, page }) => {
    await app.gotoFresh();
    await app.seedMoleculeFromSmiles('CCO');

    // Camera settle (OrbitControls damping) — matrixWorld 가 2 연속 read 동일.
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

    const mols = await page.evaluate(() => window.__e2e__!.getMolecules());
    expect(mols).toHaveLength(1);
    const molId = mols[0]!.id;
    const atomId = mols[0]!.atomPositions[0]!.id;

    const screen = await page.evaluate(({ id }) => window.__e2e__!.projectAtomToScreen(id, 0), {
      id: molId,
    });
    expect(screen).not.toBeNull();
    const { x, y } = screen!;

    // viewport canvas 에 focus → pointer 이벤트 전달 보장.
    await page.getByTestId('viewport-canvas').focus();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();

    // selection 갱신 — atomId 가 viewportId 포맷 (`${molId}::a:${atomId}`) 으로 포함.
    await expect
      .poll(
        async () => {
          const sel = await page.evaluate(() => window.__e2e__!.getSelection());
          return sel.atomIds.length > 0 && sel.atomIds.some((id) => id.includes(atomId));
        },
        { timeout: 5_000 },
      )
      .toBe(true);

    await app.axeScan();
  });
});
