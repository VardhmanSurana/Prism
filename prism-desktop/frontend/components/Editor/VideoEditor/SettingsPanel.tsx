/**
 * SettingsPanel — Project-level settings (resolution, FPS, etc.)
 */
import React from 'react';
import { useNLEStore } from '@/store/nleStore';

const RESOLUTION_PRESETS = [
  { label: '1080p (16:9)', w: 1920, h: 1080 },
  { label: '720p (16:9)', w: 1280, h: 720 },
  { label: '4K (16:9)', w: 3840, h: 2160 },
  { label: 'Instagram (9:16)', w: 1080, h: 1920 },
  { label: 'Square (1:1)', w: 1080, h: 1080 },
  { label: 'Twitter (16:9)', w: 1280, h: 720 },
];

const FPS_OPTIONS = [24, 25, 30, 60];

export const SettingsPanel: React.FC = () => {
  const {
    projectName, projectWidth, projectHeight, projectFps,
    tracks, bookmarks, duration,
  } = useNLEStore();

  const totalClips = tracks.reduce((sum, t) => sum + t.clips.length, 0);

  return (
    <div className="w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col shrink-0">
      <div className="h-10 flex items-center px-3 border-b border-[#2a2a2a]">
        <span className="text-[#999] text-xs font-medium">Project Settings</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Project info */}
        <div className="p-3 border-b border-[#2a2a2a]">
          <span className="text-[#999] text-[10px] font-medium block mb-1.5">Project</span>
          <div className="text-[#ccc] text-xs">{projectName}</div>
          <div className="text-[#666] text-[10px] mt-1">
            {tracks.length} tracks · {totalClips} clips · {duration.toFixed(1)}s
          </div>
          {bookmarks.length > 0 && (
            <div className="text-[#666] text-[10px] mt-0.5">
              {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Resolution */}
        <div className="p-3 border-b border-[#2a2a2a]">
          <span className="text-[#999] text-[10px] font-medium block mb-1.5">Resolution</span>
          <div className="text-[#ccc] text-xs">{projectWidth} × {projectHeight}</div>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {RESOLUTION_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => useNLEStore.setState({ projectWidth: preset.w, projectHeight: preset.h, isDirty: true })}
                className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                  projectWidth === preset.w && projectHeight === preset.h
                    ? 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/50'
                    : 'bg-[#222] text-[#999] border-[#333] hover:border-[#555]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* FPS */}
        <div className="p-3 border-b border-[#2a2a2a]">
          <span className="text-[#999] text-[10px] font-medium block mb-1.5">Frame Rate</span>
          <div className="flex gap-1.5">
            {FPS_OPTIONS.map((fps) => (
              <button
                key={fps}
                onClick={() => useNLEStore.setState({ projectFps: fps, isDirty: true })}
                className={`flex-1 px-2 py-1 text-[10px] rounded border transition-colors ${
                  projectFps === fps
                    ? 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/50'
                    : 'bg-[#222] text-[#999] border-[#333] hover:border-[#555]'
                }`}
              >
                {fps}fps
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard shortcuts reference */}
        <div className="p-3">
          <span className="text-[#999] text-[10px] font-medium block mb-1.5">Keyboard Shortcuts</span>
          <div className="space-y-1">
            {[
              ['Space', 'Play / Pause'],
              ['← →', 'Step frame'],
              ['S', 'Split clip'],
              ['F', 'Freeze frame'],
              ['Del', 'Delete clip'],
              ['Ctrl+Z', 'Undo'],
              ['Ctrl+Shift+Z', 'Redo'],
              ['Ctrl+C', 'Copy clip'],
              ['Ctrl+V', 'Paste clip'],
              ['Ctrl+S', 'Save project'],
              ['\\', 'Toggle compare'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center gap-2 text-[10px]">
                <kbd className="bg-[#222] text-[#ccc] px-1.5 py-0.5 rounded border border-[#333] font-mono min-w-[48px] text-center">
                  {key}
                </kbd>
                <span className="text-[#666]">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
