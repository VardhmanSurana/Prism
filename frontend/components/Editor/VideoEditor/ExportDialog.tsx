import React, { useState, useCallback, useEffect } from 'react';
import { useNLEStore } from '@/store/nleStore';
import { API_BASE } from '@/constants';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isWebCodecsSupported, exportVideoWithWebCodecs } from '@/lib/webcodecsExporter';
import { useTelemetry } from '@/hooks/useTelemetry';
import { X, Download, Zap, Cpu, Check } from 'lucide-react';

interface ExportDialogProps {
  onClose: () => void;
}

const EXPORT_PRESETS = [
  { name: 'YouTube 1080p', w: 1920, h: 1080, fps: 30, quality: 'high' as const },
  { name: 'YouTube 4K', w: 3840, h: 2160, fps: 30, quality: 'high' as const },
  { name: 'Instagram Reel', w: 1080, h: 1920, fps: 30, quality: 'high' as const },
  { name: 'TikTok', w: 1080, h: 1920, fps: 30, quality: 'high' as const },
  { name: 'Twitter', w: 1280, h: 720, fps: 30, quality: 'medium' as const },
  { name: 'Custom', w: 0, h: 0, fps: 0, quality: 'high' as const },
] as const;

/**
 * ExportDialog - Renders export dialog.
 */
