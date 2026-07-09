import React, { useState, useCallback } from 'react';
import { useNLEStore } from '@/store/nleStore';
import { API_BASE } from '@/constants';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

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
  const { toProjectJson, projectWidth, projectHeight, projectFps } = useNLEStore();
  const [resolution, setResolution] = useState<[number, number]>([projectWidth, projectHeight]);
  const [fps, setFps] = useState(projectFps);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [activePreset, setActivePreset] = useState<string>('Custom');
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
    setProgress('Selecting export path...');

    try {
      // 1. Ask user where to save the video locally
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

      // 2. Retrieve MLT XML representation from Python NLE service
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

      // 3. Setup Tauri event listener for progress events from Rust
      const unlisten = await listen<number>('nle-export-progress', (event) => {
        setProgressPercent(Math.round(event.payload * 100));
      });

      try {
        // 4. Invoke Rust command to run melt rendering process
        await invoke<string>('nle_export_local', {
          mltXml: xml,
          outputPath: filePath,
          width: resolution[0],
          height: resolution[1],
          fps,
          quality,
        });

        setDownloadUrl(null);
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
  }, [toProjectJson, resolution, fps, quality]);

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-lg border border-zinc-800 w-[420px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-white font-medium">Export Video</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
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
              <div className="text-zinc-400 text-sm text-center whitespace-pre-wrap break-all">{progress}</div>
              {isExporting && (
                <div className="w-full">
                  <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                    <span>Progress</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {downloadUrl && (
            <div className="space-y-2">
              <div className="text-center text-green-400 text-sm">Export complete!</div>
              <a
                href={downloadUrl}
                download
                className="block text-center bg-green-600 hover:bg-green-500 text-white py-2 rounded text-sm"
              >
                Download Video
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
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Start Export'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
