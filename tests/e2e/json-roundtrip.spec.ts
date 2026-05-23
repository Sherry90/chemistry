// Phase 15 §5 S13 — JSON export / import 라운드트립. seed → export download →
// 동일 파일 import (replace) → 분자 1개 유지 (성공 토스트).
import { test, expect } from './_fixtures';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

test.describe('S13 — JSON export/import roundtrip', () => {
  test('seed → JSON export → import (replace) → success notify', async ({ app, page }) => {
    await app.gotoFresh();

    await app.seedMoleculeFromSmiles('CCO');
    await page.waitForTimeout(500);

    // Export → JSON.
    await page.getByTestId('toolbar-export').click();
    await page.getByTestId('export-json').click();
    const exportBtn = page.getByTestId('io-json-export-submit');
    await expect(exportBtn).toBeVisible({ timeout: 5_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await exportBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    // 임시 디렉토리에 저장 (다음 import 입력 파일).
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chemistry-e2e-'));
    const filePath = path.join(tmpDir, download.suggestedFilename());
    await download.saveAs(filePath);
    expect(fs.existsSync(filePath)).toBe(true);

    // dialog 닫힘 대기 (D-IO-CLOSE-AFTER export success).
    await expect(exportBtn).not.toBeVisible({ timeout: 5_000 });

    // Import 흐름. Toolbar Import 버튼 → IoDialog json-import 탭 마운트.
    await page.getByTestId('toolbar-import').click();
    const fileInput = page.locator('#io-import-file');
    await expect(fileInput).toBeVisible({ timeout: 5_000 });
    await fileInput.setInputFiles(filePath);

    const importBtn = page.getByTestId('io-import-submit');
    await expect(importBtn).toBeEnabled();
    await importBtn.click();

    // 성공 toast (io.jsonImport.success) — role=status. 이전 add/export toast 와
    // 공존할 수 있으므로 import 메시지 텍스트 필터 + first().
    const toast = page
      .locator('[role="status"]')
      .filter({ hasText: /import|불러|imported/i })
      .first();
    await expect(toast).toBeVisible({ timeout: 5_000 });

    // 정리.
    fs.rmSync(tmpDir, { recursive: true, force: true });

    await app.axeScan();
  });
});
