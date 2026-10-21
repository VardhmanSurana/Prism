import React, { useState } from 'react';
import { HardDrive, PieChart, Disc } from 'lucide-react';

interface StorageCategory {
  id: string;
  name: string;
  bytes: number;
  color: string;
  description: string;
}

export const formatStorageBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

interface StorageDistributionCardProps {
  databaseSizeBytes?: number;
  thumbnailCacheSizeBytes?: number;
  modelsDirSizeBytes?: number;
  originalSizeBytes?: number;
  proxiesSizeBytes?: number;
  totalDiskFreeBytes?: number;
}

export const StorageDistributionCard: React.FC<StorageDistributionCardProps> = ({
  databaseSizeBytes = 0,
  thumbnailCacheSizeBytes = 0,
  modelsDirSizeBytes = 0,
  originalSizeBytes = 0,
  proxiesSizeBytes = 0,
  totalDiskFreeBytes,
}) => {
  const [chartStyle, setChartStyle] = useState<'donut' | 'concentric'>('donut');
  const [hoveredCategory, setHoveredCategory] = useState<StorageCategory | null>(null);

  const categories: StorageCategory[] = [
    {
      id: 'originals',
      name: 'Originals',
      bytes: Math.max(0, originalSizeBytes),
      color: '#e5e2e0',
      description: 'Master RAW & video exposures linked non-destructively',
    },
    {
      id: 'thumbs',
      name: 'WebP Previews',
      bytes: Math.max(0, thumbnailCacheSizeBytes),
      color: '#38bdf8',
      description: 'Multi-scale hardware mipmaps & retinal grid cache',
    },
    {
      id: 'models',
      name: 'Neural Models',
      bytes: Math.max(0, modelsDirSizeBytes),
      color: '#c084fc',
      description: 'SigLIP-2, ArcFace & OCR local ONNX inference weights',
    },
    {
      id: 'db',
      name: 'Database & WAL',
      bytes: Math.max(0, databaseSizeBytes),
      color: '#f59e0b',
      description: 'SQLite catalog, B-Trees & FTS5 full-text vector indexes',
    },
  ];

  const totalUsedBytes = categories.reduce((acc, c) => acc + c.bytes, 0);

  // Dynamic values
  const activeTitle = hoveredCategory ? hoveredCategory.name : 'Total Payload';
  const activeValue = hoveredCategory ? formatStorageBytes(hoveredCategory.bytes) : formatStorageBytes(totalUsedBytes);
  const activeSubtitle = hoveredCategory
    ? totalUsedBytes > 0
      ? `${((hoveredCategory.bytes / totalUsedBytes) * 100).toFixed(1)}% of total`
      : '0%'
    : totalDiskFreeBytes && totalDiskFreeBytes > 0
      ? `${formatStorageBytes(totalDiskFreeBytes)} Free Headroom`
      : 'Volume Nominal';
  const activeColor = hoveredCategory ? hoveredCategory.color : '#f5f0ed';
  const activeDescription = hoveredCategory
    ? `${hoveredCategory.description} (${formatStorageBytes(hoveredCategory.bytes)})`
    : 'Local filesystem storage distribution across master assets and cache';

  // Donut geometry constants
  const donutRadius = 84;
  const donutCircumference = 2 * Math.PI * donutRadius; // ~527.79

  // Calculate slice offsets dynamically
  let accumulatedRatio = 0;
  const donutSlices = categories.map((cat) => {
    const ratio = totalUsedBytes > 0 ? cat.bytes / totalUsedBytes : 0;
    const strokeLength = Math.max(0, ratio * donutCircumference);
    const strokeOffset = -(accumulatedRatio * donutCircumference);
    accumulatedRatio += ratio;
    return {
      cat,
      strokeLength,
      strokeOffset,
      ratio,
    };
  });

  // Concentric rings configuration
  const concentricRings = [
    { cat: categories[0], r: 96, c: 2 * Math.PI * 96 },
    { cat: categories[1], r: 82, c: 2 * Math.PI * 82 },
    { cat: categories[2], r: 68, c: 2 * Math.PI * 68 },
    { cat: categories[3], r: 54, c: 2 * Math.PI * 54 },
  ];

  return (
    <div className="bg-[#151312] border border-[#211f1e] hover:border-white/10 rounded-2xl p-6 transition-all shadow-xl flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a]">Phase 03 Storage</span>
              <span className="text-[#4d4541] text-[10px]">•</span>
              <h2 className="font-serif text-lg text-[#f5f0ed] tracking-tight">Storage Allocation</h2>
            </div>
            <p className="text-xs text-[#a8a29e] mt-0.5">Physical disk breakdown across media &amp; caches</p>
          </div>
          <div className="flex items-center gap-1 bg-[#100e0d] p-1 rounded-xl border border-white/5 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setChartStyle('donut')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                chartStyle === 'donut'
                  ? 'bg-[#2c2928] text-[#f5f0ed] font-medium border border-white/10 shadow-sm'
                  : 'text-[#998f8a] hover:text-[#f5f0ed]'
              }`}
            >
              <PieChart size={12} />
              <span>Donut</span>
            </button>
            <button
              type="button"
              onClick={() => setChartStyle('concentric')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                chartStyle === 'concentric'
                  ? 'bg-[#2c2928] text-[#f5f0ed] font-medium border border-white/10 shadow-sm'
                  : 'text-[#998f8a] hover:text-[#f5f0ed]'
              }`}
            >
              <Disc size={12} />
              <span>Rings</span>
            </button>
          </div>
        </div>

        {/* Visual Chart Graphic with Guaranteed Zero-Collision Center */}
        <div className="relative flex items-center justify-center my-4">
          {chartStyle === 'donut' ? (
            <svg className="w-56 h-56 transition-all" viewBox="0 0 240 240">
              <circle cx="120" cy="120" r="72" fill="#100e0d" />
              <circle
                cx="120"
                cy="120"
                r={donutRadius}
                fill="none"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="18"
              />
              {/* Dynamic Slices */}
              {donutSlices.map(({ cat, strokeLength, strokeOffset, ratio }) => {
                if (ratio <= 0.0001) return null;
                const isHovered = hoveredCategory?.id === cat.id;
                return (
                  <circle
                    key={cat.id}
                    cx="120"
                    cy="120"
                    r={donutRadius}
                    fill="none"
                    stroke={cat.color}
                    strokeWidth={isHovered ? 22 : 18}
                    strokeDasharray={`${strokeLength.toFixed(2)} ${(donutCircumference - strokeLength).toFixed(2)}`}
                    strokeDashoffset={strokeOffset.toFixed(2)}
                    transform="rotate(-90 120 120)"
                    style={{
                      transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                      opacity: hoveredCategory && !isHovered ? 0.5 : 1,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={() => setHoveredCategory(cat)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  />
                );
              })}
            </svg>
          ) : (
            <svg className="w-56 h-56 transition-all" viewBox="0 0 240 240">
              {concentricRings.map(({ cat, r, c }) => {
                const ratio = totalUsedBytes > 0 ? cat.bytes / totalUsedBytes : 0;
                const dashLen = Math.max(ratio > 0 ? 5 : 0, ratio * c);
                const isHovered = hoveredCategory?.id === cat.id;

                return (
                  <g key={cat.id}>
                    <circle
                      cx="120"
                      cy="120"
                      r={r}
                      fill="none"
                      stroke={`${cat.color}15`}
                      strokeWidth="8"
                    />
                    <circle
                      cx="120"
                      cy="120"
                      r={r}
                      fill="none"
                      stroke={cat.color}
                      strokeWidth={isHovered ? 10 : 8}
                      strokeDasharray={`${dashLen.toFixed(1)} ${c.toFixed(1)}`}
                      strokeLinecap="round"
                      transform="rotate(-90 120 120)"
                      style={{
                        transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                        opacity: hoveredCategory && !isHovered ? 0.5 : 1,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={() => setHoveredCategory(cat)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {/* Center KPI Box */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <div className="w-[110px] flex flex-col items-center justify-center px-1">
              <span
                className="font-serif text-2xl text-[#f5f0ed] tracking-tight transition-colors duration-200"
                style={{ color: activeColor }}
              >
                {activeValue}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a] mt-0.5 truncate w-full">
                {activeTitle}
              </span>
              <span className="font-mono text-[10px] text-emerald-400/90 mt-0.5 truncate w-full">
                {activeSubtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Dedicated Contextual Detail Strip */}
        <div className="mt-3 mb-2 px-3 py-1.5 rounded-xl bg-[#100e0d] border border-white/5 text-center min-h-[34px] flex items-center justify-center">
          <span
            className="text-[11px] font-mono transition-colors duration-200 truncate"
            style={{ color: hoveredCategory ? hoveredCategory.color : '#a8a29e' }}
          >
            {activeDescription}
          </span>
        </div>
      </div>

      {/* Interactive Legend Grid */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.04] text-xs font-mono">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={`flex items-center gap-2 p-2.5 rounded-xl bg-[#1d1b1a] border transition-all cursor-pointer ${
              hoveredCategory?.id === cat.id ? 'border-white/20 bg-[#211f1e]' : 'border-white/5 hover:border-white/10'
            }`}
            onMouseEnter={() => setHoveredCategory(cat)}
            onMouseLeave={() => setHoveredCategory(null)}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_6px_rgba(255,255,255,0.2)]" style={{ backgroundColor: cat.color }} />
            <div className="min-w-0 flex-1">
              <div className="text-[#f5f0ed] text-xs truncate">{cat.name}</div>
              <div className="text-[10px] text-[#78716c]">
                {formatStorageBytes(cat.bytes)} ({totalUsedBytes > 0 ? ((cat.bytes / totalUsedBytes) * 100).toFixed(0) : '0'}%)
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
