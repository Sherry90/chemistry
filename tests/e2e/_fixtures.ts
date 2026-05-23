// Phase 15 §6.1 / I5 — E2E 공통 fixtures. axe helper + 신선한 상태 + RDKit
// ready wait. 시나리오 spec 들은 `import { test, expect } from './_fixtures'`.
import { test as base, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

interface Fixtures {
  readonly app: AppHelper;
}

interface AppHelper {
  /** 신선한 상태로 앱 로드 (localStorage clear → /). i18n ready 까지 대기. */
  readonly gotoFresh: (path?: string) => Promise<void>;
  /** SMILES dialog 열기 → mode SMILES → SMILES 문자열 입력 → submit. */
  readonly seedMoleculeFromSmiles: (smiles: string) => Promise<void>;
  /** axe-core 자동 스캔 — 0 critical/serious 단언. */
  readonly axeScan: (selector?: string) => Promise<void>;
  /** Page 노출. */
  readonly page: Page;
}

export const test = base.extend<Fixtures>({
  app: async ({ page }, use) => {
    // Phase 15 — 디버깅용 콘솔 + pageerror 출력 (CI artifact 에 포함).
    page.on('console', async (msg) => {
      if (msg.type() === 'error') {
        try {
          const args = await Promise.all(msg.args().map((h) => h.jsonValue().catch(() => null)));

          console.log(`[browser:${msg.type()}]`, JSON.stringify(args, null, 2));
        } catch {
          console.log(`[browser:${msg.type()}]`, msg.text());
        }
      }
    });
    page.on('pageerror', (err) => {
      console.log('[browser:pageerror]', err.message, '\n', err.stack);
    });

    const helper: AppHelper = {
      page,
      async gotoFresh(path = '') {
        // 첫 방문은 base path 절대 — webServer.url 기준 path 추가.
        await page.goto(path);
        // localStorage clear 후 reload — locale/theme/molecules 모두 초기화.
        await page.evaluate(() => {
          try {
            localStorage.clear();
            indexedDB
              ?.databases?.()
              .then((dbs) => dbs.forEach((db) => db.name && indexedDB.deleteDatabase(db.name)));
          } catch {
            /* ignore */
          }
        });
        await page.reload();
        // i18n init 완료 신호: ToolbarBar undo 버튼 (aria-label) 가시.
        await page.getByRole('button', { name: /undo|되돌리기/i }).waitFor({ state: 'visible' });
        // <html lang> 동기 (I8) 확인.
        await expect(page.locator('html')).toHaveAttribute('lang', /^(ko|en)$/);
      },
      async seedMoleculeFromSmiles(smiles: string) {
        await page.getByTestId('toolbar-smiles').click();
        // Dialog open + SMILES 탭 default. 입력.
        const input = page.getByTestId('textinput-input');
        await input.waitFor({ state: 'visible' });
        await input.fill(smiles);
        // submit 버튼 enable (preview success) 대기 — RDKit ready proxy.
        const submit = page.getByTestId('textinput-submit');
        await expect(submit).toBeEnabled({ timeout: 15_000 });
        await submit.click();
        // Dialog close 까지 대기 (D-INPUT-COMMIT-CLOSE).
        await input.waitFor({ state: 'hidden' });
      },
      async axeScan(selector) {
        // Phase 15 core-5 E2E — color-contrast 는 테마 토큰 전반 polish 항목.
        // 전체 Phase 15 §6.4 (I5/I6 — CVD 팔레트 확정 후 재계측) 에서 처리.
        const builder = new AxeBuilder({ page }).disableRules(['color-contrast']);
        if (selector) builder.include(selector);
        const results = await builder.analyze();
        const blockers = results.violations.filter(
          (v) => v.impact === 'critical' || v.impact === 'serious',
        );
        if (blockers.length > 0) {
          const report = blockers
            .map((v) => `  - [${v.impact}] ${v.id}: ${v.description}`)
            .join('\n');
          throw new Error(`axe blockers:\n${report}`);
        }
      },
    };
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(helper);
  },
});

export { expect };
export type { Locator };
