import React from 'react';
import { Play, Pause, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';

export interface StageProgressInfo {
  processed: number;
  total: number;
  progress: number;
  is_processing: boolean;
}

interface StageConfig {
  id: string;
  backendKey: 'thumbnail' | 'face' | 'clip' | 'ocr';
  name: string;
  subtext: string;
  color: string;
}

const PIPELINE_STAGES: StageConfig[] = [
  {
    id: 'thumbnail',
    backendKey: 'thumbnail',
    name: 'Thumbnail Pyramids',
    subtext: 'WebP High-Q pyramid preview cache for instant gallery grid rendering',
    color: '#38bdf8',
  },
  {
    id: 'face',
    backendKey: 'face',
    name: 'Face Recognition (ArcFace)',
    subtext: 'ArcFace 512-dimensional facial feature embeddings & DBSCAN clustering',
    color: '#c084fc',
  },
  {
    id: 'embedding',
    backendKey: 'clip',
    name: 'Semantic AI Vectors (SigLIP-2)',
    subtext: 'SigLIP-2 vision-language embeddings for natural language search queries',
    color: '#10b981',
  },
  {
    id: 'ocr',
    backendKey: 'ocr',
    name: 'OCR Document Text Scanner',
    subtext: 'Optical character recognition indexed into SQLite FTS5 search table',
    color: '#f59e0b',
  },
];

interface PipelineStagesCardProps {
  pausedStages: string[];
  onToggleStage: (stageId: string) => void;
  stagesProgress?: {
    thumbnail?: StageProgressInfo;
    clip?: StageProgressInfo;
    face?: StageProgressInfo;
    ocr?: StageProgressInfo;
    gemma?: StageProgressInfo;
  };
}

export const PipelineStagesCard: React.FC<PipelineStagesCardProps> = ({
  pausedStages,
  onToggleStage,
  stagesProgress,
}) => {
  const isPaused = (stageId: string) =>
    pausedStages.some((s) => s.toLowerCase() === stageId.toLowerCase());

  return (
    <div className="bg-[#151312] border border-[#211f1e] hover:border-white/10 rounded-2xl p-6 transition-all shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#998f8a]">Engine Workers</span>
              <span className="text-[#4d4541] text-[10px]">•</span>
              <h2 className="font-serif text-lg text-[#f5f0ed] tracking-tight">Background Pipeline Stages</h2>
            </div>
            <p className="text-xs text-[#a8a29e] mt-0.5">Individual worker thread orchestration &amp; indexing status</p>
          </div>
          <span className="font-mono text-[10px] text-[#998f8a] bg-[#1d1b1a] px-2.5 py-1 rounded-full border border-white/5">
            4 Concurrency Workers
          </span>
        </div>

        <div className="space-y-3">
          {PIPELINE_STAGES.map((st) => {
            const paused = isPaused(st.id);
            const progressInfo = stagesProgress ? stagesProgress[st.backendKey] : undefined;
            const progressPct = progressInfo ? Math.min(100, Math.max(0, progressInfo.progress)) : 0;
            const processed = progressInfo ? progressInfo.processed : 0;
            const total = progressInfo ? progressInfo.total : 0;
            const isProcessing = progressInfo?.is_processing && !paused;

            return (
              <div
                key={st.id}
                className="p-4 rounded-xl bg-[#1d1b1a] border border-white/5 hover:border-white/10 transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#f5f0ed]">{st.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono border ${
                          paused
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : isProcessing
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {paused ? 'PAUSED' : isProcessing ? 'ACTIVE' : 'IDLE'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#78716c] truncate mt-0.5">{st.subtext}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleStage(st.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all flex items-center gap-1.5 shrink-0 ${
                      paused
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                    }`}
                  >
                    {paused ? (
                      <>
                        <Play size={10} />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause size={10} />
                        <span>Pause</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Progress Metric Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#78716c]">
                    <span>
                      {total > 0
                        ? `${processed.toLocaleString()} / ${total.toLocaleString()} processed`
                        : isProcessing
                          ? 'Streaming media queue...'
                          : 'Idle / Ready'}
                    </span>
                    <span className="text-[#a8a29e]">{progressPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#100e0d] rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progressPct}%`,
                        backgroundColor: st.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
