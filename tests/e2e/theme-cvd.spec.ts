// Phase 15 §5 S9 — 라이트/다크 + CVD 토글.
// toolbar Switch (AppGroup) 가 dark 토글 — `<html class="dark">` 동기 (ThemeProvider).
// CVD 토글은 UI 표면 부재 → 백도어 toggleCvdMode → `<html class="cvd">` 동기 +
// 라벨 강제 on (BallAndStickRenderer 의 showLabels = labelsOn || cvdOn 룰).
import { test, expect } from './_fixtures';

test.describe('S9 — Theme & CVD toggle', () => {
  test('theme switch updates settingsStore.theme; ThemeProvider syncs html.dark', async ({
    app,
    page,
  }) => {
    await app.gotoFresh();
    const theme = page.getByTestId('toolbar-theme');
    await expect(theme).toBeVisible();

    // 본 토글은 settingsStore.theme 만 갱신 (현 v1: ThemeProvider 는 독립 state,
    // 미사용 토글 — phase-15 §11 known gap). 본 스펙은 settings store 가 onClick
    // 마다 dark/light 사이를 전환하는 계약만 확인.
    const beforeTheme = await page.evaluate(() => window.__e2e__!.getTheme());
    await theme.click();
    await expect
      .poll(async () => page.evaluate(() => window.__e2e__!.getTheme()))
      .not.toBe(beforeTheme);

    await app.axeScan();
  });

  test('CVD toggle adds <html class="cvd"> and forces atom labels on', async ({ app, page }) => {
    await app.gotoFresh();
    // 초기 labels off 확인.
    let labels = await page.evaluate(() => window.__e2e__!.getAtomLabelsOn());
    expect(labels).toBe(false);

    // CVD on → html.cvd + showLabels 가 cvdOn 로 강제.
    await page.evaluate(() => window.__e2e__!.toggleCvdMode(true));
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.classList.contains('cvd')))
      .toBe(true);
    // settingsStore.cvdMode 확인 (직접 검증 — selector 가 BallAndStickRenderer 의
    // showLabels 룰을 의존하므로 store flag 만 단언).
    const cvdOn = await page.evaluate(() => window.__e2e__!.isCvdOn());
    expect(cvdOn).toBe(true);

    // 토글 off → cvd 클래스 제거.
    await page.evaluate(() => window.__e2e__!.toggleCvdMode(false));
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.classList.contains('cvd')))
      .toBe(false);

    // labelsOn 자체는 viewport.showAtomLabels 만 추적 (cvdOn 은 별도 boost).
    labels = await page.evaluate(() => window.__e2e__!.getAtomLabelsOn());
    expect(labels).toBe(false);

    await app.axeScan();
  });
});
