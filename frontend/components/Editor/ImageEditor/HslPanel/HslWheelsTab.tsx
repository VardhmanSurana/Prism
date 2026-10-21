/**
 * HslWheelsTab.tsx
 * 3-way and Log color wheels.
 */
import React from 'react';
import { ColorWheelsPanel } from '../ColorWheelsPanel';
import { Adjustments, ColorWheelsAdjustments } from '../filterEngine';
import { DEFAULT_COLOR_WHEELS } from '../adjustmentTypes';

export interface HslWheelsTabProps {
  colorWheels: ColorWheelsAdjustments | undefined;
  onColorWheelsChange: (val: ColorWheelsAdjustments) => void;
}

export const HslWheelsTab: React.FC<HslWheelsTabProps> = (p) => (
  <div className="p-3">
    <ColorWheelsPanel
      value={p.colorWheels ?? DEFAULT_COLOR_WHEELS}
      onChange={p.onColorWheelsChange}
    />
  </div>
);
