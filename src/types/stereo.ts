export type AtomStereoTag = 'none' | 'R' | 'S' | 'unspecified';

export type BondStereoTag = 'none' | 'E' | 'Z' | 'any';

export interface StereoAnnotations {
  readonly atomStereo: ReadonlyArray<{ readonly atomIdx: number; readonly tag: AtomStereoTag }>;
  readonly bondStereo: ReadonlyArray<{ readonly bondIdx: number; readonly tag: BondStereoTag }>;
}

export const EMPTY_STEREO: StereoAnnotations = {
  atomStereo: [],
  bondStereo: [],
};
