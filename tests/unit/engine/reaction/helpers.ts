import type { Atom, Molecule } from '@/chemistry/compounds/types';
import type { ReactionRule, Condition } from '@/chemistry/reactions/types';
import type { ElementNumber } from '@/chemistry/elements/types';
import { createAtomId, createMoleculeId } from '@/chemistry/compounds/ids';
import { EMPTY_STEREO } from '@/types/stereo';

export function atom(elementNumber: number, over: Partial<Atom> = {}): Atom {
  return {
    id: createAtomId(),
    elementNumber: elementNumber as ElementNumber,
    position: { x: 0, y: 0, z: 0 },
    formalCharge: 0,
    implicitHCount: 0,
    ...over,
  };
}

export function molecule(over: Partial<Molecule> = {}): Molecule {
  return {
    id: createMoleculeId(),
    atoms: [],
    bonds: [],
    totalCharge: 0,
    canonicalSmiles: 'X',
    inchi: null,
    inchiKey: null,
    stereo: EMPTY_STEREO,
    spinMultiplicity: 1,
    ...over,
  };
}

export function rule(over: Partial<ReactionRule> = {}): ReactionRule {
  return {
    id: 'r1',
    smarts: 'A>>B',
    conditionRange: {},
    thermo: 'unknown',
    source: 'test',
    priority: 0,
    confidence: 'medium',
    categories: ['simple-redox'],
    version: 'v-test',
    license: 'in-house',
    requiredElements: [],
    ...over,
  };
}

export function condition(over: Partial<Condition> = {}): Condition {
  return { temperatureK: 298, pressureAtm: 1, pH: null, ...over };
}
