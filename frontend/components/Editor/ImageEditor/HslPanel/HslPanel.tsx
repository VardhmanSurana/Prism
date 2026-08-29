/**
 * HslPanel.tsx
 * Orchestrator: wires useHslState + the 4 sub-tabs + the shared header.
 */
import React from 'react';
import { Adjustments } from '../filterEngine';
import { HslTabs } from './HslTabs';
import { HslMixerTab } from './HslMixerTab';
import { HslBasicTab } from './HslBasicTab';
import { HslWheelsTab } from './HslWheelsTab';
import { HslToningTab } from './HslToningTab';
import { useHslState } from './useHslState';

interface HslPanelProps {
  adjustments: Adjustments;
  onChange: (adj: Adjustments) => void;
}

export const HslPanel: React.FC<HslPanelProps> = ({ adjustments, onChange }) => {
  const s = useHslState({ adjustments, onChange });

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14]">
      <HslTabs
        subTab={s.subTab}
        setSubTab={s.setSubTab}
        isHslModified={s.isHslModified}
        isBasicModified={s.isBasicModified}
        isToningModified={s.isToningModified}
      />

      {s.subTab === 'mixer' && (
        <HslMixerTab
          hsl={s.hsl}
          activeBand={s.activeBand}
          setActiveBand={s.setActiveBand}
          isHslModified={s.isHslModified}
          isBandModified={s.isBandModified}
          onSliderChange={s.handleSliderChange}
          onResetBand={s.handleResetBand}
          onResetAll={s.handleResetHslAll}
        />
      )}

      {s.subTab === 'basic' && (
        <HslBasicTab
          adjustments={adjustments}
          wbOption={s.wbOption}
          isBasicModified={s.isBasicModified}
          onBasicChange={s.handleBasicChange}
          onWbPresetChange={s.handleWbPresetChange}
          onResetAll={s.handleResetBasicAll}
        />
      )}

      {s.subTab === 'grading' && (
        <HslWheelsTab
          colorWheels={adjustments.colorWheels}
          onColorWheelsChange={s.handleColorWheelsChange}
        />
      )}

      {s.subTab === 'toning' && (
        <HslToningTab
          splitToning={adjustments.splitToning ?? {
            shadows: { hue: 0, saturation: 0 },
            highlights: { hue: 0, saturation: 0 },
            balance: 0,
          }}
          isToningModified={s.isToningModified}
          onResetAll={s.handleResetToningAll}
          onApplyPreset={s.applySplitPreset}
          onUpdateHighlights={s.updateHighlights}
          onUpdateShadows={s.updateShadows}
          onUpdateBalance={s.updateBalance}
        />
      )}
    </div>
  );
};
