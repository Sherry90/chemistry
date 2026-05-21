// Phase 13 §6.15 — Blob → 다운로드 trigger + filename 생성기.
// 브라우저 전용 (document/URL.createObjectURL) — node 환경에서 호출하지 않는다.

/** Blob → 다운로드 trigger. URL.createObjectURL + <a download> + revoke. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // R13 — Safari 호환: anchor click 후 브라우저가 download 시작할 시간 확보 후 revoke.
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/** `chemistry-2026-05-21-153045.png` 형식. local time 기반 (timezone-agnostic 파일명). */
export function buildFilename(
  prefix: 'chemistry',
  ext: 'png' | 'jpeg' | 'webp' | 'json' | 'sdf',
): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${prefix}-${ts}.${ext}`;
}
