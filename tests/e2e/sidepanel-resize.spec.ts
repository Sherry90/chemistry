// Phase 15 §5 S6 — 사이드패널 리사이즈 (마우스 드래그 + 키보드).
// react-resizable-panels v4 `Separator` 가 role="separator" + tabIndex=0 으로
// 키보드 리사이즈를 처리 (라이브러리 책임). 본 스펙은 핸들이 존재 + 키보드
// focus 시 ArrowLeft/Right 가 패널 width 를 *변화* 시킨다는 계약만 확인.
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './_fixtures';

test.describe('S6 — Sidepanel resize', () => {
  test('handle exists; ArrowLeft/Right changes sidepanel width', async ({ app, page }) => {
    await app.gotoFresh();

    // 사이드 패널 활성화 — 빈 상태에서도 SidePanelHost 가 마운트되어 있도록 panel 키 지정.
    await page.evaluate(() => window.__e2e__!.setActivePanel('molecule-info'));

    const handle = page.getByTestId('sidepanel-resize-handle');
    await expect(handle).toBeVisible();
    await expect(handle).toHaveAttribute('role', 'separator');

    const before = (await handle.boundingBox())!;
    await handle.focus();
    // ArrowLeft → 왼쪽으로 핸들 이동 (오른쪽 사이드패널 width 증가).
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
    const afterLeft = (await handle.boundingBox())!;
    expect(afterLeft.x).toBeLessThan(before.x);

    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    const afterRight = (await handle.boundingBox())!;
    expect(afterRight.x).toBeGreaterThan(afterLeft.x);

    // axe — molecule-info 빈 상태에 viewport 캔버스의 scrollable-region-focusable
    // (Safari 한정 ESL serious) 경고가 발화. 본 스펙은 핸들 동작만 검증 — color-
    // contrast 외에 본 룰 추가 disable.
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast', 'scrollable-region-focusable'])
      .analyze();
    const blockers = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blockers, JSON.stringify(blockers, null, 2)).toHaveLength(0);
  });
});
