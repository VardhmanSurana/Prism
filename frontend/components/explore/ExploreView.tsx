import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ShieldCheck, PlayCircle, Play, ArrowRight,
  ChevronRight, ArrowUpRight, Compass, Route, Zap, Palette,
  Cloud, Filter, Calendar, Camera, Film, Download, Layers,
  X, Check, Radio, Eye, ScanLine
} from 'lucide-react';
import { useTelemetry } from '@/hooks/useTelemetry';
import { API_BASE, resolveUrl } from '@/constants';

interface ExploreTheme {
  tag: string;
  count: number;
}

/**
 * ExploreView - Prism Semantic Discoveries & Intelligent Studio Core
 */
export const ExploreView: React.FC = () => {
  const { logAction } = useTelemetry();

  // State
  const [activeClusterTab, setActiveClusterTab] = useState<'all' | 'themes' | 'trips' | 'chronicles'>('all');
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [isSandboxVisible, setIsSandboxVisible] = useState(true);
  const [activeVideoModal, setActiveVideoModal] = useState<string | null>(null);
  const [activeScrubPercent, setActiveScrubPercent] = useState<number>(40);
  const [activeTimeframe, setActiveTimeframe] = useState<'12m' | 'all'>('12m');

  useEffect(() => {
    logAction('ExploreView', 'page_view', { studio: 'Prism Semantic Core' });
  }, [logAction]);

  // Semantic quick prompts
  const semanticPrompts = useMemo(
    () => [
      { id: 'porto', icon: '✨', label: 'Golden hour architectural facades in Porto' },
      { id: 'coffee', icon: '☕', label: 'Morning coffee steam with high contrast' },
      { id: 'ocean', icon: '🌊', label: 'Moody Atlantic coastlines with mist' },
      { id: 'mono', icon: '🎞️', label: 'Grainy 35mm monochrome portraits' },
      { id: 'kyoto', icon: '🌿', label: 'Kyoto moss gardens after rainfall' },
    ],
    []
  );

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#151312] overflow-y-auto px-4 md:px-8 py-6 select-none relative font-sans text-[#e7e1df]">
      {/* ── Subtle Ambient Atmospheric Backlights ── */}
      <div className="absolute top-0 left-0 right-0 h-96 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-20 w-[520px] h-[520px] bg-[#c6c6c7]/5 rounded-full blur-[140px]" />
        <div className="absolute top-96 right-10 w-[420px] h-[420px] bg-[#484745]/15 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto w-full relative z-10 flex flex-col gap-10 pb-16">
        {/* ── Section 1: Page Header & Live Telemetry ── */}
        <section className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="flex flex-col gap-1 max-w-3xl">
              <div className="flex items-center gap-2 text-[#998f8a]">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#d0c4be]">
                  Intelligent Studio Core
                </span>
                <span className="w-1 h-1 rounded-full bg-[#998f8a]" />
                <span className="text-[11px] font-mono tracking-wider text-[#998f8a]">
                  NODE://LOCAL_ACCEL_ACTIVE
                </span>
              </div>
              <h1 className="font-serif text-3xl md:text-4xl text-[#e7e1df] tracking-tight font-normal leading-tight">
                Explore & Semantic Discoveries
              </h1>
              <p className="text-[13px] text-[#a8a29e] leading-relaxed mt-1">
                Local machine intelligence running on Neural Engine & WebGPU. 24,810 assets indexed with zero cloud ingestion. Private, hardware-accelerated latent embeddings.
              </p>
            </div>

            {/* Hardware Telemetry Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1d1b1a] border border-white/[0.05] shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#86efac] shadow-[0_0_8px_#86efac]" />
                <span className="text-[11px] font-mono text-[#e7e1df]">Local Embedding v3.4 · 512-dim</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1d1b1a] border border-white/[0.05] shadow-sm">
                <Sparkles size={13} className="text-[#c6c6c7]" />
                <span className="text-[11px] font-mono text-[#d0c4be]">Neural Clustering Ready</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2c2928] text-[#e7e1df] border border-white/[0.08] shadow-sm">
                <ShieldCheck size={14} className="text-[#86efac]" />
                <span className="text-[11px] font-mono">Zero Cloud Upload Guaranteed</span>
              </div>
            </div>
          </div>

          {/* Semantic Search Prompt Chips */}
          <div className="pt-2 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#998f8a] font-semibold">
                Rediscover via Latent Text Inferences
              </span>
              <span className="text-[10px] font-mono text-[#998f8a]">
                Latency: 14ms · Cosine Sim &gt; 0.88
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {semanticPrompts.map((p) => {
                const isSelected = selectedPrompt === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPrompt(isSelected ? null : p.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shadow-sm group cursor-pointer border ${
                      isSelected
                        ? 'bg-[#c6c6c7] text-[#2f3131] border-white/20'
                        : 'bg-[#1d1b1a] hover:bg-[#211f1e] text-[#e7e1df] border-white/[0.05]'
                    }`}
                  >
                    <span>{p.icon}</span>
                    <span className={isSelected ? 'text-[#2f3131] font-semibold' : 'group-hover:text-[#c6c6c7] transition-colors'}>
                      {p.label}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedPrompt('custom')}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#2c2928] hover:bg-[#373433] text-[#c9c6c4] text-xs font-medium transition-all whitespace-nowrap shadow-sm border border-white/[0.06] cursor-pointer"
              >
                <span>+</span>
                <span>Custom Semantic Prompt</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── Section 2: Flagship Retrospectives ("On This Day") ── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-[#c6c6c7]" />
              <h2 className="font-serif text-xl md:text-2xl text-[#e7e1df] tracking-tight font-normal">
                Temporal Retrospectives & Chronicles
              </h2>
            </div>
            <span className="text-xs font-mono text-[#998f8a]">
              Sorted chronologically across archival nodes
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Card 1: Hero Retrospective (7 Columns) */}
            <div className="lg:col-span-7 bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
              <div className="flex flex-col gap-2 z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#2c2928] text-[#c9c6c4] border border-white/[0.04]">
                    On This Day · 1 Year Ago (Oct 24, 2023)
                  </span>
                  <span className="text-[11px] font-mono text-[#998f8a]">84 Exposures</span>
                </div>
                <div>
                  <h3 className="font-serif text-2xl text-[#e7e1df] tracking-tight group-hover:text-[#c6c6c7] transition-colors">
                    Autumn Light along Douro River Terraces
                  </h3>
                  <p className="text-xs text-[#a8a29e] flex items-center gap-1.5 pt-0.5">
                    <span>Porto, Portugal</span>
                    <span className="opacity-40">·</span>
                    <span className="font-mono">Hasselblad X2D 100C · 55mm f/2.5 V</span>
                  </p>
                </div>
              </div>

              {/* Mosaic Image Collage */}
              <div className="grid grid-cols-3 gap-2 my-4 z-10">
                <div className="col-span-2 h-64 rounded-xl overflow-hidden relative shadow-inner bg-[#2c2928]">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAj2x-GJWP1fAOQLgR5hhbspv9dqGvoBVQczRleFaIBSe8xusM_Gq6KewJxugUbO8LP0YUu2ioxOa1A_GxU-HOmrVAnrQreA4CGnK8L9shU78Pu10KGs0M9Pooom6jJUOSZ96PTsIq_klDlj6tU4u63PKbiZJWcrA3sTJgb56q9aobCUdykA6ASuDOz9DK7NMmqZtoaew-BVP-AjqOlewjaabbAcva4guygBI50VJ_pOTw6C9ZjHaa0fg"
                    alt="Douro River Terraces"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#100e0d]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#100e0d]/90 text-[#e7e1df] backdrop-blur-md border border-white/[0.08]">
                      1/400s · f/4.0 · ISO 64
                    </span>
                  </div>
                </div>

                <div className="col-span-1 flex flex-col gap-2 h-64">
                  <div className="h-1/2 rounded-xl overflow-hidden relative shadow-inner bg-[#2c2928]">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuA2LomceWNQKyvvlhRf_2YiKRAwvXWvL4AgN5dX1KE9df-v0CiBfvFPEP_7NEn9nj4Uxlmikm71t5sfEOV3W9lb04xycrSouoxHC-WpIrjh9srJNU-kx6LIKxZuBMZX2wg2OMakiaKICXtniLkXrEw16Q37_R6yJDMwC5Jeuq0opRG73LDhsUGbjKIn3tSK-gTQP2nw1kJ4ErzujEuPTB94igiTIZw5fHAMEZCJChpMT1p5DBUtBiYFNQ"
                      alt="Rabelo Boat"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="h-1/2 rounded-xl overflow-hidden relative shadow-inner bg-[#2c2928]">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDRySQn_1NDbvA0Y3OICKDtvmy-pvyWAGKd88bg_2JnaOA0Sw1nN_42lCM9fW2gDz2kYzS6oA_nU2bqP5pqScwS0sHKZxOE0T_7sailZucP-DsUaMINtp0ksf2ygVFG6QlseL_nEhZk1kje1WOjnMzWxQoAUgdvdP8rAczQif-1dvPLgUkjatOcHjLK8lP8sAVw5j7T56U9oNA0xcnT1s0k0m5uP9N24AIBsPuXEEJy5kSNC8KmVVBQgg"
                      alt="Azulejo Tiles"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-[#100e0d]/70 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-xs font-mono text-[#e7e1df] font-medium">+80 more</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-1 z-10 border-t border-white/[0.04]">
                <div className="flex items-center gap-1.5 text-[#998f8a] text-[11px] font-mono">
                  <Sparkles size={13} className="text-[#c6c6c7]" />
                  <span>Compiled into 4K Spatial Slideshow</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveVideoModal('douro')}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#e7e1df] text-[#151312] hover:bg-[#c6c6c7] text-xs font-medium transition-all shadow-sm cursor-pointer"
                >
                  <PlayCircle size={15} />
                  <span>Relive Retrospective</span>
                </button>
              </div>
            </div>

            {/* Split Cards (5 Columns) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Card 2: 3 Years Ago */}
              <div className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between pb-1.5">
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#2c2928] text-[#d0c4be]">
                    3 Years Ago · Oct 24, 2021
                  </span>
                  <span className="text-[11px] font-mono text-[#998f8a]">42 Exposures</span>
                </div>
                <div className="flex gap-3.5 items-center py-1">
                  <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 shadow-inner bg-[#2c2928]">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNDILPhrlami04OEsCiQyqQCahCgBOvWkmbdybr8mm1zsccgfGsZ7xyt0VKrzGqvhmZ4nOyKKdLgtxOwBCwHl5MXw6UmeXlALUAyzC7PITvLYLhYfCLbeizeAeTHACvp9QeFNSy3tK3KiYPELjn_Wt35jVL_SiK62AOMjgq85byfwOZuoKAEkdlI-gC4f3JBcjb6XiUqw66OpUkK6mEgL4-17qdH2kV4POm_smA42smLZg-ne3bViUaQ"
                      alt="Ceramic Studio"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <h3 className="font-serif text-lg text-[#e7e1df] truncate group-hover:text-[#c6c6c7] transition-colors leading-tight">
                      Ceramic Studio & Artisan Workshops
                    </h3>
                    <p className="text-xs text-[#a8a29e] truncate">
                      Lisbon Studio · Leica M11 · 35mm Summilux ASPH
                    </p>
                    <span className="text-[10px] font-mono text-[#c6c6c7] mt-0.5">
                      f/1.4 · Natural Light
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#211f1e] hover:bg-[#2c2928] text-[#e7e1df] text-xs font-medium transition-all cursor-pointer border border-white/[0.04]"
                  >
                    <span>Inspect Memory</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Card 3: Seasonal Highlight */}
              <div className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[10px] font-mono text-[#d0c4be]">
                      Seasonal Highlight · Autumn Solstice
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#998f8a]">116 Exposures</span>
                </div>
                <div className="flex gap-3.5 items-center py-1">
                  <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 shadow-inner bg-[#2c2928]">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMvzAqHhIPe6-qakrlodjckH43q-WTcGBtDt4cpA8zrjqwecS0F_dL8sHPcwEeFzMRzSFdmojHJPYIzvAamgPhOam_KChbEOdlMrFljyQmHxjqJo3qu4tTeVi8CD8EmQuDtec3SdGLiR7D523yUZyjyOOmX6fy667ry_L-yK4P1JLdn5vuDwWYZoKEpnKi6kJmg4g2-EM9hSBqqNIxbJ5GYmMmAVbOMz6QDrZdwKMUMWfFBqIbMnBk2Q"
                      alt="Kyoto Arashiyama"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <h3 className="font-serif text-lg text-[#e7e1df] truncate group-hover:text-[#c6c6c7] transition-colors leading-tight">
                      Dappled Foliage & Mist in Arashiyama
                    </h3>
                    <p className="text-xs text-[#a8a29e] truncate">
                      Kyoto · Fujifilm GFX 100 II · GF 110mm f/2
                    </p>
                    <span className="text-[10px] font-mono text-[#c6c6c7] mt-0.5">
                      102MP Large Format
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#211f1e] hover:bg-[#2c2928] text-[#e7e1df] text-xs font-medium transition-all cursor-pointer border border-white/[0.04]"
                  >
                    <span>View Collection</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 3: High-Dimensional Topological Projections (Bento Grid) ── */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#998f8a]">
                High-Dimensional Topological Projections
              </span>
              <h2 className="font-serif text-xl md:text-2xl text-[#e7e1df] tracking-tight font-normal">
                Algorithmic Clusters & Semantic Landscapes
              </h2>
            </div>

            {/* Segmented Tab Switcher */}
            <div className="flex items-center p-1 rounded-full bg-[#100e0d] border border-white/[0.06]">
              {(
                [
                  { id: 'all', label: 'All Clusters (38)' },
                  { id: 'themes', label: 'Themes (18)' },
                  { id: 'trips', label: 'Trips (12)' },
                  { id: 'chronicles', label: 'Chronicles (8)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveClusterTab(tab.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    activeClusterTab === tab.id
                      ? 'bg-[#2c2928] text-[#e7e1df] shadow-sm'
                      : 'text-[#998f8a] hover:text-[#e7e1df]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Cluster 1: Brutalist Concrete & Sea Spray (Spans 2 cols on lg) */}
            <div className="lg:col-span-2 bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between shadow-sm relative group overflow-hidden">
              <div className="flex items-center justify-between pb-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-[10px] font-mono text-[#c6c6c7]">CLUSTER #0842 · SIMILARITY 98.4%</span>
                  </div>
                  <h3 className="font-serif text-2xl text-[#e7e1df] pt-0.5">
                    Brutalist Concrete & Sea Spray
                  </h3>
                </div>
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#2c2928] text-[#e7e1df] border border-white/[0.06]">
                  312 Assets
                </span>
              </div>

              {/* 4-Image Grid */}
              <div className="grid grid-cols-4 gap-2 my-2 h-44">
                <div className="h-full rounded-xl overflow-hidden shadow-inner bg-[#2c2928]">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkeg2cM59IsunWoU9NBX6f6KyfGVe-Zr-ZwRnNnRtb3YIsMcmzOTorz68Xco_hc_BXPJ4uZl_M3tL8c9mrqOrY16LqAISiFs_iwB9Fy8N0ai1hz3DB0prOqdMvjEfgLdXbL_BhJabmpeYb7xNq_JLL3Trr3j-s3jy2LIJ5cqfsAuP3886H9wLJhs4PRfISxmzt5RhYQHsGDovhIDUcRRaoq1DvlM3bCDsiS-3yayNc7-1cW7qRt3mqnA"
                    alt="Concrete pavilion"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="h-full rounded-xl overflow-hidden shadow-inner bg-[#2c2928]">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDK7dXLhWZacD8ZC1UP9l5OJdK7P2zc1PZbIQ8zGUE3nZnsm9cv_AjYb38EwPoBx_bXNM2lAJ6v6Lnof2C7ELbNhxXf8U2EP6vXwZ852r8cTVnF52iQQkV6Sr9la4TG7xiFpEbHI0GSBvclFHqjqNEqxYaQWH73SHzQRbpTf9Qbf64Vr4l5WZWR_Pm83UuoNAEZJqdRVEQige3CoCbFrNDONslrP6Iz4OMyI1v3THuGfBTbbCYnk2CXNg"
                    alt="Board-formed concrete"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="h-full rounded-xl overflow-hidden shadow-inner bg-[#2c2928]">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6wU213VJBy5guIUX7VotedOgkUOZ7JJiP39jZ11kuBuTj15WPjNDMf_mlhao77ck93hBotVscFZIPBYbXnIQ2mEBsNNj4AK1A-k1JftxxgUFeLmuphN_tb_eRt0LK3_XOXyz1taw0jOerTc_1lKcFCcxnX-ZT4r_lI4uIaCCCG5XetExDVcwjwKgnNim29cg70TUb_hfoWnyHSSM7_nUrPtfiCW6inaqQ36GPF1LsBHV230KJVOtTHA"
                    alt="Tidal pool"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="h-full rounded-xl overflow-hidden shadow-inner bg-[#2c2928]">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBRFDu4cbpYM_QYDl1fNOx8cdQy8QNHec-ECvhGOqytP8d9ObNjs5oqOyKeIfXItPM71ifSTNUNDuUcffCocGUac0o-QY7aqBZI2FmwqzjLniqIENCP7WVsefkNlpzGuLCoCVz7qgZiJcgRujmh5ZdeLeQcKYiXl6Hls0cNb8B2mTL30TtZsj_3UL1_Hw1GSl3oiwrIuvI3pz_ziCBaHGbCZTAbpQ3hkhf3laYeLArJPFQrfnET-yWLgA"
                    alt="Corrugated concrete wall"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>

              {/* Tag Chips & Vision Synthesis info */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/[0.04]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['#concrete', '#ocean', '#geometry', '#harsh-shadows'].map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#211f1e] text-[#d0c4be]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] font-mono text-[#998f8a] flex items-center gap-1">
                  <span>Synthesized by SAM-2 Vision Core</span>
                  <Zap size={12} className="text-amber-400" />
                </span>
              </div>
            </div>

            {/* Cluster 2: Analog Film Grain */}
            <div className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between shadow-sm relative group">
              <div className="flex items-center justify-between pb-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-[#c6c6c7]">CLUSTER #0319 · 184 ASSETS</span>
                  <h3 className="font-serif text-xl text-[#e7e1df] pt-0.5">
                    Analog Film Grain & Monochromes
                  </h3>
                </div>
                <Filter size={18} className="text-[#998f8a]" />
              </div>
              <div className="h-40 rounded-xl overflow-hidden my-2 relative shadow-inner bg-[#2c2928]">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA3C4MVbkMFNQcKrRTGotPnbAiot9sutvptTj4zRM8ZYtMJQ8712U9gnLrf4B7Ce6Nf7ifXA5XMFc_cM3ShNtMAuYh1FqU6YYJhjcsvcmAh66OK3FoGhfA3igiBfBrP8NmtcjpNfutrDpwr3ql_ARj3K1WGhBbio2JA7s3-N-pjfRfiMExrVcmuMlyCYdt_shI-X6tOd0ksguIVZ6u0vcECjtGLccfxQx2EquptEHR8A6hDMLG5rFBO7Q"
                  alt="Analog Film Grain"
                  className="w-full h-full object-cover grayscale transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-[#100e0d]/85 text-[#e7e1df] text-[10px] font-mono backdrop-blur-md border border-white/[0.06]">
                  Tri-X 400 & HP5+ Profiles
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-mono text-[#998f8a]">
                  Density: 0.94 · Contrast Ratio 16:1
                </span>
                <button
                  type="button"
                  className="w-7 h-7 rounded-full bg-[#211f1e] hover:bg-[#2c2928] flex items-center justify-center text-[#e7e1df] transition-colors cursor-pointer"
                >
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>

            {/* Cluster 3: Ceramics, Terracotta & Earth Tones */}
            <div className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between shadow-sm relative group">
              <div className="flex items-center justify-between pb-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-[#c6c6c7]">CLUSTER #0192 · 96 ASSETS</span>
                  <h3 className="font-serif text-xl text-[#e7e1df] pt-0.5">
                    Ceramics & Earth Tones
                  </h3>
                </div>
                <Palette size={18} className="text-[#998f8a]" />
              </div>
              <div className="h-32 rounded-xl overflow-hidden my-2 shadow-inner bg-[#2c2928]">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGiSizU5UUPwS81M8hfb_2jPRi8ePQzoo74M7tdqtNXoC95PjEsUrVQpSPaf9MBtRnzIZ1rnDJN4fXmQ57v84KOQpmOYjn_brj0wVF5NAfAYhaHsSjnDBDUdEGGbOlBq0XgWcMctWSIPvpLB1NNx5vUW90aJsCJX0Yu2j_qkuF-CRnOuP6Xvk3D4swFrGjpW2va6NFFu9aF87M3gXshlFhu3l9TatWJ689V9tRVC6Gc53yr9WgkR8Jkw"
                  alt="Ceramics"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              {/* Color Palette Extraction Bar */}
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[10px] font-mono text-[#998f8a]">Dominant Palette Signatures:</span>
                <div className="flex h-2.5 w-full rounded-full overflow-hidden shadow-inner border border-white/[0.06]">
                  <div className="bg-[#c2623e] flex-1" title="Terracotta #c2623e" />
                  <div className="bg-[#8b5a3e] flex-1" title="Raw Clay #8b5a3e" />
                  <div className="bg-[#d4a373] flex-1" title="Ochre #d4a373" />
                  <div className="bg-[#3e342f] flex-1" title="Umber #3e342f" />
                  <div className="bg-[#241f1c] flex-1" title="Charcoal #241f1c" />
                </div>
              </div>
            </div>

            {/* Cluster 4: Mist, Fog & Alpine Passes */}
            <div className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between shadow-sm relative group">
              <div className="flex items-center justify-between pb-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-[#c6c6c7]">CLUSTER #0611 · 142 ASSETS</span>
                  <h3 className="font-serif text-xl text-[#e7e1df] pt-0.5">
                    Mist, Fog & Alpine Passes
                  </h3>
                </div>
                <Cloud size={18} className="text-[#998f8a]" />
              </div>
              <div className="h-32 rounded-xl overflow-hidden my-2 shadow-inner bg-[#2c2928]">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSo8pSdkfzwe_udDeY5TsbKD-d4SKkf9S0t3GhqtkB-zFrsMTToTAAVaNIXEF-PYIqPbh-OqOqcNb7svCnBUxS6l0Nwf0eiQIHDjUdN6RLItMG6zVM8GGiSWV9Bzq4LYug8Uniq22PIQevq35orG69XiIuwjrNFV3pU2HAqCI_Qm6TtOGQudKnz_5DucSqx5UVoMJBvscfRlg5MtT5GaYyLKDEx9xfVWExZqISKQPFnDcx4WR6D_tl4w"
                  alt="Alpine Fog"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#a8a29e]">Madeira & Swiss Alps captures</span>
                <span className="text-[10px] font-mono text-[#998f8a]">EV -0.7 Avg</span>
              </div>
            </div>

            {/* Cluster 5: Lisbon to Porto Expedition */}
            <div className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between shadow-sm relative group">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-1.5">
                  <Compass size={16} className="text-[#c6c6c7]" />
                  <span className="text-[10px] font-mono text-[#c6c6c7] uppercase">Expedition #04</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#2c2928] text-[#e7e1df]">
                  620 RAW + 18 Clips
                </span>
              </div>
              <div>
                <h3 className="font-serif text-lg text-[#e7e1df]">Lisbon to Porto Coastal Corridor</h3>
                <p className="text-xs text-[#a8a29e] pt-0.5">
                  Oct 12 – 19 · 7 Days across Sintra, Nazaré & Douro
                </p>
              </div>
              <div className="h-32 rounded-xl overflow-hidden my-2 relative shadow-inner bg-[#2c2928]">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVFo2xj6D9UwLnT6FBpt2ZV_dk2FiuRNzpiJbvInAQT_1-veimALGVUFYp0u03WNK_Kl_XNlgT0aMFgaOgAQHhnsYBDVSqBdrZc9gw-0PQmboMXUw0u0MYggA4GqBNFQXXSJU8IqjKfilvwRsffcLMs47ROfUGSb8psadOJ_Jbr8hvQfstBn5VtjL3I0mViqfflxmt3Y4NU6bPpp9-f79zO2b0ci88bhXQc7k0tjeqVgla1yprXXI0vw"
                  alt="Coastal Corridor"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-[#100e0d]/30 flex items-center justify-center">
                  <div className="px-3 py-1 rounded-full bg-[#100e0d]/85 backdrop-blur-md flex items-center gap-1.5 shadow-sm border border-white/[0.08]">
                    <Route size={13} className="text-[#c6c6c7]" />
                    <span className="text-[10px] font-mono text-[#e7e1df]">342 km Geotagged</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-mono text-[#998f8a]">ProRes 422 HQ footage ready</span>
                <button
                  type="button"
                  className="text-[#e7e1df] hover:text-[#c6c6c7] transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer"
                >
                  <span>View Route</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4: Vision & OCR Portals & Video Montages ── */}
        <section className="flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column A: Auto-Classified Vision & OCR Portals (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScanLine size={18} className="text-[#c6c6c7]" />
                  <h2 className="font-serif text-xl text-[#e7e1df] tracking-tight font-normal">
                    Vision & OCR Portals
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-[#998f8a]">Auto-Categorized</span>
              </div>

              {/* 6 Quick Access Tiles */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { title: 'Monographs & Print Proofs', desc: 'CMYK ICC soft-proofs', count: '48 files', icon: '📖' },
                  { title: 'Digital Negatives', desc: '.DNG · .IIQ · .RAF lossless', count: '1,420 files', icon: '🎞️' },
                  { title: 'Reference Moodboards', desc: 'Extracted hex palettes', count: '82 files', icon: '🎨' },
                  { title: 'Archival Documents', desc: '115 receipts & certificates', count: 'OCR Indexed', icon: '📄', isOcr: true },
                  { title: 'Studio Whiteboards', desc: 'Perspective-corrected', count: '34 files', icon: '📐' },
                  { title: 'UI Research & Typography', desc: 'Vector text extracted', count: '210 files', icon: '🖥️' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-[#1d1b1a] hover:bg-[#211f1e] border border-white/[0.05] hover:border-white/[0.1] p-3 rounded-xl flex flex-col justify-between transition-all cursor-pointer shadow-sm group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-full bg-[#2c2928] flex items-center justify-center text-sm group-hover:bg-[#c6c6c7] group-hover:text-[#2f3131] transition-all">
                        {item.icon}
                      </div>
                      <span className={`text-[10px] font-mono ${item.isOcr ? 'text-[#86efac]' : 'text-[#998f8a]'}`}>
                        {item.count}
                      </span>
                    </div>
                    <div className="pt-3">
                      <h4 className="text-xs font-medium text-[#e7e1df] leading-snug group-hover:text-[#c6c6c7] transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[10px] font-mono text-[#998f8a] pt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column B: Curated Highlight Projects & Video Montages (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film size={18} className="text-[#c6c6c7]" />
                  <h2 className="font-serif text-xl text-[#e7e1df] tracking-tight font-normal">
                    Curated Highlight Projects & Video Montages
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-[#998f8a]">Hardware Accelerated 60fps</span>
              </div>

              {/* Montage Cards */}
              <div className="flex flex-col gap-3">
                {/* Montage 1 */}
                <div className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-4 flex flex-col md:flex-row gap-4 shadow-sm group">
                  <div className="w-full md:w-56 h-36 rounded-xl overflow-hidden relative shrink-0 shadow-inner bg-[#2c2928]">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnORYI39ewApWZ6eyHXjXokTBp7KOBEjItMomZAfy5RKdvhHKi4RDapF9_dYQUIaf0pZ5BC-N4ThTMDas4S6V6oYrmbHwQnV2pMwQyBmcq4srSaubXXwSWBThriRhlh_BxcWf3QrBIydZO9R1T4H1FvPH2R-OKGeMIQMb-M6nMaYpV2iXDmJg9G5355VTHQzRtOOVL0Kty6ANQAlVQCRstrq8QImkEnIFd_KlqLRu4-AsoO0i3TfJehg"
                      alt="Montage 1"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-[#100e0d]/80 text-[#e7e1df] text-[10px] font-mono backdrop-blur-md border border-white/[0.06]">
                      02:45 · 4K ProRes
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveVideoModal('iberia')}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#100e0d]/70 backdrop-blur-md flex items-center justify-center text-[#e7e1df] hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Play size={13} className="ml-0.5 fill-current" />
                    </button>
                  </div>

                  <div className="flex flex-col justify-between flex-1 min-w-0">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#c6c6c7]">AUTOMATED ASSEMBLY</span>
                        <span className="text-[10px] font-mono text-[#998f8a]">32 Selected Cuts</span>
                      </div>
                      <h3 className="font-serif text-lg text-[#e7e1df] leading-tight">
                        Atmospheric Iberia: 3-Year 4K Retrospective
                      </h3>
                      <p className="text-xs text-[#a8a29e] line-clamp-2">
                        Harmonized tempo synced to ambient score. Includes dynamic color grading and high dynamic range tonemapping.
                      </p>
                    </div>

                    {/* Interactive Scrub Bar Visualizer */}
                    <div className="pt-2 flex flex-col gap-1.5">
                      <div
                        className="w-full h-1.5 rounded-full bg-[#2c2928] overflow-hidden flex cursor-pointer relative"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                          setActiveScrubPercent(pct);
                        }}
                      >
                        <div
                          className="h-full bg-[#c6c6c7] transition-all"
                          style={{ width: `${activeScrubPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#998f8a]">01:06 / 02:45</span>
                        <button
                          type="button"
                          onClick={() => setActiveVideoModal('iberia')}
                          className="flex items-center gap-1 text-xs font-medium text-[#e7e1df] hover:text-[#c6c6c7] transition-colors cursor-pointer"
                        >
                          <PlayCircle size={14} />
                          <span>Play Montage</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Montage 2 */}
                <div className="bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-4 flex flex-col md:flex-row gap-4 shadow-sm group">
                  <div className="w-full md:w-56 h-32 rounded-xl overflow-hidden relative shrink-0 shadow-inner bg-[#2c2928]">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuARQg8mClgHhR_d3d_jXExFUI9pTGvhOTx74ZsQRh8nOHRdFy40ilzgK8-Wnr4BIPrin_VKpIw6xJFVRAkQBEUywWg0vg-SFVj64AqnGDfdnv7-b8LwomAHB2SB1lHQlLq3GHRISslZGLCTa4I64usx73ee-KUMJrRep8yDplhXdLr3yP6Myg5nkfepNt30mUGEThh6A7g076clnAd8mvQFM5sNPFCwDhgYzm57tYi7oxmNwvTg0cuusA"
                      alt="Montage 2"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-[#100e0d]/80 text-[#e7e1df] text-[10px] font-mono backdrop-blur-md border border-white/[0.06]">
                      01:15 · 60fps
                    </div>
                  </div>

                  <div className="flex flex-col justify-between flex-1 min-w-0">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#c6c6c7]">DYNAMIC REEL</span>
                        <span className="text-[10px] font-mono text-[#998f8a]">9:16 Vertical Portrait</span>
                      </div>
                      <h3 className="font-serif text-lg text-[#e7e1df] leading-tight">
                        Architectural Shadows: Dynamic Reel
                      </h3>
                      <p className="text-xs text-[#a8a29e] truncate">
                        Precision light shifts captured in Barcelona and Porto.
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[10px] font-mono text-[#998f8a]">ProRes 422 Ready</span>
                      <button
                        type="button"
                        className="px-3 py-1 rounded-full bg-[#211f1e] hover:bg-[#2c2928] text-[#e7e1df] text-xs font-medium transition-colors flex items-center gap-1 border border-white/[0.04] cursor-pointer"
                      >
                        <Download size={13} />
                        <span>Export Reel</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 5: Archival Library Analytics & Camera Telemetry ── */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#998f8a]">
                METRICS://EXIF_DISTRIBUTION
              </span>
              <h2 className="font-serif text-xl md:text-2xl text-[#e7e1df] tracking-tight font-normal">
                Archival Library Analytics & Camera Telemetry
              </h2>
            </div>

            {/* Timeframe Toggle */}
            <div className="flex items-center p-1 rounded-full bg-[#100e0d] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setActiveTimeframe('12m')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  activeTimeframe === '12m'
                    ? 'bg-[#2c2928] text-[#e7e1df] shadow-sm'
                    : 'text-[#998f8a] hover:text-[#e7e1df]'
                }`}
              >
                Past 12 Months
              </button>
              <button
                type="button"
                onClick={() => setActiveTimeframe('all')}
                className={`px-3 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                  activeTimeframe === 'all'
                    ? 'bg-[#2c2928] text-[#e7e1df] shadow-sm'
                    : 'text-[#998f8a] hover:text-[#e7e1df]'
                }`}
              >
                All Time (24,810 Assets)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Panel: Exposure Activity Density Heat Map (7 Cols) */}
            <div className="lg:col-span-7 bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between pb-4">
                <div>
                  <h3 className="font-serif text-lg text-[#e7e1df]">Visual Capture Activity Density</h3>
                  <p className="text-xs text-[#a8a29e]">
                    Daily exposure distribution across all synchronized local drives
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-[#998f8a]">
                  <span>Less</span>
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#2c2928]" />
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#484745]" />
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#c9c6c4]" />
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                  <span>More</span>
                </div>
              </div>

              {/* Heatmap Matrix Grid (28 columns x 7 rows) */}
              <div className="overflow-x-auto pb-2 scrollbar-none">
                <div className="min-w-[580px] flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] font-mono text-[#998f8a] px-1">
                    <span>Nov 23</span>
                    <span>Jan 24</span>
                    <span>Mar 24</span>
                    <span>May 24</span>
                    <span>Jul 24</span>
                    <span>Sep 24</span>
                    <span>Oct 24</span>
                  </div>

                  <div className="grid grid-rows-7 gap-1">
                    {[
                      [0, 1, 0, 2, 3, 2, 0, 1, 2, 0, 0, 1, 2, 3, 2, 0, 1, 0, 2, 0, 1, 0, 3, 2, 0, 1, 2, 0],
                      [0, 0, 1, 2, 2, 3, 0, 1, 0, 2, 0, 0, 1, 2, 3, 2, 0, 1, 0, 0, 2, 1, 3, 3, 2, 0, 1, 2],
                      [1, 0, 0, 2, 3, 0, 0, 2, 1, 0, 2, 3, 3, 2, 1, 0, 0, 1, 2, 0, 0, 1, 2, 3, 2, 0, 1, 0],
                      [0, 1, 2, 3, 2, 1, 0, 2, 0, 1, 0, 2, 3, 3, 2, 0, 1, 0, 2, 0, 1, 0, 3, 2, 1, 0, 2, 0],
                      [1, 0, 0, 2, 3, 2, 0, 2, 1, 0, 0, 1, 2, 3, 2, 0, 1, 0, 2, 0, 2, 0, 3, 2, 0, 1, 2, 0],
                      [0, 1, 2, 0, 3, 2, 0, 2, 0, 0, 1, 2, 3, 2, 0, 1, 0, 2, 0, 1, 2, 3, 3, 2, 0, 1, 2, 0],
                      [1, 0, 0, 2, 2, 0, 2, 1, 0, 2, 1, 0, 3, 2, 0, 1, 0, 2, 0, 1, 2, 0, 3, 2, 0, 1, 2, 0],
                    ].map((row, rIdx) => (
                      <div key={rIdx} className="flex gap-1">
                        {row.map((val, cIdx) => {
                          const bg =
                            val === 3
                              ? 'bg-amber-400'
                              : val === 2
                              ? 'bg-[#c9c6c4]'
                              : val === 1
                              ? 'bg-[#484745]'
                              : 'bg-[#211f1e]';
                          return <div key={cIdx} className={`w-3.5 h-3 rounded-sm ${bg}`} />;
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Activity Peaks */}
              <div className="pt-3 flex flex-wrap items-center gap-4 border-t border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-xs text-[#e7e1df]">
                    Oct 2023: <strong className="font-semibold">+1,240 exposures</strong> (Portugal Expedition)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#c9c6c4]" />
                  <span className="text-xs text-[#e7e1df]">
                    May 2024: <strong className="font-semibold">+980 exposures</strong> (Japan Monograph)
                  </span>
                </div>
              </div>
            </div>

            {/* Right Panel: Optics & Sensor Telemetry (5 Cols) */}
            <div className="lg:col-span-5 bg-[#1d1b1a] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between pb-2">
                <h3 className="font-serif text-lg text-[#e7e1df]">Most Used Glass & Optical Sensors</h3>
                <span className="text-[10px] font-mono text-[#998f8a]">EXIF Verified</span>
              </div>

              {/* Optics Distribution Bars */}
              <div className="flex flex-col gap-2.5 my-1">
                {[
                  { name: 'Hasselblad XCD 55mm f/2.5 V', pct: 42, exp: '10,420 exp', color: 'bg-[#c6c6c7]' },
                  { name: 'Leica Summilux-M 35mm f/1.4 ASPH', pct: 28, exp: '6,946 exp', color: 'bg-[#c6c6c7]' },
                  { name: 'Fujinon GF 110mm f/2 R LM WR', pct: 18, exp: '4,465 exp', color: 'bg-[#c9c6c4]' },
                  { name: 'Other Prime & Specialty Optics', pct: 12, exp: '2,979 exp', color: 'bg-[#484745]' },
                ].map((lens, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#e7e1df] truncate">{lens.name}</span>
                      <span className="font-mono text-[#c9c6c4] text-[11px]">{lens.pct}% · {lens.exp}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#2c2928] overflow-hidden">
                      <div className={`h-full rounded-full ${lens.color}`} style={{ width: `${lens.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Aperture & ISO Telemetry Badges */}
              <div className="pt-3 grid grid-cols-2 gap-3 border-t border-white/[0.04]">
                <div className="p-2.5 rounded-xl bg-[#211f1e] flex flex-col gap-0.5 border border-white/[0.04]">
                  <span className="text-[10px] font-mono text-[#998f8a]">Dominant Aperture</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-serif text-[#e7e1df]">f/2.8</span>
                    <span className="text-[11px] font-mono text-[#c9c6c4]">38% ratio</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#7d7e7f]">f/1.4 (26%) · f/5.6 (21%)</span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#211f1e] flex flex-col gap-0.5 border border-white/[0.04]">
                  <span className="text-[10px] font-mono text-[#998f8a]">Dynamic Range Optimization</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-serif text-[#e7e1df]">82%</span>
                    <span className="text-[11px] font-mono text-[#86efac]">Base ISO</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#7d7e7f]">ISO 64/100 native sensor floor</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Section 6: Interactive Subject Sandbox Floating Dock (Bottom-Right) ── */}
      {isSandboxVisible && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm w-full bg-[#211f1e]/95 backdrop-blur-2xl rounded-2xl p-4 shadow-2xl border border-white/[0.1] transition-all duration-300">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#100e0d] text-[#c9c6c4] border border-white/[0.06]">
              <Sparkles size={12} className="text-amber-300" />
              <span className="text-[10px] font-mono font-medium">Interactive Subject Sandbox</span>
            </div>
            <button
              type="button"
              onClick={() => setIsSandboxVisible(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[#998f8a] hover:text-[#e7e1df] hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="pt-1">
            <h3 className="font-serif text-base text-[#e7e1df]">Segment & Extract Subjects</h3>
            <p className="text-[11px] text-[#a8a29e] leading-snug pt-0.5">
              Click any recurring entity to isolate masks with client-side WebGPU SAM-2 neural model.
            </p>
          </div>

          {/* Detected Subjects Grid */}
          <div className="grid grid-cols-2 gap-2 py-3">
            {[
              { label: 'Artisan', icon: '👤', count: '84 occurrences' },
              { label: 'Ceramics', icon: '🏺', count: '142 occurrences' },
              { label: 'Espresso Cup', icon: '☕', count: '68 occurrences' },
              { label: 'Bonsai / Moss', icon: '🌿', count: '52 occurrences' },
            ].map((subject, idx) => (
              <button
                key={idx}
                type="button"
                className="flex items-center gap-2 p-1.5 rounded-xl bg-[#1d1b1a] hover:bg-[#2c2928] border border-white/[0.04] transition-colors text-left group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-[#100e0d] flex items-center justify-center text-xs shadow-inner">
                  {subject.icon}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-[#e7e1df] truncate group-hover:text-[#c6c6c7] transition-colors font-medium">
                    {subject.label}
                  </span>
                  <span className="text-[9px] font-mono text-[#998f8a] truncate">{subject.count}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => alert('Isolation canvas ready: WebGPU SAM-2 weights loaded.')}
              className="flex-1 py-1.5 rounded-full bg-[#e7e1df] text-[#151312] hover:bg-[#c6c6c7] text-xs font-medium text-center transition-all shadow-sm cursor-pointer"
            >
              Open Isolation Canvas
            </button>
            <button
              type="button"
              className="p-1.5 rounded-full bg-[#1d1b1a] hover:bg-[#2c2928] text-[#e7e1df] border border-white/[0.06] transition-colors cursor-pointer"
              title="Export Cutouts PNG/SVG"
            >
              <Download size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Video Reel Playback Modal ── */}
      {activeVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6">
          <div className="relative w-full max-w-3xl rounded-2xl bg-[#151312] border border-white/[0.15] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setActiveVideoModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            >
              <X size={18} />
            </button>
            <h3 className="text-2xl font-serif text-[#e7e1df] mb-1">
              {activeVideoModal === 'douro'
                ? 'Autumn Light along Douro River Terraces'
                : 'Atmospheric Iberia: 3-Year 4K Retrospective'}
            </h3>
            <p className="text-xs text-[#a8a29e] mb-4 font-mono">
              Spatial 4K Slideshow · Ambient audio harmonization
            </p>
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black relative flex items-center justify-center border border-white/10 shadow-inner">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnORYI39ewApWZ6eyHXjXokTBp7KOBEjItMomZAfy5RKdvhHKi4RDapF9_dYQUIaf0pZ5BC-N4ThTMDas4S6V6oYrmbHwQnV2pMwQyBmcq4srSaubXXwSWBThriRhlh_BxcWf3QrBIydZO9R1T4H1FvPH2R-OKGeMIQMb-M6nMaYpV2iXDmJg9G5355VTHQzRtOOVL0Kty6ANQAlVQCRstrq8QImkEnIFd_KlqLRu4-AsoO0i3TfJehg"
                alt="Playback frame"
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-[#151312]/80 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-xl">
                  <Play size={24} className="ml-1 fill-white" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveVideoModal(null)}
                className="px-4 py-2 rounded-full bg-[#2c2928] text-xs font-medium text-[#e7e1df] hover:bg-[#373433] cursor-pointer"
              >
                Close Reel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
