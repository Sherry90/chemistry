#!/usr/bin/env node
// Phase 15 §6.5 I7 — i18n 키 합집합 ↔ 코드 t('...') 사용 집합 diff.
// 종료 코드: 0 = clean(또는 미사용만 존재), 1 = ko/en 대칭 불일치, 2 = 코드↔JSON 누락,
// 3 = 1|2 동시.
// 미사용(unused)은 WARNING — CI fail 시키지 않음 (Phase 15 spec §6.5).
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const I18N = path.join(SRC, 'i18n', 'resources');

const NS_MAP = { common: ['common.json', 'shortcuts.json'], panels: ['panels.json'] };
const NS_PREFIX = { 'shortcuts.json': 'shortcuts' };

async function loadKeys(locale) {
  const flat = new Set();
  for (const [ns, files] of Object.entries(NS_MAP)) {
    for (const file of files) {
      const fp = path.join(I18N, locale, file);
      const obj = JSON.parse(await fs.readFile(fp, 'utf8'));
      const prefix = NS_PREFIX[file] ? `${NS_PREFIX[file]}.` : '';
      walk(obj, `${ns}:${prefix}`, flat);
    }
  }
  return flat;
}

function walk(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const next = `${prefix}${k}`;
    if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, `${next}.`, out);
    else out.add(next);
  }
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', 'playwright-report', 'test-results', '.git']);
async function walkSrc(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) await walkSrc(fp, files);
    else if (/\.(ts|tsx)$/.test(ent.name)) files.push(fp);
  }
  return files;
}

