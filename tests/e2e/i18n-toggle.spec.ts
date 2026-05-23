// Phase 15 §5 S5 — i18n 한/영 토글. Language IconButton 클릭 → 텍스트 변경 +
// <html lang> 변경. I7/I8 검증.
import { test, expect } from './_fixtures';

test.describe('S5 — i18n toggle', () => {
  test('toggle locale → <html lang> + UI 문구 변경', async ({ app, page }) => {
    await app.gotoFresh();

    // 초기 lang 캡처 (브라우저 navigator.language 기반 — en default in CI).
    const initialLang = await page.locator('html').getAttribute('lang');
    expect(initialLang).toMatch(/^(ko|en)$/);

    // Language 버튼 표기 (현재 locale upper-case) 캡처.
    const langBtn = page.getByTestId('toolbar-language');
    const initialLangText = (await langBtn.textContent())?.trim().toUpperCase() ?? '';
    expect(initialLangText).toMatch(/^(KO|EN)$/);

    // 토글.
    await langBtn.click();

    // <html lang> 반대값으로 전환.
    const expectedLang = initialLang === 'ko' ? 'en' : 'ko';
    await expect(page.locator('html')).toHaveAttribute('lang', expectedLang, { timeout: 5_000 });

    // Language 버튼 표기도 반대 (KO↔EN).
    const newLangText = (await langBtn.textContent())?.trim().toUpperCase() ?? '';
    expect(newLangText).toBe(expectedLang.toUpperCase());

    // 토글 1회 더 → 원복.
    await langBtn.click();
    await expect(page.locator('html')).toHaveAttribute('lang', initialLang ?? 'en', {
      timeout: 5_000,
    });

    await app.axeScan();
  });
});
