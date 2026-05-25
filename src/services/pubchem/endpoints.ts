const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

// Phase 15 hotfix — PubChem REST API 가 2025 이후 'CanonicalSMILES'/'IsomericSMILES'
// 를 'SMILES'/'ConnectivitySMILES' 로 변경. 본 URL 은 신규 필드명 사용.
// schemas/normalize 는 legacy 필드도 fallback 으로 수용 (fixture/cache 호환).
const PROPERTY_FIELDS = [
  'MolecularFormula',
  'MolecularWeight',
  'SMILES',
  'ConnectivitySMILES',
  'InChI',
  'InChIKey',
  'IUPACName',
  'XLogP',
  'Complexity',
].join(',');

export function cidPropertiesUrl(cid: number): string {
  return `${BASE}/compound/cid/${cid}/property/${PROPERTY_FIELDS}/JSON`;
}

export function cid3dSdfUrl(cid: number): string {
  return `${BASE}/compound/cid/${cid}/SDF?record_type=3d`;
}

export function nameToCidUrl(name: string): string {
  return `${BASE}/compound/name/${encodeURIComponent(name)}/cids/JSON`;
}

export function inchiKeyToCidUrl(key: string): string {
  return `${BASE}/compound/inchikey/${encodeURIComponent(key)}/cids/JSON`;
}
