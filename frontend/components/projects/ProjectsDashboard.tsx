/**
 * ProjectsDashboard — Video Projects view rendered when the user selects
 * "Video Projects" in the sidebar Library section.
 *
 * Features:
 * - List, create, rename, duplicate, delete projects
 * - Search (client-side) + format filter (all / horizontal 16:9 / vertical 9:16)
 * - Opens VideoEditorFromProject as a fixed inset-0 overlay
 * - Keyboard shortcuts: N = new project, / = focus search, Escape = close modal/clear search
 * - Modal focus trapping
 * - Loading skeleton + empty state
 */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Film,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Play,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useVideoProjects, type VideoProject } from '@/hooks/useVideoProjects';

// Lazy-load the editor wrapper so it doesn't bloat the initial bundle
const VideoEditorFromProject = React.lazy(() =>
  import('@/components/Editor/VideoEditor/VideoEditorFromProject').then((m) => ({
    default: m.VideoEditorFromProject,
  }))
);

// ---------------------------------------------------------------------------
// Utility — relative time
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Utility — aspect ratio helpers
// ---------------------------------------------------------------------------

type AspectRatioKey = '16:9' | '9:16' | '1:1' | 'custom';

function getAspectRatioKey(width: number, height: number): AspectRatioKey {
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16';
  if (Math.abs(ratio - 1) < 0.05) return '1:1';
  return 'custom';
}

function getResolutionLabel(width: number, height: number): string {
  const maxDim = Math.max(width, height);
  if (maxDim >= 3840) return '4K UHD';
  if (maxDim >= 2160) return '2160p';
  if (maxDim >= 1920) return '1080p';
  if (maxDim >= 1280) return '720p';
  return `${width}×${height}`;
}

// ---------------------------------------------------------------------------
// Modal focus trap helper
// ---------------------------------------------------------------------------

function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;

    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    el.addEventListener('keydown', handleTab);
    return () => el.removeEventListener('keydown', handleTab);
  }, [active, ref]);
}

// ---------------------------------------------------------------------------
// Aspect-ratio preview component (card thumbnail)
// ---------------------------------------------------------------------------

const AspectPreview: React.FC<{
  ratioKey: AspectRatioKey;
  label: string;
}> = ({ ratioKey, label }) => {
  // The outer container is always aspect-ratio 16/9 (the card's preview area)
  // For vertical/square we render a centered inner column with the correct ratio
  return (
    <div className="aspect-[16/9] bg-[#090a0f] relative flex items-center justify-center overflow-hidden">
      {/* Aspect-correct inner preview */}
      {ratioKey === '9:16' ? (
        <div
          className="relative h-full flex items-center justify-center border-x border-[#20212b]"
          style={{ aspectRatio: '9/16' }}
        >
          <div className="absolute inset-0 bg-[#111218]" />
          <ViewfinderOverlay />
        </div>
      ) : ratioKey === '1:1' ? (
        <div
          className="relative h-full flex items-center justify-center border-x border-[#20212b]"
          style={{ aspectRatio: '1/1' }}
        >
          <div className="absolute inset-0 bg-[#111218]" />
          <ViewfinderOverlay />
        </div>
      ) : (
        // 16:9 or custom — fills the full preview area
        <div className="absolute inset-0 bg-[#111218]">
          <ViewfinderOverlay />
        </div>
      )}

      {/* Aspect badge */}
      <span className="absolute top-2.5 left-2.5 z-10 text-[11px] font-semibold text-gray-200 bg-black/70 border border-[#20212b] px-1.5 py-0.5 rounded">
        {label}
      </span>
    </div>
  );
};

const ViewfinderOverlay: React.FC = () => (
  <div
    className="absolute inset-3 border border-dashed border-white/[0.04] pointer-events-none z-[1]"
    aria-hidden="true"
  />
);

// ---------------------------------------------------------------------------
// Project Card
// ---------------------------------------------------------------------------

interface ProjectCardProps {
  project: VideoProject;
  onOpen: (id: number) => void;
  onRename: (project: VideoProject) => void;
  onDuplicate: (project: VideoProject) => void;
  onDelete: (project: VideoProject) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const ratioKey = getAspectRatioKey(project.width, project.height);
  const ratioLabel =
    ratioKey === 'custom' ? `${project.width}:${project.height}` : ratioKey;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="bg-[#16171f] border border-[#20212b] rounded-xl overflow-hidden flex flex-col group cursor-pointer transition-shadow hover:border-[#2e2f3d] hover:shadow-[0_10px_24px_rgba(0,0,0,0.4)]"
      onClick={() => onOpen(project.id)}
    >
      {/* Thumbnail preview area */}
      <div className="relative">
        <AspectPreview ratioKey={ratioKey} label={ratioLabel} />

