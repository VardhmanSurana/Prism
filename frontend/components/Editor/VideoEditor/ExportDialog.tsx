import React, { useState, useCallback } from 'react';
import { useNLEStore } from '@/store/nleStore';
import { API_BASE } from '@/constants';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isWebCodecsSupported, exportVideoWithWebCodecs } from '@/lib/webcodecsExporter';

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

export const ExportDialog: React.FC<ExportDialogProps> = ({ onClose }) => {
  const { toProjectJson, projectWidth, projectHeight, projectFps, duration, seek } = useNLEStore();
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

  const applyPreset = (preset: typeof EXPORT_PRESETS[number]) => {
    setActivePreset(preset.name);
    if (preset.name === 'Custom') return;
    setResolution([preset.w, preset.h]);
    setFps(preset.fps);
    setQuality(preset.quality);
  };

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setDownloadUrl(null);

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
            await new Promise((r) => setTimeout(r, 16));
            return (document.querySelector('canvas') as HTMLCanvasElement) || undefined;
          },
          onProgress: (pct, currentFrame, totalFrames) => {
            setProgressPercent(pct);
            setProgress(`Encoding frame ${currentFrame} of ${totalFrames} (${pct}%)`);
          },
        });

        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setProgress(`Hardware export completed successfully!\nReady for download or save.`);
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
      } finally {
        unlisten();
      }
    } catch (e) {
      setProgress(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  }, [exportEngine, duration, resolution, fps, quality, seek, toProjectJson]);

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-lg border border-zinc-800 w-[440px] max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium">Export Video</h3>
            {isWebCodecsSupported() && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                GPU WebCodecs Active
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Export Engine Selection */}
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Rendering Engine</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setExportEngine('webcodecs')}
                disabled={!isWebCodecsSupported()}
                className={`px-3 py-1.5 text-xs rounded border text-left flex flex-col ${
                  exportEngine === 'webcodecs'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 disabled:opacity-40'
                }`}
              >
                <span className="font-semibold">⚡ Hardware WebCodecs</span>
                <span className="text-[10px] opacity-80">GPU-accelerated H.264</span>
              </button>
              <button
                onClick={() => setExportEngine('melt')}
                className={`px-3 py-1.5 text-xs rounded border text-left flex flex-col ${
                  exportEngine === 'melt'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <span className="font-semibold">⚙️ Melt CLI / Server</span>
                <span className="text-[10px] opacity-80">Local MLT renderer</span>
              </button>
            </div>
          </div>

          {/* Presets */}
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Preset</label>
            <div className="flex flex-wrap gap-1.5">
              {EXPORT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className={`px-2 py-1 text-[11px] rounded border ${
                    activePreset === preset.name
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Resolution</label>
            <div className="flex gap-2">
              {([
                [1920, 1080, '1080p'],
                [1280, 720, '720p'],
                [3840, 2160, '4K'],
              ] as [number, number, string][]).map(([w, h, label]) => (
                <button
                  key={label}
                  onClick={() => setResolution([w, h])}
                  className={`px-3 py-1 text-xs rounded border ${
                    resolution[0] === w && resolution[1] === h
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* FPS */}
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Frame Rate</label>
            <div className="flex gap-2">
              {[24, 30, 60].map((f) => (
                <button
                  key={f}
                  onClick={() => setFps(f)}
                  className={`px-3 py-1 text-xs rounded border ${
                    fps === f
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {f}fps
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Quality</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`px-3 py-1 text-xs rounded border capitalize ${
                    quality === q
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Status / Progress */}
          {progress && (
            <div className="space-y-2">
              <div className="text-zinc-400 text-xs text-center whitespace-pre-wrap break-all font-mono">{progress}</div>
              {isExporting && (
                <div className="w-full">
                  <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                    <span>Progress</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-200"
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
                className="block text-center bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded text-xs font-semibold shadow-lg transition-colors"
              >
                ⬇️ Download Exported MP4 Video
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50 font-medium"
          >
            {isExporting ? 'Exporting...' : 'Start Export'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
