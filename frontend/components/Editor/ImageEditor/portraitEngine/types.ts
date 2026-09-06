/**
 * portraitEngine types
 */

export interface MaskBuffer {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface SingleFaceMasks {
  skin?: MaskBuffer | null;
  eyes?: MaskBuffer | null;
  lips?: MaskBuffer | null;
  teeth?: MaskBuffer | null;
  eyebrows?: MaskBuffer | null;
}

export type LoadedPortraitMasks = SingleFaceMasks & {
  faces?: Record<string, SingleFaceMasks>;
};

