// Phase 15 §5 S4 — PNG export. Export 팝오버 → PNG → IoDialog PngExportPane →
// Export 버튼 → blob download (waitForEvent('download')).
import { test, expect } from './_fixtures';

test.describe('S4 — PNG export', () => {
  test('export PNG with default options → download fires', async ({ app, page }) => {
    await app.gotoFresh();

    // 적어도 1분자 — 빈 viewport export 도 가능하나 의미 있는 시나리오로 seed.
    await app.seedMoleculeFromSmiles('CCO');
    await page.waitForTimeout(500);

    // Export 팝오버 트리거 → PNG.
    await page.getByTestId('toolbar-export').click();
    await page.getByTestId('export-png').click();

    // PngExportPane 마운트 — Export 버튼 가시.
    const exportSubmit = page.getByTestId('io-png-export-submit');
    await expect(exportSubmit).toBeVisible({ timeout: 5_000 });

    // Phase 15 hotfix C — dialog-open axe scan (TabsList aria-controls IDREF 검증).
    await app.axeScan('[role="dialog"]');

    // 다운로드 캡처.
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await exportSubmit.click();
    const download = await downloadPromise;

    // filename + suggested mime.
    expect(download.suggestedFilename()).toMatch(/\.(png|jpg|jpeg|webp)$/);

    await app.axeScan();
  });
});
