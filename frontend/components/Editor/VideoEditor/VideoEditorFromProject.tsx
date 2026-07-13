/**
 * VideoEditorFromProject — Opens the NLE editor for an existing project
 * by project ID, without requiring a source Photo object.
 *
 * Flow:
 * 1. Fetch the full project from /api/v1/nle/projects/{projectId}
 * 2. Call loadProject() on the NLE store to restore timeline state
 * 3. Construct a minimal Photo stub (NLE editor only needs id/path/filename/type)
 * 4. Render VideoEditorMode with the stub photo
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '@/services/apiClient';
import { useNLEStore } from '@/store/nleStore';
import type { NLEProject } from '@/types/nle';
import type { Photo } from '@/types';
import { VideoEditorMode } from './VideoEditorMode';

interface VideoEditorFromProjectProps {
  projectId: number;
  onClose: () => void;
}

export const VideoEditorFromProject: React.FC<VideoEditorFromProjectProps> = ({
  projectId,
  onClose,
}) => {
  const loadProject = useNLEStore((s) => s.loadProject);

  const [photoStub, setPhotoStub] = useState<Photo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAndLoad() {
      try {
        const project = await apiClient.get<NLEProject>(
          `/api/v1/nle/projects/${projectId}`
        );
        if (cancelled) return;

        // Load project state into the NLE store before rendering the editor
        loadProject(project);

        // Build a minimal Photo stub — VideoEditorMode uses photo.id/path/filename
        // for clip analysis. For projects opened from the dashboard (no cover photo),
        // we use empty/stub values; the editor will work in "empty timeline" mode
        // and the user can drag clips in from the assets panel.
        const stub: Photo = {
          id: project.id,
          url: '',
          path: '',
          width: project.width,
          height: project.height,
          date: project.created_at,
          isFavorite: false,
          filename: project.name,
          type: 'video',
        };

        if (!cancelled) {
          setPhotoStub(stub);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('VideoEditorFromProject: failed to load project', err);
          setError('Failed to load project. Please try again.');
        }
      }
    }

    fetchAndLoad();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadProject]);

  // Error state
  if (error) {
    return createPortal(
      <div className="fixed inset-0 z-[100] bg-[#08090d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-8">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white/70 text-sm max-w-xs">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // Loading state — linear shimmer bar matching the editor's aesthetic
  if (!photoStub) {
    return createPortal(
      <div className="fixed inset-0 z-[100] bg-[#08090d] flex flex-col items-center justify-center gap-4">
        <p className="text-white/40 text-sm tracking-wide">Opening editor…</p>
        <div className="w-[280px] h-[3px] bg-white/[0.06] rounded-full overflow-hidden relative">
          <div
            className="absolute h-full rounded-full bg-[#585cf3]"
            style={{
              animation: 'nle-shimmer 1.5s infinite ease-in-out',
              width: '60%',
            }}
          />
        </div>
        <style>{`
          @keyframes nle-shimmer {
            0%   { left: -60%; }
            100% { left: 110%; }
          }
        `}</style>
      </div>,
      document.body
    );
  }

  return createPortal(
    <VideoEditorMode photo={photoStub} onClose={onClose} />,
    document.body
  );
};
