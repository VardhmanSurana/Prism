import { RawSettings } from '../rawEngine';

export interface RawEnginePanelProps {
  settings?: RawSettings;
  onChange: (s: RawSettings) => void;
  photoId?: number | string;
  imageSrc?: string;
}