export const ExportDialog: React.FC<ExportDialogProps> = ({ onClose }) => {
  /**
   * toProjectJson - Performs to project json.
   */
  const toProjectJson = useNLEStore((s) => s.toProjectJson);
  /**
   * projectWidth - Performs project width.
   */
  const projectWidth = useNLEStore((s) => s.projectWidth);
  /**
   * projectHeight - Performs project height.
   */
  const projectHeight = useNLEStore((s) => s.projectHeight);
  /**
   * projectFps - Performs project fps.
   */
  const projectFps = useNLEStore((s) => s.projectFps);
  /**
   * duration - Performs duration.
   */
  const duration = useNLEStore((s) => s.duration);
  /**
   * seek - Performs seek.
   */
  const seek = useNLEStore((s) => s.seek);
  const [resolution, setResolution] = useState<[number, number]>([projectWidth, projectHeight]);
  const [fps, setFps] = useState(projectFps);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [activePreset, setActivePreset] = useState<string>('Custom');
  const [exportEngine, setExportEngine] = useState<'webcodecs' | 'melt'>(
    isWebCodecsSupported() ? 'webcodecs' : 'melt'
  );
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Revoke ObjectURL on unmount or when replaced
  useEffect(() => {
    return () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); };
  }, [downloadUrl]);

  const { logAction, logError } = useTelemetry();

  /**
   * applyPreset - Performs apply preset.
   */
  const applyPreset = (preset: typeof EXPORT_PRESETS[number]) => {
    setActivePreset(preset.name);
    if (preset.name === 'Custom') return;
    setResolution([preset.w, preset.h]);
    setFps(preset.fps);
    setQuality(preset.quality);
  };

  /**
   * handleExport - Handles export.
   */
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setDownloadUrl(null);
    logAction('VideoEditor', 'export_start', { engine: exportEngine, resolution, fps, quality });

    try {
      // 1. Hardware WebCodecs Export Engine
      if (exportEngine === 'webcodecs') {
        setProgress('Initializing GPU WebCodecs VideoEncoder...');
        setProgressPercent(0);

        const totalDuration = duration || 5;

        const blob = await exportVideoWithWebCodecs({
          width: resolution[0],
          height: resolution[1],
          fps,
          duration: totalDuration,
          quality,
          renderFrameAtTime: async (tSec) => {
            seek(tSec);
            // ponytail: rAF yields to the render pipeline; setTimeout(16) didn't
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            return (
              (document.querySelector('canvas[data-nle-preview-canvas]') as HTMLCanvasElement) ||
              (document.querySelector('canvas') as HTMLCanvasElement) ||
              undefined
            );
          },
          onProgress: (pct, currentFrame, totalFrames) => {
            setProgressPercent(pct);
            setProgress(`Encoding frame ${currentFrame} of ${totalFrames} (${pct}%)`);
          },
        });

        const url = URL.createObjectURL(blob);
        // Revoke previous URL if any before setting new one
        setDownloadUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
        setProgress(`Hardware export completed successfully!\nReady for download or save.`);
        logAction('VideoEditor', 'export_success', { engine: 'webcodecs', resolution, fps });
        return;
      }

      // 2. Local Melt Renderer Fallback Engine
      setProgress('Selecting export path...');

      const filePath = await save({
        title: 'Save Exported Video',
        filters: [{ name: 'Video', extensions: ['mp4'] }],
        defaultPath: 'prism_export.mp4',
      });

      if (!filePath) {
        setIsExporting(false);
        setProgress(null);
        return;
      }

      setProgress('Generating project XML...');

      const body = {
        project_json: toProjectJson(),
        resolution,
        fps,
        quality,
      };

      const res = await fetch(`${API_BASE}/api/v1/nle/export/xml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to compile MLT XML');
      }

      const { xml } = await res.json();

      setProgress('Rendering video locally...');
      setProgressPercent(0);

      /**
       * unlisten - Performs unlisten.
       */
      const unlisten = await listen<number>('nle-export-progress', (event) => {
        setProgressPercent(Math.round(event.payload * 100));
      });

      try {
        await invoke<string>('nle_export_local', {
          mltXml: xml,
          outputPath: filePath,
          width: resolution[0],
          height: resolution[1],
          fps,
          quality,
        });

        setProgress(`Export completed successfully!\nSaved to: ${filePath}`);
        setProgressPercent(100);
        logAction('VideoEditor', 'export_success', { engine: 'melt', resolution, fps, filePath });
      } finally {
        unlisten();
      }
    } catch (e) {
      logError('VideoEditor', 'export_failed', e, { engine: exportEngine, resolution, fps });
      setProgress(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  }, [exportEngine, duration, resolution, fps, quality, seek, toProjectJson, logAction, logError]);

  return (
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#1d1b1a] rounded-xl border border-white/10 w-[460px] max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#171615]">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[#f5f0ed] font-medium text-sm">Export Video</h3>
            {isWebCodecsSupported() && (
              <span className="text-[10px] bg-[#e5a93c]/15 text-[#e5a93c] border border-[#e5a93c]/30 px-2 py-0.5 rounded-full font-medium">
                GPU WebCodecs Active
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 rounded-md hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Export Engine Selection */}
          <div>
            <label className="text-zinc-400 text-xs block mb-1.5 font-medium">Rendering Engine</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setExportEngine('webcodecs')}
                disabled={!isWebCodecsSupported()}
                className={`px-3 py-2 text-xs rounded-lg border text-left flex flex-col gap-0.5 transition-colors cursor-pointer ${
                  exportEngine === 'webcodecs'
                    ? 'bg-[#e5a93c] text-[#151312] border-[#e5a93c] font-semibold shadow-sm'
                    : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-40'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="font-semibold">Hardware WebCodecs</span>
                </div>
                <span className={`text-[10px] ${exportEngine === 'webcodecs' ? 'text-[#151312]/80' : 'text-zinc-400'}`}>GPU-accelerated H.264</span>
              </button>
              <button
                onClick={() => setExportEngine('melt')}
                className={`px-3 py-2 text-xs rounded-lg border text-left flex flex-col gap-0.5 transition-colors cursor-pointer ${
                  exportEngine === 'melt'
                    ? 'bg-[#e5a93c] text-[#151312] border-[#e5a93c] font-semibold shadow-sm'
                    : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-white/20 hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span className="font-semibold">Melt CLI / Server</span>
                </div>
                <span className={`text-[10px] ${exportEngine === 'melt' ? 'text-[#151312]/80' : 'text-zinc-400'}`}>Local MLT renderer</span>
              </button>
            </div>
          </div>

          {/* Presets */}
          <div>
            <label className="text-zinc-400 text-xs block mb-1.5 font-medium">Preset</label>
            <div className="flex flex-wrap gap-1.5">
              {EXPORT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors cursor-pointer ${
                    activePreset === preset.name
                      ? 'bg-[#e5a93c] text-[#151312] border-[#e5a93c] font-semibold shadow-sm'
                      : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-white/20 hover:bg-white/[0.08]'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div>
            <label className="text-zinc-400 text-xs block mb-1.5 font-medium">Resolution</label>
            <div className="flex gap-2">
              {([
                [1920, 1080, '1080p'],
                [1280, 720, '720p'],
                [3840, 2160, '4K'],
              ] as [number, number, string][]).map(([w, h, label]) => (
                <button
                  key={label}
                  onClick={() => setResolution([w, h])}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                    resolution[0] === w && resolution[1] === h
                      ? 'bg-[#e5a93c] text-[#151312] border-[#e5a93c] font-semibold shadow-sm'
                      : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-white/20 hover:bg-white/[0.08]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* FPS */}
          <div>
            <label className="text-zinc-400 text-xs block mb-1.5 font-medium">Frame Rate</label>
            <div className="flex gap-2">
              {[24, 30, 60].map((f) => (
                <button
                  key={f}
                  onClick={() => setFps(f)}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                    fps === f
                      ? 'bg-[#e5a93c] text-[#151312] border-[#e5a93c] font-semibold shadow-sm'
                      : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-white/20 hover:bg-white/[0.08]'
                  }`}
                >
                  {f}fps
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <label className="text-zinc-400 text-xs block mb-1.5 font-medium">Quality</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`px-3 py-1 text-xs rounded-md border capitalize transition-colors cursor-pointer ${
                    quality === q
                      ? 'bg-[#e5a93c] text-[#151312] border-[#e5a93c] font-semibold shadow-sm'
                      : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-white/20 hover:bg-white/[0.08]'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Status / Progress */}
          {progress && (
            <div className="space-y-2 pt-1">
              <div className="text-zinc-400 text-xs text-center whitespace-pre-wrap break-all font-mono">{progress}</div>
              {isExporting && (
                <div className="w-full">
                  <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                    <span>Progress</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-[#e5a93c] rounded-full transition-all duration-200 shadow-[0_0_8px_rgba(229,169,60,0.5)]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {downloadUrl && (
            <div className="pt-2 space-y-2">
              <a
                href={downloadUrl}
                download="prism_webcodecs_export.mp4"
                className="flex items-center justify-center gap-2 bg-[#e5a93c] hover:bg-[#d4982b] text-[#151312] py-2.5 rounded-lg text-xs font-semibold shadow-lg shadow-[#e5a93c]/20 transition-colors"
              >
                <Download className="w-4 h-4" /> Download Exported MP4 Video
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-white/10 bg-[#171615]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-1.5 text-xs bg-[#e5a93c] hover:bg-[#d4982b] text-[#151312] rounded-lg disabled:opacity-50 font-semibold transition-colors cursor-pointer shadow-sm"
          >
            {isExporting ? 'Exporting...' : 'Start Export'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
