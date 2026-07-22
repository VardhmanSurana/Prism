import React, { useEffect, useState } from 'react';
import { UserCheck, X, Check } from 'lucide-react';
import { API_BASE } from '@/constants';
import { Photo } from '@/types';

interface FaceData {
  photo_id: number;
  person_id: number | null;
  person_name: string;
  face_box: string | null; // e.g. '{"x":0.2,"y":0.2,"w":0.3,"h":0.3}' or [x,y,w,h]
  confidence?: number;
}

interface FaceTaggingOverlayProps {
  photo: Photo;
  onClose: () => void;
  onTagUpdated?: () => void;
}

export const FaceTaggingOverlay: React.FC<FaceTaggingOverlayProps> = ({ photo, onClose, onTagUpdated }) => {
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [activeFaceIndex, setActiveFaceIndex] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const fetchFaces = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/photos/${photo.id}/faces`);
        if (res.ok && isCurrent) {
          const data = await res.json();
          setFaces(data.faces || []);
        }
      } catch (e) {
        console.error('Failed to fetch photo faces:', e);
      }
    };
    void fetchFaces();
    return () => { isCurrent = false; };
  }, [photo.id]);

  const parseBox = (rawBox: string | null) => {
    if (!rawBox) return { x: 0.3, y: 0.2, w: 0.4, h: 0.4 };
    try {
      if (typeof rawBox === 'string') {
        const parsed = JSON.parse(rawBox);
        if (Array.isArray(parsed)) return { x: parsed[0], y: parsed[1], w: parsed[2], h: parsed[3] };
        return parsed;
      }
    } catch {
      // fallback box
    }
    return { x: 0.3, y: 0.2, w: 0.4, h: 0.4 };
  };

  const handleSaveTag = async (face: FaceData) => {
    if (!nameInput.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/photos/${photo.id}/tag-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_name: nameInput.trim(),
          face_box: face.face_box,
          person_id: face.person_id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFaces(prev => prev.map(f => f === face ? { ...f, person_name: data.person_name, person_id: data.person_id } : f));
        setActiveFaceIndex(null);
        setNameInput('');
        onTagUpdated?.();
      }
    } catch (e) {
      console.error('Failed to tag face:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center">
      {/* Top Banner indicating Face Tagging mode */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-black/85 backdrop-blur-md border border-white/20 text-xs text-white font-medium flex items-center gap-2 shadow-xl">
        <UserCheck size={14} className="text-primary" />
        <span>Face Tagging Mode — Click any face box to assign a name</span>
        <button
          onClick={onClose}
          className="ml-2 p-1 rounded-full hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Render Face Bounding Boxes */}
      {faces.length === 0 ? (
        <div className="p-4 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-center text-xs text-gray-300">
          No detected face boxes found for this photo.
        </div>
      ) : (
        faces.map((face, idx) => {
          const box = parseBox(face.face_box);
          const leftPct = `${box.x * 100}%`;
          const topPct = `${box.y * 100}%`;
          const widthPct = `${box.w * 100}%`;
          const heightPct = `${box.h * 100}%`;
          const isSelected = activeFaceIndex === idx;

          return (
            <div
              key={idx}
              style={{ left: leftPct, top: topPct, width: widthPct, height: heightPct }}
              className="absolute border-2 border-primary/90 rounded-lg hover:border-white transition-all cursor-pointer shadow-lg group"
              onClick={(e) => {
                e.stopPropagation();
                setActiveFaceIndex(idx);
                setNameInput(face.person_name === 'Unknown' ? '' : face.person_name);
              }}
            >
              {/* Face Name Label */}
              <div className="absolute -top-7 left-0 px-2 py-0.5 rounded bg-primary text-black font-semibold text-[11px] whitespace-nowrap shadow-md flex items-center gap-1">
                <UserCheck size={11} />
                <span>{face.person_name || 'Tag Person'}</span>
              </div>

              {/* Edit Tag Popover */}
              {isSelected && (
                <div
                  className="absolute top-full left-0 mt-2 z-50 p-3 rounded-xl bg-surface border border-white/20 shadow-2xl min-w-[200px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[11px] text-gray-400 mb-2 font-medium">Tag Person Name</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Enter name..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs text-white focus:outline-none focus:border-primary"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveTag(face);
                        if (e.key === 'Escape') setActiveFaceIndex(null);
                      }}
                    />
                    <button
                      onClick={() => handleSaveTag(face)}
                      disabled={isSaving}
                      className="p-1.5 rounded-lg bg-primary text-black hover:bg-primary/90 transition-colors"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
