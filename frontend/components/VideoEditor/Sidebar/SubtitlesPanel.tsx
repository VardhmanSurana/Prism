import React, { useState } from 'react';
import { Plus, Trash2, Loader2, Sparkles, Upload } from 'lucide-react';
import { SubtitlesPanelProps } from '../types';
import { API_BASE } from '@/constants';

export const SubtitlesPanel: React.FC<SubtitlesPanelProps> = ({
  tracks,
  onAddSubtitle,
  onUpdateSubtitle,
  onDeleteSubtitle,
  videoPath,
}) => {
  const subtitleTrack = tracks.find(t => t.type === 'subtitle');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!subtitleTrack) return;
    const clip = {
      id: 'clip_' + Date.now(),
      type: 'subtitle' as const,
      startTime: 0,
      duration: 2,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      text: 'New Subtitle',
      fontFamily: 'Arial',
      fontSize: 24,
      fontColor: '#ffffff',
      fontWeight: 'normal',
      textAlign: 'center' as const,
      x: 50,
      y: 90,
    };
    onAddSubtitle(subtitleTrack.id, clip);
  };

  const handleAutoGenerate = async () => {
    if (!subtitleTrack || !videoPath) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/video/subtitles/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_path: videoPath }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.subtitles && Array.isArray(data.subtitles)) {
          for (const sub of data.subtitles) {
            const clip = {
              id: 'clip_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              type: 'subtitle' as const,
              startTime: sub.start ?? 0,
              duration: (sub.end ?? 2) - (sub.start ?? 0),
              trimStart: 0,
              trimEnd: 0,
              speed: 1,
              text: sub.text ?? '',
              fontFamily: 'Arial',
              fontSize: 24,
              fontColor: '#ffffff',
              fontWeight: 'normal',
              textAlign: 'center' as const,
              x: 50,
              y: 90,
            };
            onAddSubtitle(subtitleTrack.id, clip);
          }
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
          Subtitles
        </label>

        {subtitleTrack && subtitleTrack.clips.length === 0 && (
          <p className="text-[11px] text-white/20 py-4 text-center">No subtitles yet</p>
        )}

        {subtitleTrack?.clips.map(clip => (
          <div
            key={clip.id}
            className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-2"
          >
            {editingId === clip.id ? (
              <input
                autoFocus
                value={clip.text ?? ''}
                onChange={(e) => onUpdateSubtitle(subtitleTrack.id, clip.id, { text: e.target.value })}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => { if (e.key === 'Enter') setEditingId(null); }}
                className="w-full px-2 py-1.5 rounded-md bg-white/[0.05] border border-white/10 text-[11px] text-white/70 outline-none font-mono"
              />
            ) : (
              <p
                className="text-[11px] text-white/60 cursor-pointer hover:text-white/80 transition-colors truncate"
                onClick={() => setEditingId(clip.id)}
              >
                {clip.text || 'Empty subtitle'}
              </p>
            )}

            <div className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-2 gap-1">
                <input
                  type="number"
                  step={0.1}
                  value={clip.startTime}
                  onChange={(e) => {
                    const start = Number(e.target.value);
                    onUpdateSubtitle(subtitleTrack.id, clip.id, {
                      startTime: start,
                      duration: Math.max(0.1, clip.duration - (start - clip.startTime)),
                    });
                  }}
                  className="px-1.5 py-1 rounded bg-white/[0.03] border border-white/5 text-[9px] text-white/40 outline-none font-mono"
                  title="Start time"
                />
                <input
                  type="number"
                  step={0.1}
                  value={clip.startTime + clip.duration}
                  onChange={(e) => {
                    const end = Number(e.target.value);
                    onUpdateSubtitle(subtitleTrack.id, clip.id, {
                      duration: Math.max(0.1, end - clip.startTime),
                    });
                  }}
                  className="px-1.5 py-1 rounded bg-white/[0.03] border border-white/5 text-[9px] text-white/40 outline-none font-mono"
                  title="End time"
                />
              </div>
              <button
                onClick={() => onDeleteSubtitle(subtitleTrack.id, clip.id)}
                className="shrink-0 p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 text-[11px] text-white/40 hover:text-white/60 transition-all"
        >
          <Plus size={14} />
          Add
        </button>
        <button
          onClick={handleAutoGenerate}
          disabled={loading || !videoPath}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-medium transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Auto-generate
        </button>
      </div>

      <button className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-white/10 text-[11px] text-white/30 hover:text-white/50 hover:border-white/20 transition-all">
        <Upload size={14} />
        Import SRT
      </button>
    </div>
  );
};
