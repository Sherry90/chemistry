// Phase 13 §6.3 — PNG export 옵션 타입.

export interface PngExportOptions {
  readonly format: 'png' | 'jpeg' | 'webp';
  readonly dpr: number;
  readonly transparentBackground: boolean;
}

export const DEFAULT_PNG_OPTIONS: PngExportOptions = {
  format: 'png',
  dpr: 2,
  transparentBackground: false,
};
