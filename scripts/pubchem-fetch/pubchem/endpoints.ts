import { PUBCHEM_BASE_URL } from '../config.js';

export function nameTocidUrl(name: string): string {
  return `${PUBCHEM_BASE_URL}/compound/name/${encodeURIComponent(name)}/cids/JSON`;
}

export function propertiesUrl(cids: ReadonlyArray<number>): string {
  const fields = [
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
  return `${PUBCHEM_BASE_URL}/compound/cid/${cids.join(',')}/property/${fields}/JSON`;
}

export function synonymsUrl(cid: number): string {
  return `${PUBCHEM_BASE_URL}/compound/cid/${cid}/synonyms/JSON`;
}

export function sdf3dUrl(cid: number): string {
  return `${PUBCHEM_BASE_URL}/compound/cid/${cid}/SDF?record_type=3d`;
}
