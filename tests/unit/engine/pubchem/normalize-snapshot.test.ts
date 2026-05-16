/**
 * Phase 05 DoD #13 / §8.1 #6 — normalize 골든 스냅샷.
 *
 * `normalizePubChemResponse` 의 출력 구조가 의도치 않게 변경되면 스냅샷이 깨진다.
 * 스냅샷이 갱신된 PR 에서 `NORMALIZE_SCHEMA_VERSION` 이 같이 bump 되지 않으면
 * schemaVersion-guard.test.ts 가 별도로 실패하는 안전장치와 짝을 이룬다.
 *
 * 결정성: brand atom/bond ID 는 `crypto.randomUUID()` 라 휘발성이므로
 * 스냅샷에서 제외/정규화한다. 여기서는 mock RDKit 백엔드의 embed 가 빈
 * atoms/bonds 를 반환하고 normalize 가 molecule id 를 결정적 `cid:962` 로
 * 덮어쓰므로 휘발성 필드가 없지만, 회귀 안전을 위해 명시적으로 스칼라/구조
 * 필드만 스냅샷한다 (raw UUID 미포함).
 */
import { describe, it, expect } from 'vitest';
import { normalizePubChemResponse } from '@/engine/pubchem/normalize';
import type { NormalizeOptions } from '@/engine/pubchem/normalize';
import { createMockRdkitBackend } from '../../../unit/engine/rdkit/mock-backend';
import { waterPropertiesResponse } from '@/services/pubchem/__fixtures__/pubchem-responses/water';

const waterRow = waterPropertiesResponse.PropertyTable.Properties[0]!;

/**
 * 휘발성 ID 를 안정 토큰으로 치환한 직렬화 가능한 스냅샷 형태를 만든다.
 * (atoms/bonds 의 brand UUID 는 구조만 남기고 ID 는 '<id>' 로 정규화.)
 */
function snapshotShape(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, val) => {
      if ((key === 'id' || key === 'a' || key === 'b') && typeof val === 'string') {
        // molecule.id 는 결정적(cid:NNN)이라 그대로 두되, UUID 형태만 정규화.
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
        return isUuid ? '<uuid>' : val;
      }
      return val;
    }),
  );
}

describe('normalizePubChemResponse golden snapshot (water / CID 962)', () => {
  it('produces a deterministic structural snapshot', async () => {
    const opts: NormalizeOptions = {
      rdkit: createMockRdkitBackend(),
      fillRuntimeDefaults: true,
    };

    const result = await normalizePubChemResponse(waterRow, null, opts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(snapshotShape(result.value)).toMatchInlineSnapshot(`
      {
        "category": "inorganic-common",
        "cid": 962,
        "coordinateSource": "rdkit-etkdg",
        "defaultMolecule": {
          "atoms": [],
          "bonds": [],
          "canonicalSmiles": "O",
          "id": "cid:962",
          "inchi": null,
          "inchiKey": null,
          "spinMultiplicity": 1,
          "stereo": {
            "atomStereo": [],
            "bondStereo": [],
          },
          "totalCharge": 0,
        },
        "inchi": "InChI=1S/CH4/h1H4",
        "inchiKey": "VNWKTOKETHGBQD-UHFFFAOYSA-N",
        "iupacName": "oxidane",
        "molecularFormula": "H2O",
        "molecularWeight": 18.015,
        "name": {
          "en": "oxidane",
          "ko": null,
        },
        "priority": 9999,
        "properties": {
          "boilingPointK": null,
          "densityGPerCm3": null,
          "logP": -0.47,
          "meltingPointK": null,
          "standardState": "unknown",
          "waterSolubility": "unknown",
        },
        "provenance": "runtime-fetch",
        "smiles": "O",
        "synonyms": [],
      }
    `);
  });

  it('is stable across repeated invocations (no UUID leakage in scalar fields)', async () => {
    const opts: NormalizeOptions = {
      rdkit: createMockRdkitBackend(),
      fillRuntimeDefaults: true,
    };
    const r1 = await normalizePubChemResponse(waterRow, null, opts);
    const r2 = await normalizePubChemResponse(waterRow, null, opts);
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(snapshotShape(r1.value)).toEqual(snapshotShape(r2.value));
  });
});
