const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

const PROPERTY_FIELDS = [
  'MolecularFormula',
  'MolecularWeight',
  'CanonicalSMILES',
  'IsomericSMILES',
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
