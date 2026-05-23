// Phase 15 hotfix C — CompoundBrowser dialog-open axe scan.
// TabsList without TabsContent 회귀 방지 (aria-controls IDREF 유효성).
import { test, expect } from './_fixtures';

test.describe('CompoundBrowser — a11y dialog-open scan', () => {
  test('panel open → axe 0 critical/serious (Tabs aria-controls 유효)', async ({ app, page }) => {
    await app.gotoFresh();

    // CompoundBrowser 는 modal — 백도어 togglePanel 로 open.
    await page.evaluate(() => window.__e2e__!.togglePanel('compound-browser', true));

    // CompoundBrowser 마운트 — name/cid/formula 탭 가시.
    await expect(page.getByRole('tab', { name: /name|이름/i })).toBeVisible({ timeout: 5_000 });

    // dialog 컨테이너에 한정한 axe scan (다른 사이드패널 노이즈 제거).
    await app.axeScan('[role="dialog"]');
  });
});
