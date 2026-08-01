import React from 'react';
import { useGalleryLayout, GalleryStyle, ImageGrouping } from '../../hooks/useGalleryLayout';
import { useTelemetry } from '../../hooks/useTelemetry';
import { Palette } from 'lucide-react';
import { Switch } from '../ui';

const GALLERY_STYLE_OPTIONS: { 
  value: GalleryStyle; 
  label: string; 
  icon: React.ReactNode; 
  bgColor: string; 
  available: boolean 
}[] = [
  { 
    value: 'prism', 
    label: 'Prism', 
    icon: <Palette size={20} className="text-[var(--cr-accent)]" />,
    bgColor: 'bg-[#5e6ad2]/20 border border-[#5e6ad2]/30',
    available: true 
  },
  { 
    value: 'google', 
    label: 'Google Photos', 
    icon: <img src="/images.jpeg" alt="Google Photos" className="w-8 h-8 object-contain rounded-full" />,
    bgColor: 'bg-white',
    available: true 
  },
  { 
    value: 'apple', 
    label: 'Apple Photos', 
    icon: <img src="/apple-photos.jpeg" alt="Apple Photos" className="w-8 h-8 object-contain rounded-xl" />,
    bgColor: 'bg-white',
    available: false 
  },
];

const IMAGE_GROUPING_OPTIONS: { value: ImageGrouping; label: string; description: string }[] = [
  { value: 'none', label: 'All Photos', description: 'All photos without date grouping' },
  { value: 'months', label: 'Months Grouping', description: 'Group photos by month' },
  { value: 'years', label: 'Years Grouping', description: 'Group photos by year like Apple iCloud Photos' },
];

export const Appearance: React.FC = () => {
  const { settings, setGalleryStyle, setImageGrouping, setCornerRadius } = useGalleryLayout();
  const { logAction } = useTelemetry();
  const isPrism = settings.galleryStyle === 'prism';
  const [prevRadius, setPrevRadius] = React.useState(settings.cornerRadius > 0 ? settings.cornerRadius : 8);

  return (
    <div className="cr-card space-y-6">
      <div className="border-b border-[var(--cr-border)] pb-3">
        <div className="cr-card-title flex items-center gap-2 mb-1">
          <Palette size={14} className="text-[var(--cr-accent)]" />
          <span>Themes & Interface Customization</span>
        </div>
        <p className="text-xs text-[var(--cr-text-muted)]">
          Choose a gallery theme to change the overall look and feel of your photo library. Each theme offers a unique visual experience.
        </p>
      </div>

      <div>
        <div className="font-mono text-[10px] uppercase text-[var(--cr-text-muted)] tracking-wider mb-4">
          Gallery Theme Options
        </div>
        <div className="cr-theme-grid">
          {GALLERY_STYLE_OPTIONS.map((opt) => {
            const isActive = settings.galleryStyle === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { if (opt.available) { logAction('Appearance', 'theme_change', { from: settings.galleryStyle, to: opt.value }); setGalleryStyle(opt.value); } }}
                disabled={!opt.available}
                className={`cr-theme-card flex items-center gap-4 text-left ${
                  !opt.available
                    ? 'opacity-40 cursor-not-allowed'
                    : isActive
                      ? 'selected'
                      : ''
                }`}
              >
                <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${opt.bgColor}`}>
                  {opt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs font-semibold text-[var(--cr-text-primary)]">
                    {opt.label}
                  </span>
                  {!opt.available && (
                    <span className="ml-2 text-[10px] text-[var(--cr-text-muted)]">Coming soon</span>
                  )}
                </div>
                {isActive && (
                  <span className="font-mono text-[10px] font-bold text-[var(--cr-accent)]">ACTIVE</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gallery page customizations (customizable only if Prism theme is active) */}
      <div className="border-t border-[var(--cr-border)] pt-4 space-y-5">
        <div className="font-mono text-[10px] uppercase text-[var(--cr-text-muted)] tracking-wider flex items-center justify-between">
          <span>Gallery Page Customization</span>
          {!isPrism && (
            <span className="text-[10px] text-amber-500 font-semibold uppercase tracking-wider">Locked</span>
          )}
        </div>

        {!isPrism && (
          <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
            ℹ️ Customizations below are locked and only configurable when using the <strong>Prism</strong> theme. Select Prism under Theme Options above to customize.
          </div>
        )}

        <div className={!isPrism ? 'opacity-40 pointer-events-none' : 'space-y-5'}>
          {/* Image grouping */}
          <div>
            <div className="text-[13px] font-medium text-[var(--cr-text-primary)] mb-3">Image View Mode (Grouping)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {IMAGE_GROUPING_OPTIONS.map((opt) => {
                const isActive = settings.imageGrouping === opt.value;
                return (
                  <button
                    key={opt.value}
                    disabled={!isPrism}
                    onClick={() => { logAction('Appearance', 'image_grouping', { value: opt.value }); setImageGrouping(opt.value); }}
                    className={`flex flex-col justify-between rounded-xl p-3 text-left transition-all border ${
                      isActive
                        ? 'bg-[var(--cr-accent)]/10 border-[var(--cr-accent)]/40 shadow-sm'
                        : 'border-[var(--cr-border)] bg-transparent hover:bg-[var(--cr-surface-hover)] hover:border-[#444]'
                    } ${!isPrism ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                  >
                    <div className="w-full flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[var(--cr-text-primary)]">{opt.label}</span>
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-[var(--cr-accent)] animate-pulse" />
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--cr-text-muted)] leading-tight">{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Corner roundness */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[13px] font-medium text-[var(--cr-text-primary)]">Custom Corner Roundness</div>
                <div className="text-[11px] text-[var(--cr-text-muted)]">Toggle custom rounding and slide to adjust pixel radius</div>
              </div>
              <Switch
                label=""
                checked={settings.cornerRadius > 0}
                disabled={!isPrism}
                onToggle={() => {
                  if (settings.cornerRadius > 0) {
                    setCornerRadius(0);
                  } else {
                    setCornerRadius(prevRadius);
                  }
                }}
                ariaLabel="Toggle rounded corners"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={32}
                disabled={!isPrism || settings.cornerRadius === 0}
                value={settings.cornerRadius}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCornerRadius(val);
                  if (val > 0) setPrevRadius(val);
                }}
                className="flex-1 h-1 appearance-none bg-[var(--cr-border)] rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--cr-accent)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <span className="font-mono text-[11px] text-[var(--cr-text-muted)] w-8 text-right">{settings.cornerRadius}px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