        {/* Play overlay button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen(project.id);
          }}
          aria-label={`Open ${project.name} in editor`}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
        >
          <span className="w-11 h-11 rounded-full flex items-center justify-center bg-[#585cf3] border border-transparent shadow-[0_4px_12px_rgba(0,0,0,0.3)] scale-90 group-hover:scale-100 transition-transform duration-200">
            <Play size={14} className="text-white translate-x-[1px]" fill="white" />
          </span>
        </button>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        {/* Title row + actions menu */}
        <div className="flex items-start justify-between relative">
          <span
            className="text-[15px] font-semibold text-[#f1f1f4] truncate max-w-[80%]"
            title={project.name}
          >
            {project.name}
          </span>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              ref={btnRef}
              aria-label="Project actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded-md text-[#8f919c] hover:text-[#f1f1f4] hover:bg-white/[0.05] transition-colors focus-visible:outline-2 focus-visible:outline-[#585cf3] focus-visible:outline-offset-[-2px]"
            >
              <MoreVertical size={15} />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-7 right-0 z-50 min-w-[140px] bg-[#141522] border border-[#20212b] rounded-lg shadow-[0_12px_28px_rgba(0,0,0,0.6)] p-1"
                  role="menu"
                  aria-label="Project actions menu"
                >
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onRename(project); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-[13px] text-[#c4c5cc] hover:text-[#f1f1f4] hover:bg-white/[0.03] rounded-md transition-colors"
                  >
                    <Pencil size={13} /> Rename
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onDuplicate(project); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-[13px] text-[#c4c5cc] hover:text-[#f1f1f4] hover:bg-white/[0.03] rounded-md transition-colors"
                  >
                    <Copy size={13} /> Duplicate
                  </button>
                  <div className="my-1 border-t border-white/[0.04]" />
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onDelete(project); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-[13px] text-[#c4c5cc] hover:text-red-400 hover:bg-red-500/[0.08] rounded-md transition-colors"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[12px] text-[#c4c5cc]">
          <span>{project.fps} FPS</span>
          <span className="text-[#8f919c]">·</span>
          <span>{getResolutionLabel(project.width, project.height)}</span>
        </div>

        {/* Footer */}
        <div className="pt-2.5 border-t border-white/[0.03] text-[11px] text-[#8f919c]">
          Updated {formatRelativeTime(project.updated_at)}
        </div>
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

const SkeletonCard: React.FC = () => (
  <div className="bg-[#16171f] border border-[#20212b] rounded-xl overflow-hidden animate-pulse">
    <div className="aspect-[16/9] bg-[#1d1e28]" />
    <div className="p-4 flex flex-col gap-3">
      <div className="h-4 bg-[#1d1e28] rounded w-3/4" />
      <div className="h-3 bg-[#1d1e28] rounded w-1/2" />
      <div className="h-[1px] bg-white/[0.03]" />
      <div className="h-3 bg-[#1d1e28] rounded w-1/3" />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Create Project Modal
// ---------------------------------------------------------------------------

interface AspectRatioOption {
  label: string;
  subtitle: string;
  width: number;
  height: number;
  boxClass: string;
}

const ASPECT_OPTIONS: AspectRatioOption[] = [
  { label: '16:9', subtitle: 'Horizontal (YouTube)', width: 1920, height: 1080, boxClass: 'w-11 h-[25px]' },
  { label: '9:16', subtitle: 'Vertical (TikTok/Reels)', width: 1080, height: 1920, boxClass: 'w-[25px] h-11' },
  { label: '1:1', subtitle: 'Square (Instagram)', width: 1080, height: 1080, boxClass: 'w-8 h-8' },
];

const FPS_OPTIONS = [24, 30, 60] as const;

interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (name: string, width: number, height: number, fps: number) => Promise<void>;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('Untitled Edit');
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_OPTIONS[0]);
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useFocusTrap(dialogRef, true);

  useEffect(() => {
    nameInputRef.current?.select();
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim() || 'Untitled Edit';
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onCreate(trimmed, selectedRatio.width, selectedRatio.height, fps);
      onClose();
    } catch {
      setSubmitError('Failed to create project. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [name, selectedRatio, fps, onCreate, onClose]);

  // Escape + overlay click to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 backdrop-blur-[4px]"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="create-modal-title"
    >
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className="bg-[#10111a] border border-[#20212b] rounded-xl w-[480px] max-w-[90vw] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 id="create-modal-title" className="text-xl font-semibold text-[#f1f1f4]">
            Create New Video Project
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-[#8f919c] hover:text-[#f1f1f4] text-xl leading-none transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Project name */}
        <div className="mb-4">
          <label htmlFor="create-name" className="block text-[13px] font-medium text-[#c4c5cc] mb-1.5">
            Project Name
          </label>
          <input
            ref={nameInputRef}
            id="create-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !submitting) handleSubmit(); }}
            className="w-full bg-black/30 border border-[#20212b] focus:border-[#585cf3] rounded-lg px-3.5 py-2.5 text-white text-[14px] outline-none transition-colors"
            placeholder="Untitled Edit"
          />
        </div>

        {/* Aspect ratio selector */}
        <div className="mb-6">
          <p className="text-[13px] font-medium text-[#c4c5cc] mb-3">Format / Aspect Ratio</p>
          <div className="grid grid-cols-3 gap-2">
            {ASPECT_OPTIONS.map((opt) => {
              const isActive = opt.label === selectedRatio.label;
              return (
                <button
                  key={opt.label}
                  onClick={() => setSelectedRatio(opt)}
                  className={`border rounded-lg p-4 flex flex-col items-center gap-2.5 text-center transition-all ${
                    isActive
                      ? 'border-[#585cf3] bg-[#585cf3]/[0.06]'
                      : 'border-[#20212b] bg-white/[0.01] hover:border-[#2e2f3d] hover:bg-white/[0.03]'
                  }`}
                >
                  <div
                    className={`${opt.boxClass} border rounded-sm ${
                      isActive
                        ? 'bg-[#585cf3]/20 border-[#585cf3]'
                        : 'bg-white/[0.04] border-dashed border-white/15'
                    }`}
                  />
                  <span className="text-[13px] font-medium text-[#f1f1f4]">{opt.label}</span>
                  <span className="text-[11px] text-[#8f919c]">{opt.subtitle}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Frame rate */}
        <div className="mb-6">
          <p className="text-[13px] font-medium text-[#c4c5cc] mb-3">Frame Rate</p>
          <div className="flex gap-2">
            {FPS_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setFps(f as 24 | 30 | 60)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-medium border transition-all ${
                  fps === f
                    ? 'border-[#585cf3] bg-[#585cf3]/[0.06] text-[#f1f1f4]'
                    : 'border-[#20212b] bg-white/[0.01] text-[#c4c5cc] hover:border-[#2e2f3d] hover:text-[#f1f1f4]'
                }`}
              >
                {f} FPS
              </button>
            ))}
          </div>
        </div>

        {submitError && (
          <p className="text-red-400 text-[13px] mb-4">{submitError}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-[18px] py-2.5 rounded-lg text-[14px] font-medium text-[#c4c5cc] bg-white/[0.02] border border-[#20212b] hover:bg-white/[0.06] hover:text-[#f1f1f4] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-[18px] py-2.5 rounded-lg text-[14px] font-semibold text-white bg-[#585cf3] hover:bg-[#3b3fe9] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Rename Modal
// ---------------------------------------------------------------------------

interface RenameProjectModalProps {
  project: VideoProject;
  onClose: () => void;
  onRename: (id: number, name: string) => Promise<void>;
}

const RenameProjectModal: React.FC<RenameProjectModalProps> = ({ project, onClose, onRename }) => {
  const [name, setName] = useState(project.name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useFocusTrap(dialogRef, true);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await onRename(project.id, trimmed);
      onClose();
    } catch {
      setError('Failed to rename. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [name, project.id, onRename, onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 backdrop-blur-[4px]"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="rename-modal-title"
    >
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className="bg-[#10111a] border border-[#20212b] rounded-xl w-[440px] max-w-[90vw] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="rename-modal-title" className="text-xl font-semibold text-[#f1f1f4]">
            Rename Project
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-[#8f919c] hover:text-[#f1f1f4] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          <label htmlFor="rename-input" className="block text-[13px] font-medium text-[#c4c5cc] mb-1.5">
            Project Name
          </label>
          <input
            ref={inputRef}
            id="rename-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !submitting) handleSubmit(); }}
            className="w-full bg-black/30 border border-[#20212b] focus:border-[#585cf3] rounded-lg px-3.5 py-2.5 text-white text-[14px] outline-none transition-colors"
          />
          {error && <p className="text-red-400 text-[13px] mt-2">{error}</p>}
        </div>

        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-[18px] py-2.5 rounded-lg text-[14px] font-medium text-[#c4c5cc] bg-white/[0.02] border border-[#20212b] hover:bg-white/[0.06] hover:text-[#f1f1f4] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="px-[18px] py-2.5 rounded-lg text-[14px] font-semibold text-white bg-[#585cf3] hover:bg-[#3b3fe9] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

interface DeleteProjectModalProps {
  project: VideoProject;
  onClose: () => void;
  onDelete: (id: number) => Promise<void>;
}

const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({ project, onClose, onDelete }) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, true);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      await onDelete(project.id);
      onClose();
    } catch {
      setError('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  }, [project.id, onDelete, onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 backdrop-blur-[4px]"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="delete-modal-title"
    >
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className="bg-[#10111a] border border-red-500/20 rounded-xl w-[440px] max-w-[90vw] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="delete-modal-title" className="text-xl font-semibold text-[#f1f1f4]">
            Delete Project
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-[#8f919c] hover:text-[#f1f1f4] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-start gap-3 mb-6 p-4 bg-red-500/[0.06] border border-red-500/[0.15] rounded-lg">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-[14px] text-[#c4c5cc] leading-relaxed">
            Are you sure you want to delete <span className="font-semibold text-[#f1f1f4]">{project.name}</span>? This action cannot be undone.
          </p>
        </div>

        {error && <p className="text-red-400 text-[13px] mb-4">{error}</p>}

        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-[18px] py-2.5 rounded-lg text-[14px] font-medium text-[#c4c5cc] bg-white/[0.02] border border-[#20212b] hover:bg-white/[0.06] hover:text-[#f1f1f4] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-[18px] py-2.5 rounded-lg text-[14px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete Project'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

type FormatFilter = 'all' | 'horizontal' | 'vertical' | 'square';

export const ProjectsDashboard: React.FC = () => {
  const { projects, isLoading, error, createProject, renameProject, deleteProject, refresh } =
    useVideoProjects();

  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<VideoProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoProject | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const openProjectId = useMemo(() => {
    const parts = location.pathname.split('/');
    if (parts[1] === 'projects' && parts[2]) {
      const id = parseInt(parts[2], 10);
      return isNaN(id) ? null : id;
    }
    return null;
  }, [location.pathname]);

  const handleOpenProject = useCallback((id: number) => {
    navigate(`/projects/${id}`);
  }, [navigate]);

  const handleCloseProject = useCallback(() => {
    navigate('/projects');
  }, [navigate]);

  const searchRef = useRef<HTMLInputElement>(null);

  // Load projects on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // N = open New Project modal
      if (e.key === 'n' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowCreateModal(true);
        return;
      }

      // / = focus search
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // Escape = close modals or clear search
      if (e.key === 'Escape') {
        if (showCreateModal || renameTarget || deleteTarget) return; // modals handle their own Escape
        if (search) {
          setSearch('');
          setFormatFilter('all');
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, renameTarget, deleteTarget, search]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    let list = projects;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (formatFilter !== 'all') {
      list = list.filter((p) => {
        const key = getAspectRatioKey(p.width, p.height);
        if (formatFilter === 'horizontal') return key === '16:9';
        if (formatFilter === 'vertical') return key === '9:16';
        if (formatFilter === 'square') return key === '1:1';
        return true;
      });
    }

    return list;
  }, [projects, search, formatFilter]);

  const handleDuplicate = useCallback(
    async (project: VideoProject) => {
      await createProject(
        `${project.name} Copy`,
        project.width,
        project.height,
        project.fps
      );
    },
    [createProject]
  );

  const handleCreate = useCallback(
    async (name: string, width: number, height: number, fps: number) => {
      await createProject(name, width, height, fps);
    },
    [createProject]
  );

  const hasFilters = search.trim() || formatFilter !== 'all';

  // If a project is open, render the editor overlay
  if (openProjectId !== null) {
    return (
      <React.Suspense fallback={null}>
        <VideoEditorFromProject
          projectId={openProjectId}
          onClose={handleCloseProject}
        />
      </React.Suspense>
    );
  }

  return (
    <div className="min-h-full bg-[#111218] text-[#f1f1f4] overflow-y-auto">
      <div className="px-12 py-8 max-w-[1600px]">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#f1f1f4]">
              Video Projects
            </h1>
            <p className="text-[14px] text-[#c4c5cc] mt-0.5">
              Manage, edit, and export your video timelines and compositions
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            title="New Project (N)"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-semibold text-white bg-[#585cf3] hover:bg-[#3b3fe9] border border-white/[0.05] shadow-[0_2px_6px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] active:translate-y-px transition-all focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
          >
            <Plus size={15} strokeWidth={2.5} />
            New Project
          </button>
        </div>

        {/* ---- Toolbar ---- */}
        <div className="flex items-center justify-between bg-[#0d0e12] border border-[#20212b] rounded-xl px-6 py-4 mb-6">
          {/* Search */}
          <div
            className="flex items-center gap-2.5 bg-black/20 border border-[#20212b] focus-within:border-[#585cf3] rounded-lg px-3.5 py-2 w-80 transition-colors"
          >
            <Search size={16} className="text-[#8f919c] shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects"
              className="bg-transparent border-none outline-none text-[14px] text-[#f1f1f4] placeholder-[#8f919c] w-full"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="text-[#8f919c] hover:text-[#f1f1f4] transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as FormatFilter)}
              aria-label="Filter by format"
              className="bg-white/[0.02] border border-[#20212b] hover:border-[#2e2f3d] text-[#c4c5cc] hover:text-[#f1f1f4] px-3.5 py-2 rounded-lg text-[13px] outline-none cursor-pointer transition-colors focus-visible:border-[#585cf3]"
            >
              <option value="all">All Formats</option>
              <option value="horizontal">Horizontal (16:9)</option>
              <option value="vertical">Vertical (9:16)</option>
              <option value="square">Square (1:1)</option>
            </select>
          </div>
        </div>

        {/* ---- Projects Grid ---- */}
        {isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-white/[0.02] border border-[#20212b] flex items-center justify-center mb-4">
              <AlertTriangle size={24} className="text-[#8f919c]" />
            </div>
            <h3 className="text-[15px] font-semibold text-[#f1f1f4] mb-1.5">{error}</h3>
            <button
              onClick={refresh}
              className="mt-4 px-5 py-2 rounded-lg text-[14px] font-medium text-[#c4c5cc] bg-white/[0.02] border border-[#20212b] hover:bg-white/[0.06] hover:text-[#f1f1f4] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <AnimatePresence mode="sync">
            {filteredProjects.length === 0 && projects.length === 0 ? (
              // Virgin empty state (no projects at all)
              <motion.div
                key="virgin-empty"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-full flex flex-col items-center justify-center py-16 text-center bg-[#16171f] border border-dashed border-[#20212b] rounded-xl"
              >
                <div className="w-14 h-14 rounded-full bg-white/[0.02] border border-[#20212b] flex items-center justify-center mb-4">
                  <Film size={24} className="text-[#8f919c]" />
                </div>
                <h3 className="text-[15px] font-semibold text-[#f1f1f4] mb-1.5">No video projects yet</h3>
                <p className="text-[13px] text-[#c4c5cc] max-w-sm leading-relaxed mb-6">
                  Create your first project to start building video timelines and compositions.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-semibold text-white bg-[#585cf3] hover:bg-[#3b3fe9] transition-colors"
                >
                  <Plus size={15} strokeWidth={2.5} />
                  Create First Project
                </button>
              </motion.div>
            ) : filteredProjects.length === 0 && hasFilters ? (
              // Search/filter empty state
              <motion.div
                key="filter-empty"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-full flex flex-col items-center justify-center py-16 text-center bg-[#16171f] border border-dashed border-[#20212b] rounded-xl"
              >
                <div className="w-14 h-14 rounded-full bg-white/[0.02] border border-[#20212b] flex items-center justify-center mb-4">
                  <Search size={24} className="text-[#8f919c]" />
                </div>
                <h3 className="text-[15px] font-semibold text-[#f1f1f4] mb-1.5">No matching projects</h3>
                <p className="text-[13px] text-[#c4c5cc] max-w-[380px] leading-relaxed mb-6">
                  We couldn't find any projects matching your search or filters. Try adjusting your query or resetting filters.
                </p>
                <button
                  onClick={() => { setSearch(''); setFormatFilter('all'); }}
                  className="px-5 py-2.5 rounded-lg text-[14px] font-medium text-[#c4c5cc] bg-white/[0.02] border border-[#20212b] hover:bg-white/[0.06] hover:text-[#f1f1f4] transition-colors"
                >
                  Clear Search &amp; Filters
                </button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
                <AnimatePresence>
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onOpen={handleOpenProject}
                      onRename={setRenameTarget}
                      onDuplicate={handleDuplicate}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* ---- Modals ---- */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateProjectModal
            key="create"
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreate}
          />
        )}
        {renameTarget && (
          <RenameProjectModal
            key={`rename-${renameTarget.id}`}
            project={renameTarget}
            onClose={() => setRenameTarget(null)}
            onRename={renameProject}
          />
        )}
        {deleteTarget && (
          <DeleteProjectModal
            key={`delete-${deleteTarget.id}`}
            project={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDelete={deleteProject}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
