#!/usr/bin/env node
// 번들 크기 검증 스크립트 (phase-14 §6.1 / D12).
// dist/assets/*.js 순회 → gzip 크기 측정 → 임계값 초과 시 exit 1.
//
// 임계값 (phase-14 D12):
//   - initial bundle 합산 (vendor-react + vendor-radix + vendor-state + index) < 500 KB gzip
//   - viewport chunk (vendor-three / viewport-*) < 400 KB gzip
//   - 개별 panel chunk < 40 KB gzip (warn — exit 0 유지, panel 초과는 별도 추적)

import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const DIST_ASSETS = resolve(process.cwd(), 'dist/assets');

const THRESHOLDS = {
  initial: 500 * 1024,
  viewport: 400 * 1024,
  panel: 40 * 1024,
};

function getGzipSize(filePath) {
  const content = readFileSync(filePath);
  return gzipSync(content).length;
}

let failed = false;
let initialTotal = 0;

const INITIAL_RE = /^(vendor-react|vendor-radix|vendor-state|index)/;
const VIEWPORT_RE = /^(vendor-three|viewport)/;
const PANEL_RE = /panel|Periodic|Compound|Conditions|Molecule|Reaction|Toolbar|TextInput|Io/;

for (const file of readdirSync(DIST_ASSETS)) {
  if (!file.endsWith('.js')) continue;
  const size = getGzipSize(resolve(DIST_ASSETS, file));
  const kb = (size / 1024).toFixed(1);

  if (INITIAL_RE.test(file)) {
    initialTotal += size;
    console.log(`[initial] ${file}: ${kb} KB gzip`);
  } else if (VIEWPORT_RE.test(file)) {
    console.log(`[viewport] ${file}: ${kb} KB gzip`);
    if (size > THRESHOLDS.viewport) {
      console.error(
        `✗ ${file} exceeds viewport limit (${(THRESHOLDS.viewport / 1024).toFixed(0)} KB)`,
      );
      failed = true;
    }
  } else if (PANEL_RE.test(file)) {
    console.log(`[panel] ${file}: ${kb} KB gzip`);
    if (size > THRESHOLDS.panel) {
      console.warn(
        `⚠ ${file} exceeds panel limit (${(THRESHOLDS.panel / 1024).toFixed(0)} KB)`,
      );
    }
  } else {
    console.log(`[other] ${file}: ${kb} KB gzip`);
  }
}

const initialKb = (initialTotal / 1024).toFixed(1);
console.log(
  `\nInitial bundle total: ${initialKb} KB gzip (limit ${(THRESHOLDS.initial / 1024).toFixed(0)} KB)`,
);

if (initialTotal > THRESHOLDS.initial) {
  console.error(`✗ Initial bundle exceeds limit`);
  failed = true;
}

if (failed) {
  process.exit(1);
}
console.log('✓ All size checks passed.');