// messageKey/i18nLabelKey/i18nTitleKey: 소비 시점에 ToastItem/Dialog 등에서 default ns='common'
// 으로 t() 호출됨 (producer 파일의 useTranslation ns 와 무관). 명시 ns prefix 없으면 common 강제.
const MSGKEY_RE = /\b(?:messageKey|i18nLabelKey|i18nTitleKey)\s*[:=]\s*\{?['"]([a-zA-Z0-9_:.-]+?)['"]/g;
// 절대 경로 i18n 키 리터럴 (객체 프로퍼티 값). `<ident>: 'common.X.Y'` / `key: 'panels.X'`.
// 매퍼/룩업 테이블 모두 커버. ns 명시 prefix 가 anchor 라 false-positive 낮음.
const MAPPING_KEY_RE = /\b[a-zA-Z_$][\w$]*\s*:\s*['"]((?:common|panels)\.[a-zA-Z0-9_.-]+)['"]/g;
// 매퍼 함수 직반환 패턴: `return 'X.Y.Z'` — 점 2개 이상. selectors.ts 의 ...ErrorToKey()
// 가 string 반환 → 호출처에서 t(value, {ns:'common'}) 로 해소.
const RETURN_KEY_RE = /\breturn\s+['"]([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+){2,})['"]/g;
// 동적 i18n-shape 템플릿 (t() 밖, 예: i18nLabelKey: `shortcuts.${action}`).
// false-positive 허용 (used 로 over-mark).
const TEMPLATE_KEY_RE = /`([a-z][a-zA-Z0-9_:.-]*\.)\$\{/g;
// 파일별 const literal: const F = 'panels:foo.bar' → F → 'panels:foo.bar'.
const CONST_LIT_RE = /\bconst\s+([A-Z_][A-Z0-9_]*)\s*(?::\s*\w+\s*)?=\s*['"]([a-zA-Z0-9_:.-]+?)['"]/g;
// 동적 ${CONST}.suffix or ${CONST}.${x} 패턴 추출.
const DYN_CONST_RE = /\bt\s*\(\s*`\$\{([A-Z_][A-Z0-9_]*)\}\.([a-zA-Z0-9_.-]*)/g;

// useTranslation 별칭: const { t: NAME } = useTranslation('NS') → NAME → NS.
const ALIAS_RE = /\{\s*t\s*:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}\s*=\s*useTranslation\(\s*['"]?([a-z]*)['"]?\s*\)/g;

async function scanCode() {
  const files = await walkSrc(SRC);
  const staticUses = [];
  const dynamicPrefixes = new Set();
  for (const fp of files) {
    if (fp.includes(`${path.sep}i18n${path.sep}`)) continue;
    const text = await fs.readFile(fp, 'utf8');
    const fileNsSet = new Set();
    for (const m of text.matchAll(/useTranslation\(\s*['"]([a-z]+)['"]/g)) fileNsSet.add(m[1]);
    if (fileNsSet.size === 0) fileNsSet.add('common');
    const aliases = new Map(); // alias 함수명 → ns
    aliases.set('t', null); // null = file ns set
    for (const m of text.matchAll(ALIAS_RE)) aliases.set(m[1], m[2] || 'common');
    const consts = new Map();
    for (const m of text.matchAll(CONST_LIT_RE)) consts.set(m[1], m[2]);
    const candidatesFor = (k, aliasName = 't') => {
      if (k.includes(':')) return new Set([k]);
      const alias = aliases.get(aliasName);
      if (alias) return new Set([`${alias}:${k}`]);
      const set = new Set();
      for (const ns of fileNsSet) set.add(`${ns}:${k}`);
      return set;
    };
    const addKey = (raw, aliasName = 't') =>
      staticUses.push({ raw, candidates: candidatesFor(raw, aliasName) });
    const addPrefix = (p, aliasName = 't') => {
      if (p.includes(':')) {
        dynamicPrefixes.add(p);
        return;
      }
      const alias = aliases.get(aliasName);
      if (alias) {
        dynamicPrefixes.add(`${alias}:${p}`);
      } else {
        for (const ns of fileNsSet) dynamicPrefixes.add(`${ns}:${p}`);
      }
    };
    // 모든 alias (t, tPanels, tCommon …) 정적/템플릿 호출 스캔.
    for (const alias of aliases.keys()) {
      const aliasEsc = alias.replace(/[$]/g, '\\$&');
      const staticRe = new RegExp(`\\b${aliasEsc}\\s*\\(\\s*['"]([a-zA-Z0-9_:.\\-]+?)['"]`, 'g');
      const staticBtRe = new RegExp(`\\b${aliasEsc}\\s*\\(\\s*\`([a-zA-Z0-9_:.\\-]+?)\``, 'g');
      const dynPrefRe = new RegExp(`\\b${aliasEsc}\\s*\\(\\s*\`([a-zA-Z0-9_:.\\-]*?)\\$\\{`, 'g');
      for (const m of text.matchAll(staticRe)) addKey(m[1], alias);
      for (const m of text.matchAll(staticBtRe)) addKey(m[1], alias);
      for (const m of text.matchAll(dynPrefRe)) {
        if (m[1]) addPrefix(m[1], alias);
      }
    }
    for (const m of text.matchAll(MSGKEY_RE)) {
      const raw = m[1];
      const qualified = raw.includes(':') ? raw : `common:${raw}`;
      staticUses.push({ raw, candidates: new Set([qualified]) });
    }
    for (const m of text.matchAll(MAPPING_KEY_RE)) {
      const dot = m[1].indexOf('.');
      const ns = m[1].slice(0, dot);
      const stripped = m[1].slice(dot + 1);
      // 두 해석 모두 허용 (ErrorMessage 의 strip 패턴 vs LoadingOverlay 의 flat 패턴).
      // 어느 한 쪽 매치되면 used.
      staticUses.push({
        raw: m[1],
        candidates: new Set([`${ns}:${stripped}`, `${ns}:${m[1]}`]),
      });
    }
    for (const m of text.matchAll(RETURN_KEY_RE)) {
      staticUses.push({ raw: m[1], candidates: new Set([`common:${m[1]}`]) });
    }
    for (const m of text.matchAll(TEMPLATE_KEY_RE)) {
      if (m[1]) addPrefix(m[1]);
    }
    for (const m of text.matchAll(DYN_CONST_RE)) {
      const constName = m[1];
      const tail = m[2];
      const base = consts.get(constName);
      if (!base) continue;
      if (tail.includes('${')) {
        const head = tail.split('${')[0];
        addPrefix(`${base}.${head}`);
      } else {
        addKey(`${base}.${tail}`);
      }
    }
  }
  return { staticUses, dynamicPrefixes };
}

function matchesDynamic(jsonKey, prefixes) {
  for (const p of prefixes) {
    if (jsonKey.startsWith(p)) return true;
  }
  return false;
}

async function main() {
  const ko = await loadKeys('ko');
  const en = await loadKeys('en');
  const { staticUses, dynamicPrefixes } = await scanCode();

  const onlyKo = [...ko].filter((k) => !en.has(k)).sort();
  const onlyEn = [...en].filter((k) => !ko.has(k)).sort();

  const allJson = new Set([...ko, ...en]);
  // 누락: 모든 candidates 가 JSON 에 없음.
  const missing = [];
  const usedKeys = new Set();
  for (const u of staticUses) {
    let hit = false;
    for (const c of u.candidates) {
      if (allJson.has(c)) {
        usedKeys.add(c);
        hit = true;
      }
    }
    if (!hit) missing.push(u.raw);
  }
  missing.sort();

  const unused = [];
  for (const k of allJson) {
    if (usedKeys.has(k)) continue;
    if (matchesDynamic(k, dynamicPrefixes)) continue;
    unused.push(k);
  }
  unused.sort();

  const report = [];
  let exit = 0;
  if (onlyKo.length || onlyEn.length) {
    exit |= 1;
    report.push(`[i18n-check] FAIL — ko/en 대칭차 ${onlyKo.length + onlyEn.length} 건`);
    onlyKo.forEach((k) => report.push(`  - only ko: ${k}`));
    onlyEn.forEach((k) => report.push(`  - only en: ${k}`));
  }
  if (missing.length) {
    exit |= 2;
    report.push(`[i18n-check] FAIL — 코드에서 사용되나 JSON 누락 ${missing.length} 건`);
    missing.forEach((k) => report.push(`  - missing: ${k}`));
  }
  if (unused.length) {
    report.push(`[i18n-check] WARN — JSON 에 있으나 코드 미사용 ${unused.length} 건 (CI 비차단)`);
    unused.forEach((k) => report.push(`  - unused: ${k}`));
  }
  if (exit === 0 && unused.length === 0) {
    console.log('[i18n-check] OK — 대칭/누락/미사용 0.');
  } else if (exit === 0) {
    console.log(report.join('\n'));
    console.log(`[i18n-check] OK — 누락 0 (미사용 ${unused.length} 건 WARN).`);
  } else {
    console.log(report.join('\n'));
  }
  process.exit(exit);
}

main().catch((err) => {
  console.error('[i18n-check] fail:', err);
  process.exit(99);
});
