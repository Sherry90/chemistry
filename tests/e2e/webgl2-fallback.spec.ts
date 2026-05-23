// Phase 15 §5 S8 — WebGL2 미지원 fallback.
// addInitScript 가 모든 페이지 스크립트보다 먼저 실행 → detectWebGL2 의
// canvas.getContext('webgl2') 가 항상 null → WebGL2FallbackPage 마운트.
// (module-level cache 가 있어 mount 후 backdoor 토글은 불가, addInitScript 만 유효.)
import { test, expect } from './_fixtures';

test.describe('S8 — WebGL2 unsupported fallback', () => {
  test('fallback page mounts; sidepanel still functional', async ({ app, page }) => {
    // 모든 페이지 스크립트 실행 *전* 에 getContext('webgl2') 를 null 로 패치.
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (HTMLCanvasElement.prototype as any).getContext = function (
        type: string,
        ...rest: unknown[]
      ) {
        if (type === 'webgl2') return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (orig as any).call(this, type, ...rest);
      };
    });

    await app.gotoFresh();

    // WebGL2FallbackPage — role=region + aria-label (i18n 키 라 ko/en 모두 포함).
    const fallback = page.getByRole('region').first();
    await expect(fallback).toBeVisible({ timeout: 10_000 });

    // sidepanel 토글 동작 — toolbar 버튼 클릭 가능 (a11y/상호작용 살아있음).
    await expect(page.getByTestId('toolbar-smiles')).toBeEnabled();

    await app.axeScan();
  });
});
