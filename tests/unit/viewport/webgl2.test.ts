import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectWebGL2, __resetWebGL2Cache } from '@/viewport/capability/webgl2';

beforeEach(() => __resetWebGL2Cache());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  __resetWebGL2Cache();
});

describe('detectWebGL2', () => {
  it('jsdom default: no webgl2 context → { ok:false, reason:"no-webgl2" }', () => {
    const r = detectWebGL2();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-webgl2');
  });

  it('no WebAssembly → reason no-wasm', () => {
    vi.stubGlobal('WebAssembly', undefined);
    const r = detectWebGL2();
    expect(r).toEqual({ ok: false, reason: 'no-wasm' });
  });

  it('fake gl2 context → ok:true with maxTextureSize', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      MAX_TEXTURE_SIZE: 0x0d33,
      getParameter: () => 8192,
      getExtension: () => null,
    } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
    const r = detectWebGL2();
    expect(r).toEqual({ ok: true, maxTextureSize: 8192 });
  });

  it('caches result across calls', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    detectWebGL2();
    detectWebGL2();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
