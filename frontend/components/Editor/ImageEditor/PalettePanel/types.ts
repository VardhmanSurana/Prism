export interface PalettePanelProps {
  imageSrc?: string;
  swatches?: string[];
  locked?: boolean[];
  onSwatchesChange?: (s: string[]) => void;
  onLockedChange?: (l: boolean[]) => void;
  onStartEyedropper?: (targetIdx: number) => void;
  activeEyedropperIndex?: number | null;
}

