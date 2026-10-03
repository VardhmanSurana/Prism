/**
 * ProjectsDashboard — Prism Video Projects view
 *
 * Non-linear multi-track editing timelines, client cutdowns,
 * master color grades, and audio stems held in local sandbox storage.
 *
 * Features:
 * - Prism Dark Basalt UI with atmospheric diffuse glow
 * - 3-column cinematic master project cards with playhead scrub and audio waveform telemetry
 * - Alternate 12-column dense timeline sequence list view
 * - Filter tabs (All, In Progress, Final Deliverables, Drafts) & live search
 * - Sort selector (Last Modified, Duration, Resolution, Framerate)
 * - Quick Cinema Presets (4K Cinema, Social Vertical, Standard HD)
 * - Architectural Empty State Blueprint section
 * - Interactive Prism Context Menu with keyboard shortcuts (⌘O, ⌘D, ⇧⌘E, ⌫)
 * - New Multi-Track Timeline modal with Canvas Resolution, Timebase/FPS, Color Space
 * - Full integration with useVideoProjects & VideoEditorFromProject
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
  ChevronDown,
  Check,
  HardDrive,
  LayoutGrid,
  List,
  Activity,
  Sliders,
  Sparkles,
  Layers,
  Code,
  CheckCircle2,
  Share2,
  FileVideo,
  Clapperboard,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useVideoProjects, type VideoProject } from '@/hooks/useVideoProjects';
import { useTelemetry } from '@/hooks/useTelemetry';

// Lazy-load the editor wrapper so it doesn't bloat the initial bundle
const VideoEditorFromProject = React.lazy(() =>
  import('@/components/Editor/VideoEditor/VideoEditorFromProject').then((m) => ({
    default: m.VideoEditorFromProject,
  }))
);

// ---------------------------------------------------------------------------
// Utility — relative time formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  if (!isoString) return 'Recently';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  if (isNaN(then)) return isoString;
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Master Stills & Showcase Timelines (Prism System Showcase)
// ---------------------------------------------------------------------------

interface ShowcaseProject {
  id: string;
  name: string;
  category: 'final' | 'in-progress' | 'drafts';
  statusBadge: string;
  badgeDotClass: string;
  duration: string;
  durationSeconds: number;
  playheadProgress: number; // 0 to 1
  posterUrl: string;
  alt: string;
  modifiedText: string;
  resolution: string;
  width: number;
  height: number;
  fps: number;
  codec: string;
  colorSpace: string;
  tracks: string;
  footerStatus: string;
  footerIcon: 'eq' | 'progress' | 'verified' | 'hub' | 'check';
  footerSub: string;
  isReal?: boolean;
}

const SHOWCASE_PROJECTS: ShowcaseProject[] = [
  {
    id: 'showcase-1',
    name: 'Geedam Wedding Cinematic',
    category: 'final',
    statusBadge: 'Master Cut • 4K DCI',
    badgeDotClass: 'bg-emerald-400',
    duration: '08:42',
    durationSeconds: 522,
    playheadProgress: 0.4,
    posterUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA045fj92u1BoVaDWeR52bTUIApoEpwfuNKjhyDzM4aI0AhTsuRa3ozK_-BUABHobNc4H6ypH7Bu5bNDlsmUQ7L6aMfC7730JjnGgNfFotlwuNyjrrYxZ34VYnmy-PbsJjdR5AihcbJDAOZaet_WW7b3nwWKZBoXlkwKGa-bCYBRzHG32oEU67ay3dPiyBKbicXm8Yf_5ufHNTJ7GRgO9H5CtVKWJ-uuRruDQ2g7Ar1BibCdL-12WxtzQ',
    alt: 'Cinematic warm tungsten Indian wedding ceremonial portrait under deep obsidian shadows',
    modifiedText: 'Modified 2 hours ago • Local NVMe',
    resolution: '3840x2160 (4K)',
    width: 3840,
    height: 2160,
    fps: 60,
    codec: 'Apple ProRes 422 HQ',
    colorSpace: 'Rec.709',
    tracks: '12 Tracks (4V / 8A)',
    footerStatus: 'Stem audio sync locked',
    footerIcon: 'eq',
    footerSub: '',
  },
  {
    id: 'showcase-2',
    name: 'PowerChat Demo',
    category: 'in-progress',
    statusBadge: 'In Progress • Rough Cut',
    badgeDotClass: 'bg-stone-400',
    duration: '03:15',
    durationSeconds: 195,
    playheadProgress: 0.75,
    posterUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDPT0-FgHDWaYNEOi_qvHF7I14iSWDu_ishs-Bliih8I0xLYe03vUxC8uxy7pd59cwk4Eqb_F25PGPk_W73W5ynvNfyuOyclapsra2dBlNJpZV2iY_JYFtjmrRKk7lsSavi_EO82O12BQ59YGKRtOiJ7jW85R6mcb9EAW3uL7EEkJ1dLy2n4J9NC6wnbx7fPiQ5Mzm5m1ByFRZjKkn-g9y2zqH3qoMMKQnJtvgj1wztFjSkVRjQMNdCFg',
    alt: 'Modern tech presentation screencast with minimalist software interface glowing softly on dark displays',
    modifiedText: 'Modified yesterday at 18:24',
    resolution: '1920x1080 (FHD)',
    width: 1920,
    height: 1080,
    fps: 60,
    codec: 'H.265 / HEVC',
    colorSpace: 'Stereo 48kHz',
    tracks: '6 Tracks (2V / 4A)',
    footerStatus: 'Color Grade Pending • 75% Cut',
    footerIcon: 'progress',
    footerSub: '',
  },
  {
    id: 'showcase-3',
    name: 'Faroe Islands Recon Reel',
    category: 'in-progress',
    statusBadge: 'Color Locked • D-Log M',
    badgeDotClass: 'bg-emerald-400',
    duration: '04:38',
    durationSeconds: 278,
    playheadProgress: 1.0,
    posterUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDidzQ_JHigt2yFrrD2OqNDLSX19TUFfvJYTzi9FNW4t49Qy6J2z1AkTOW7EyyUWqd8iZkbCcQNcMSh8BKMUlHcAcSB-oONIwxf7MHrqarPwdKUWaWRsVZAtKW-6UcVrxW3NXInZis3ug9Asfq-SA_68UDv0aP6chFrfORG-hrSrgDJk_76Y5Bl-CUbLXlYX53B5xVowkmSRJspLIpnd6mC7LF0qipCMu3_cZ_R4McQ9O9TrYqpKdWggQ',
    alt: 'Moody Nordic dramatic basalt sea cliff shrouded in sea spray and cold obsidian Atlantic rollers',
    modifiedText: 'Modified 3 days ago',
    resolution: '4096x2160 (4K DCI)',
    width: 4096,
    height: 2160,
    fps: 24,
    codec: 'RAW CineDNG',
    colorSpace: 'ACEScg',
    tracks: '16 Tracks (6V / 10A)',
    footerStatus: 'Luminance LUT: Kodak 2383 D60',
    footerIcon: 'eq',
    footerSub: 'ACES 1.3',
  },
  {
    id: 'showcase-4',
    name: 'Prism Lisbon Editorial Monograph',
    category: 'final',
    statusBadge: 'Final Export • Archival',
    badgeDotClass: 'bg-stone-300',
    duration: '02:18',
    durationSeconds: 138,
    playheadProgress: 1.0,
    posterUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBHYB1W-LNY9OeIqwZWJOywQR_cxuSTFnhFjl0fUCqjIOVL087TAHrUlRTXR8dRvZhbvB4QAnApnhrdIlDc610kP5AENryC0EYmn8WpjAH7nm1E6-iiqx99N82ct6OvQ8xc648iV9Idm2Bi-GQHzo4woInj6hmt97BzQRyRD_jx855LKFuOrOv341j7wH4m3XHR4zucWXGPqcvKbFGmD5PVmpsGwLcz51PZKluAdza8LWCIWq2cDw7VHQ',
    alt: 'Editorial architectural photo of sculptured helical limestone staircase in Lisbon skimmer in soft light',
    modifiedText: 'Modified Oct 20, 2024',
    resolution: '3840x2160 (4K)',
    width: 3840,
    height: 2160,
    fps: 30,
    codec: 'ProRes 4444 XQ',
    colorSpace: '10-bit HDR',
    tracks: '8 Tracks (3V / 5A)',
    footerStatus: 'Master Package Sealed',
    footerIcon: 'verified',
    footerSub: '',
  },
  {
    id: 'showcase-5',
    name: 'Kyoto Zen Architectural Vignette',
    category: 'drafts',
    statusBadge: 'Audio Master Stems Staged',
    badgeDotClass: 'bg-emerald-400',
    duration: '06:12',
    durationSeconds: 372,
    playheadProgress: 0.83,
    posterUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDu7h77Zcn3vNZKga_kV3dzDDf6TrUmass61hS_4zVnw7cIqxfgzoKCCpFsB2tGDGbIkodu1VgE_TmB8V0FVkyBqM6UhdOUqbPB0hCuI6CfzkkYPXMXm_IG7OaZc_W7_4oBKmDszDjcsZs02OUt4yEs-62pNXW0vaoEYQWiczBmqpWxpjJ7gX17pvs6Kx0Vxqy8Zw0IoMlRVJ2wGdGzuxNHHz_aagrbK-9H7vDHQ0TcbG1T0knA-OGSUg',
    alt: 'Japanese rock garden pavilion at dusk with water ripples in dark koi pond reflecting lantern glow',
    modifiedText: 'Modified Sep 28, 2024',
    resolution: '1920x1080 (FHD)',
    width: 1920,
    height: 1080,
    fps: 24,
    codec: 'ProRes 422',
    colorSpace: '5.1 Surround',
    tracks: '14 Tracks (4V / 10A)',
    footerStatus: 'Ambisonic Spatial Mix',
    footerIcon: 'eq',
    footerSub: '96kHz / 24-bit',
  },
  {
    id: 'showcase-6',
    name: 'Liquid Motion Macro Fluid Study',
    category: 'in-progress',
    statusBadge: 'VFX Pass 02 Complete',
    badgeDotClass: 'bg-emerald-400',
    duration: '01:45',
    durationSeconds: 105,
    playheadProgress: 0.66,
    posterUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBoQUYtLhq536AEVTrcjJ1rYdUu8RTx2VLNC8jpK51HIQbNGV8o86PHr9LZDFNBz8Z2QHZhbiOcpLFoqMixGmHSPZ7SCn4SKtQyfa5I676LYdAdgFbXG-GneeUL4tKfxRjO3mDWb33DQfCv5LyFfOTGUx73Emz1DIMpWaWolj3-_fsX89T1W0enTUnF9FGcUvZ9oQ6h0DztITNvRU_Eu_g7i1V0F316jcZsciVgNQSaNC4TRSfQnX7xUg',
    alt: 'Macro photography of viscous black obsidian fluid suspended in mid-air with high speed ripple reflections',
    modifiedText: 'Modified Sep 14, 2024',
    resolution: '3840x2160 (4K)',
    width: 3840,
    height: 2160,
    fps: 120,
    codec: 'Blackmagic RAW 12:1',
    colorSpace: 'Linear Rec.2020',
    tracks: '4 Tracks (1V / 3A)',
    footerStatus: 'OFX Node Graph Active',
    footerIcon: 'hub',
    footerSub: '',
  },
];

// ---------------------------------------------------------------------------
// Focus Trap Helper
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
// Card Context Menu
// ---------------------------------------------------------------------------

interface CardContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTimeline: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}

const CardContextMenu: React.FC<CardContextMenuProps> = ({
  isOpen,
  onClose,
  onOpenTimeline,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-9 w-60 rounded-xl bg-[#2c2928]/95 border border-[#373433] backdrop-blur-xl shadow-2xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => {
          onClose();
          onOpenTimeline();
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-stone-200 hover:bg-[#373433] hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clapperboard className="w-3.5 h-3.5 text-stone-300" />
          <span>Open Timeline Editor</span>
        </span>
        <span className="font-mono text-[10px] text-[#78716c]">⌘O</span>
      </button>

      <button
        onClick={() => {
          onClose();
          onRename();
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-stone-200 hover:bg-[#373433] hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2">
          <Pencil className="w-3.5 h-3.5 text-stone-300" />
          <span>Rename Project</span>
        </span>
      </button>

      <button
        onClick={() => {
          onClose();
          onDuplicate();
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-stone-200 hover:bg-[#373433] hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2">
          <Copy className="w-3.5 h-3.5 text-stone-300" />
          <span>Duplicate Timeline</span>
        </span>
        <span className="font-mono text-[10px] text-[#78716c]">⌘D</span>
      </button>

      <button
        onClick={() => {
          onClose();
          onExport();
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-stone-200 hover:bg-[#373433] hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2">
          <Share2 className="w-3.5 h-3.5 text-stone-300" />
          <span>Export Master Render</span>
        </span>
        <span className="font-mono text-[10px] text-[#78716c]">⇧⌘E</span>
      </button>

      <div className="my-1 border-t border-[#373433]" />

      <button
        onClick={() => {
          onClose();
          onDelete();
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Project</span>
        </span>
        <span className="font-mono text-[10px] text-red-400/70">⌫</span>
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Unified Project Item (Handles both user project & showcase)
// ---------------------------------------------------------------------------

interface UnifiedProjectCardProps {
  project: ShowcaseProject;
  onOpen: (id: string | number) => void;
  onRename: (project: ShowcaseProject) => void;
  onDuplicate: (project: ShowcaseProject) => void;
  onDelete: (project: ShowcaseProject) => void;
}

const UnifiedProjectCard: React.FC<UnifiedProjectCardProps> = ({
  project,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article
      onClick={() => onOpen(project.id)}
      className="group relative flex flex-col bg-[#1d1b1a] rounded-2xl overflow-hidden border border-[#2c2928] transition-all duration-300 hover:bg-[#211f1e] hover:border-stone-500/40 hover:shadow-2xl cursor-pointer"
    >
      {/* 16:9 Thumbnail Viewport */}
      <div className="relative w-full aspect-video bg-[#100e0d] overflow-hidden">
        <img
          src={project.posterUrl}
          alt={project.alt}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#100e0d]/90 via-transparent to-black/20 pointer-events-none" />

        {/* Top Overlay Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20">
          <span className="px-2.5 py-1 rounded-full bg-[#100e0d]/80 backdrop-blur-md text-[11px] font-mono text-stone-200 flex items-center gap-1.5 shadow-sm border border-stone-800/60">
            <span className={`w-1.5 h-1.5 rounded-full ${project.badgeDotClass} animate-pulse`} />
            <span>{project.statusBadge}</span>
          </span>

          {/* Context Menu Trigger */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="w-7 h-7 rounded-full bg-[#100e0d]/80 backdrop-blur-md flex items-center justify-center text-stone-300 hover:text-white hover:bg-[#2c2928] border border-stone-800/60 transition-colors"
            >
              <MoreVertical size={15} />
            </button>

            <CardContextMenu
              isOpen={menuOpen}
              onClose={() => setMenuOpen(false)}
              onOpenTimeline={() => onOpen(project.id)}
              onRename={() => onRename(project)}
              onDuplicate={() => onDuplicate(project)}
              onExport={() => onOpen(project.id)}
              onDelete={() => onDelete(project)}
            />
          </div>
        </div>

        {/* Timecode overlay pill */}
        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-[#100e0d]/90 backdrop-blur-md font-mono text-[11px] text-stone-200 font-medium tracking-wider border border-stone-800/60 z-10">
          {project.duration}
        </div>

        {/* Mini timeline scrub / playhead preview indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#373433] z-10">
          <div
            className="h-full bg-stone-300"
            style={{ width: `${Math.round(project.playheadProgress * 100)}%` }}
          />
          <div
            className="absolute -top-1 w-1.5 h-3 bg-white rounded-xs shadow-sm"
            style={{ left: `${Math.round(project.playheadProgress * 100)}%` }}
          />
        </div>

        {/* Hover Quick Action Overlay */}
        <div className="absolute inset-0 bg-[#151312]/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 z-10">
          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform transition-transform group-hover:scale-105">
            <Play className="w-5 h-5 ml-0.5 fill-current" />
          </div>
          <span className="text-xs font-mono font-medium text-stone-200 tracking-wide">
            Open in Timeline
          </span>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-lg font-serif font-normal text-[#f5f0ed] group-hover:text-white truncate">
              {project.name}
            </h2>
          </div>
          <p className="text-xs font-mono text-[#78716c] mb-4">{project.modifiedText}</p>

          {/* Technical Specs Badges */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="px-2 py-0.5 rounded-md bg-[#2c2928] text-stone-300 font-mono text-[11px] border border-[#373433]">
              {project.resolution}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#2c2928] text-stone-300 font-mono text-[11px] border border-[#373433]">
              {project.fps} FPS
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#2c2928] text-stone-300 font-mono text-[11px] border border-[#373433]">
              {project.codec}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#2c2928] text-stone-300 font-mono text-[11px] border border-[#373433]">
              {project.colorSpace}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#2c2928] text-stone-300 font-mono text-[11px] border border-[#373433]">
              {project.tracks}
            </span>
          </div>
        </div>

        {/* Multi-track sequence waveform graphic micro-visualizer */}
        <div className="w-full pt-3 border-t border-[#2c2928] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#a8a29e] text-xs font-mono">
            {project.footerIcon === 'progress' ? (
              <div className="w-14 h-1.5 rounded-full bg-[#373433] overflow-hidden">
                <div className="w-3/4 h-full bg-stone-300 rounded-full" />
              </div>
            ) : project.footerIcon === 'verified' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-stone-400" />
            ) : (
              <Activity className="w-3.5 h-3.5 text-stone-400" />
            )}
            <span>{project.footerStatus}</span>
          </div>
          {project.footerSub ? (
            <span className="font-mono text-[10px] text-[#78716c]">{project.footerSub}</span>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </div>
      </div>
    </article>
  );
};

// ---------------------------------------------------------------------------
// Create Project Modal (Prism Style)
// ---------------------------------------------------------------------------

interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (name: string, width: number, height: number, fps: number) => Promise<void>;
  initialPreset?: { name?: string; width?: number; height?: number; fps?: number };
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  onClose,
  onCreate,
  initialPreset,
}) => {
  const [name, setName] = useState(initialPreset?.name || 'Untitled Edit');
  const [resolutionIndex, setResolutionIndex] = useState(0);
  const [fps, setFps] = useState<number>(initialPreset?.fps || 24);
  const [colorSpace, setColorSpace] = useState('Rec.709 (Scene-Referred)');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useFocusTrap(dialogRef, true);

  const resolutionOptions = [
    { label: '3840 x 2160 (4K UHD)', width: 3840, height: 2160 },
    { label: '4096 x 2160 (4K DCI)', width: 4096, height: 2160 },
    { label: '1920 x 1080 (Full HD)', width: 1920, height: 1080 },
    { label: '1080 x 1920 (Vertical 9:16)', width: 1080, height: 1920 },
    { label: '1080 x 1080 (Square 1:1)', width: 1080, height: 1080 },
  ];

  useEffect(() => {
    if (initialPreset?.width && initialPreset?.height) {
      const idx = resolutionOptions.findIndex(
        (r) => r.width === initialPreset.width && r.height === initialPreset.height
      );
      if (idx !== -1) setResolutionIndex(idx);
    }
  }, [initialPreset]);

  useEffect(() => {
    nameInputRef.current?.select();
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim() || 'Untitled Edit';
    const chosenRes = resolutionOptions[resolutionIndex];
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onCreate(trimmed, chosenRes.width, chosenRes.height, fps);
      onClose();
    } catch {
      setSubmitError('Failed to initialize sequence. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [name, resolutionIndex, fps, onCreate, onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#1d1b1a] border border-[#2c2928] rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#2c2928]">
          <div className="flex items-center gap-2.5">
            <Clapperboard className="w-5 h-5 text-stone-200" />
            <h3 className="text-xl font-serif font-normal text-white">New Multi-Track Timeline</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#78716c] hover:text-white hover:bg-[#2c2928] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form
          className="space-y-4 pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#a8a29e] mb-2">
              Project Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kyoto Night Street Cut 01"
              className="w-full px-4 py-2.5 rounded-xl bg-[#151312] border border-[#2c2928] text-white font-sans text-sm focus:outline-none focus:border-stone-500 transition-colors placeholder:text-[#78716c]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#a8a29e] mb-2">
                Canvas Resolution
              </label>
              <select
                value={resolutionIndex}
                onChange={(e) => setResolutionIndex(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#151312] border border-[#2c2928] text-stone-200 text-xs font-mono focus:outline-none focus:border-stone-500 cursor-pointer"
              >
                {resolutionOptions.map((opt, i) => (
                  <option key={i} value={i}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#a8a29e] mb-2">
                Timebase / FPS
              </label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#151312] border border-[#2c2928] text-stone-200 text-xs font-mono focus:outline-none focus:border-stone-500 cursor-pointer"
              >
                <option value={24}>24.00 fps (Cinema)</option>
                <option value={23.976}>23.976 fps</option>
                <option value={29.97}>29.97 fps</option>
                <option value={30}>30.00 fps</option>
                <option value={60}>60.00 fps (High Smoothness)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#a8a29e] mb-2">
              Working Color Space
            </label>
            <select
              value={colorSpace}
              onChange={(e) => setColorSpace(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#151312] border border-[#2c2928] text-stone-200 text-xs font-mono focus:outline-none focus:border-stone-500 cursor-pointer"
            >
              <option value="Rec.709 (Scene-Referred)">Rec.709 (Scene-Referred)</option>
              <option value="ACEScg (Color Managed 1.3)">ACEScg (Color Managed 1.3)</option>
              <option value="Apple Log / Rec.2020">Apple Log / Rec.2020</option>
              <option value="Blackmagic Film Gen 5">Blackmagic Film Gen 5</option>
            </select>
          </div>

          {submitError && <p className="text-red-400 text-xs font-mono mt-2">{submitError}</p>}

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#2c2928]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-mono text-[#a8a29e] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-6 py-2.5 rounded-xl bg-white text-black font-medium text-xs tracking-wider uppercase hover:bg-stone-200 active:scale-[0.98] transition-all shadow-lg disabled:opacity-50"
            >
              {submitting ? 'Initializing…' : 'Initialize Sequence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Rename Project Modal
// ---------------------------------------------------------------------------

interface RenameModalProps {
  project: ShowcaseProject | VideoProject;
  onClose: () => void;
  onRename: (id: number | string, name: string) => Promise<void>;
}

const RenameProjectModal: React.FC<RenameModalProps> = ({ project, onClose, onRename }) => {
  const [name, setName] = useState(project.name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onRename(project.id, name.trim());
      onClose();
    } catch {
      setError('Failed to rename timeline.');
    } finally {
      setSubmitting(false);
    }
  }, [name, project, onRename, onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#1d1b1a] border border-[#2c2928] rounded-2xl p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#2c2928]">
          <h3 className="text-lg font-serif text-white">Rename Timeline</h3>
          <button onClick={onClose} className="text-[#78716c] hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div>
          <label className="block text-[11px] font-mono text-[#a8a29e] uppercase mb-1.5">
            Timeline Name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#151312] border border-[#2c2928] text-white text-sm focus:outline-none focus:border-stone-500"
          />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono text-[#a8a29e] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="px-5 py-2 rounded-xl bg-white text-black font-medium text-xs uppercase tracking-wider hover:bg-stone-200"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Delete Project Modal
// ---------------------------------------------------------------------------

interface DeleteModalProps {
  project: ShowcaseProject | VideoProject;
  onClose: () => void;
  onDelete: (id: number | string) => Promise<void>;
}

const DeleteProjectModal: React.FC<DeleteModalProps> = ({ project, onClose, onDelete }) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      await onDelete(project.id);
      onClose();
    } catch {
      setError('Failed to delete timeline.');
    } finally {
      setDeleting(false);
    }
  }, [project, onDelete, onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#1d1b1a] border border-red-500/20 rounded-2xl p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#2c2928]">
          <h3 className="text-lg font-serif text-white">Delete Project</h3>
          <button onClick={onClose} className="text-[#78716c] hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-stone-300 leading-relaxed font-sans">
            Are you sure you want to delete <span className="font-semibold text-white">{project.name}</span>? All sequence edit history and stems will be removed from local cache.
          </p>
        </div>
        {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
        <div className="flex justify-end gap-2.5 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono text-[#a8a29e] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium text-xs uppercase tracking-wider"
          >
            {deleting ? 'Deleting…' : 'Delete Project'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

type FilterCategory = 'all' | 'in-progress' | 'final' | 'drafts';
type SortKey = 'modified' | 'duration' | 'resolution' | 'framerate';

export const ProjectsDashboard: React.FC = () => {
  const {
    projects,
    isLoading,
    error,
    createProject,
    renameProject,
    deleteProject,
    refresh,
  } = useVideoProjects();
  const { logAction } = useTelemetry();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [sortBy, setSortBy] = useState<SortKey>('modified');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPreset, setCreatePreset] = useState<{ name?: string; width?: number; height?: number; fps?: number } | undefined>();
  const [renameTarget, setRenameTarget] = useState<ShowcaseProject | VideoProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShowcaseProject | VideoProject | null>(null);
  const [blueprintHighlighted, setBlueprintHighlighted] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const blueprintRef = useRef<HTMLDivElement>(null);

  const [activeProjectId, setActiveProjectId] = useState<string | number | null>(null);

  // Check if a project is active in URL route or local state
  const effectiveOpenProjectId = useMemo(() => {
    if (activeProjectId) return activeProjectId;
    const parts = location.pathname.split('/');
    if (parts[1] === 'projects' && parts[2]) {
      return parts[2];
    }
    return null;
  }, [location.pathname, activeProjectId]);

  const handleOpenProject = useCallback(
    async (id: number | string) => {
      const strId = String(id);
      if (strId.startsWith('showcase-')) {
        const showcase = SHOWCASE_PROJECTS.find((s) => s.id === strId);
        if (showcase) {
          try {
            const created = await createProject(
              showcase.name,
              showcase.width,
              showcase.height,
              showcase.fps
            );
            if (created?.id) {
              setActiveProjectId(created.id);
              navigate(`/projects/${created.id}`);
              return;
            }
          } catch {
            // fallback
          }
        }
      }
      setActiveProjectId(id);
      navigate(`/projects/${id}`);
    },
    [createProject, navigate]
  );

  const handleCloseProject = useCallback(() => {
    setActiveProjectId(null);
    navigate('/projects');
  }, [navigate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Combine real backend projects with showcase data if no backend projects exist,
  // or merge them smoothly.
  const allUnifiedProjects: ShowcaseProject[] = useMemo(() => {
    if (projects.length === 0) {
      return SHOWCASE_PROJECTS;
    }

    // Convert real backend projects into showcase-compatible structure
    const convertedBackendProjects: ShowcaseProject[] = projects.map((p, idx) => {
      const is4k = p.width >= 3840;
      const isVertical = p.height > p.width;
      const resLabel = is4k
        ? `${p.width}x${p.height} (4K)`
        : isVertical
        ? `${p.width}x${p.height} (Vertical 9:16)`
        : `${p.width}x${p.height} (FHD)`;

      return {
        id: String(p.uuid || p.id),
        name: p.name,
        category: (idx % 3 === 0 ? 'final' : idx % 3 === 1 ? 'in-progress' : 'drafts') as any,
        statusBadge: is4k ? 'Master Cut • 4K DCI' : 'Active Timeline',
        badgeDotClass: 'bg-emerald-400',
        duration: '04:12',
        durationSeconds: 252,
        playheadProgress: 0.5,
        posterUrl:
          SHOWCASE_PROJECTS[idx % SHOWCASE_PROJECTS.length].posterUrl,
        alt: p.name,
        modifiedText: `Modified ${formatRelativeTime(p.updated_at)} • Local NVMe`,
        resolution: resLabel,
        width: p.width,
        height: p.height,
        fps: p.fps,
        codec: 'ProRes 422',
        colorSpace: 'Rec.709',
        tracks: '8 Tracks (3V / 5A)',
        footerStatus: 'Timeline cache synchronized',
        footerIcon: 'eq',
        footerSub: `${p.fps} FPS`,
        isReal: true,
      };
    });

    return convertedBackendProjects;
  }, [projects]);

  // Filter & Search Logic
  const filteredProjects = useMemo(() => {
    let list = allUnifiedProjects;

    // Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.resolution.toLowerCase().includes(q) ||
          p.codec.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (filterCategory !== 'all') {
      list = list.filter((p) => p.category === filterCategory);
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sortBy === 'duration') return b.durationSeconds - a.durationSeconds;
      if (sortBy === 'resolution') return b.width - a.width;
      if (sortBy === 'framerate') return b.fps - a.fps;
      return 0; // default modified
    });
  }, [allUnifiedProjects, search, filterCategory, sortBy]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: allUnifiedProjects.length,
      'in-progress': allUnifiedProjects.filter((p) => p.category === 'in-progress').length,
      final: allUnifiedProjects.filter((p) => p.category === 'final').length,
      drafts: allUnifiedProjects.filter((p) => p.category === 'drafts').length,
    };
  }, [allUnifiedProjects]);

  // Handlers
  const handleDuplicate = useCallback(
    async (p: ShowcaseProject) => {
      logAction('ProjectsDashboard', 'duplicate_project', { name: p.name });
      await createProject(`${p.name} Copy`, p.width, p.height, p.fps);
    },
    [createProject, logAction]
  );

  const handleCreate = useCallback(
    async (name: string, width: number, height: number, fps: number) => {
      logAction('ProjectsDashboard', 'create_project', { name, width, height, fps });
      const newProj = await createProject(name, width, height, fps);
      if (newProj?.id) {
        navigate(`/projects/${newProj.id}`);
      }
    },
    [createProject, logAction, navigate]
  );

  const handleRename = useCallback(
    async (id: number | string, newName: string) => {
      await renameProject(id, newName);
    },
    [renameProject]
  );

  const handleDelete = useCallback(
    async (id: number | string) => {
      await deleteProject(id);
    },
    [deleteProject]
  );

  const toggleBlueprint = () => {
    setBlueprintHighlighted((prev) => !prev);
    blueprintRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Keyboard shortcut listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (e.key === 'n' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setCreatePreset(undefined);
        setShowCreateModal(true);
      }
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (showCreateModal || renameTarget || deleteTarget) return;
        if (search) setSearch('');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, renameTarget, deleteTarget, search]);

  // If a project is open, render the editor overlay
  if (effectiveOpenProjectId !== null) {
    return (
      <React.Suspense fallback={null}>
        <VideoEditorFromProject
          projectId={effectiveOpenProjectId}
          onClose={handleCloseProject}
        />
      </React.Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#151312] text-[#e8e1df] font-sans antialiased selection:bg-[#373433] selection:text-white pb-24 overflow-x-hidden">
      {/* Diffuse Atmospheric Vignettes Behind Layout */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-20 w-[550px] h-[550px] bg-gradient-to-br from-stone-400/10 via-transparent to-transparent rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-32 w-[600px] h-[600px] bg-gradient-to-bl from-stone-700/10 via-transparent to-transparent rounded-full blur-[160px]" />
      </div>

      <div className="max-w-[1500px] mx-auto px-6 sm:px-10 lg:px-12 pt-8 sm:pt-10 relative z-10">
        {/* ── Page Header Section ────────────────────────────────────────── */}
        <header className="pb-8 border-b border-[#2c2928]/60">
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
            {/* Title & Telemetry Group */}
            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-[11px] tracking-[0.2em] text-[#a8a29e] uppercase">
                  Non-Linear Editor
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1d1b1a] border border-[#2c2928] text-[#e8e1df] font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  <span>{allUnifiedProjects.length} Timelines Active</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1d1b1a] border border-[#2c2928] text-[#a8a29e] font-mono text-[11px]">
                  <HardDrive className="w-3.5 h-3.5 text-[#78716c]" />
                  <span>Local NVMe Render Cache: 184 GB</span>
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-serif tracking-tight text-[#f5f0ed] font-normal">
                Video Projects
              </h1>

              <p className="text-sm sm:text-base text-[#a8a29e] font-light leading-relaxed max-w-2xl">
                Non-linear multi-track editing timelines, client cutdowns, master color grades, and audio stems held in local sandbox storage.
              </p>
            </div>

            {/* Primary Action Group */}
            <div className="flex items-center gap-3 self-start xl:self-end">
              <button
                onClick={() => {
                  setCreatePreset(undefined);
                  setShowCreateModal(true);
                }}
                className="group relative inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-white text-black font-medium text-xs tracking-wider uppercase hover:shadow-[0_0_24px_rgba(245,245,244,0.25)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300"
              >
                <Clapperboard className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12" />
                <span>+ New Project</span>
              </button>
            </div>
          </div>

          {/* ── Filter Tabs, Sorting & View Toggle Bar ───────────────────── */}
          <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4">
            {/* Segmented Navigation Pills */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-[#100e0d] border border-[#2c2928] max-w-fit overflow-x-auto shadow-inner">
              {[
                { id: 'all', label: 'All Timelines', count: tabCounts.all },
                { id: 'in-progress', label: 'In Progress', count: tabCounts['in-progress'] },
                { id: 'final', label: 'Final Deliverables', count: tabCounts.final },
                { id: 'drafts', label: 'Drafts', count: tabCounts.drafts },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterCategory(tab.id as FilterCategory)}
                  className={`px-4 py-1.5 rounded-full text-xs font-mono transition-colors whitespace-nowrap ${
                    filterCategory === tab.id
                      ? 'bg-[#2c2928] text-white shadow-sm border border-stone-600/30'
                      : 'text-[#a8a29e] hover:text-stone-200'
                  }`}
                >
                  {tab.label} <span className="ml-1 opacity-60">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Controls: Search, Sort & Layout Toggle */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-3 text-[#78716c]" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter timelines… ⌘K"
                  className="pl-8 pr-3 py-1.5 rounded-full bg-[#1d1b1a] border border-[#2c2928] text-xs font-mono text-stone-200 placeholder:text-[#78716c] focus:outline-none focus:border-stone-500 w-44 sm:w-52 transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 text-[#78716c] hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="appearance-none bg-[#1d1b1a] border border-[#2c2928] text-stone-300 font-mono text-xs pl-3.5 pr-8 py-1.5 rounded-full focus:outline-none focus:border-stone-500 cursor-pointer transition-colors"
                >
                  <option value="modified">Sort: Last Modified</option>
                  <option value="duration">Sort: Timeline Duration</option>
                  <option value="resolution">Sort: Resolution</option>
                  <option value="framerate">Sort: Framerate</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#78716c]" />
              </div>

              {/* Grid vs List View Switchers */}
              <div className="flex items-center p-1 rounded-full bg-[#100e0d] border border-[#2c2928]">
                <button
                  onClick={() => setViewLayout('grid')}
                  aria-label="Grid View"
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    viewLayout === 'grid'
                      ? 'bg-[#2c2928] text-white shadow-sm'
                      : 'text-[#a8a29e] hover:text-white'
                  }`}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewLayout('list')}
                  aria-label="List View"
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    viewLayout === 'list'
                      ? 'bg-[#2c2928] text-white shadow-sm'
                      : 'text-[#a8a29e] hover:text-white'
                  }`}
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ── Main Content Area ─────────────────────────────────────────── */}
        <section className="py-8">
          {viewLayout === 'grid' ? (
            /* 3-Column Desktop Grid for Projects */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((proj) => (
                <UnifiedProjectCard
                  key={proj.id}
                  project={proj}
                  onOpen={handleOpenProject}
                  onRename={(p) => setRenameTarget(p)}
                  onDuplicate={(p) => handleDuplicate(p)}
                  onDelete={(p) => setDeleteTarget(p)}
                />
              ))}
            </div>
          ) : (
            /* Alternate List View (Dense Sequence Table) */
            <div className="flex flex-col space-y-2 mt-2">
              <div className="grid grid-cols-12 px-6 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
                <div className="col-span-5">Timeline Sequence</div>
                <div className="col-span-2">Resolution &amp; Frame</div>
                <div className="col-span-2">Format / Color</div>
                <div className="col-span-1">Duration</div>
                <div className="col-span-2 text-right">Modified</div>
              </div>

              <div className="divide-y divide-[#2c2928]/40 bg-[#1d1b1a] rounded-2xl border border-[#2c2928] overflow-hidden shadow-xl">
                {filteredProjects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleOpenProject(p.id)}
                    className="grid grid-cols-12 items-center px-6 py-4 hover:bg-[#221f1e] transition-colors cursor-pointer group"
                  >
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#2c2928] flex items-center justify-center text-stone-300 group-hover:text-white">
                        <Film className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-serif text-white truncate group-hover:text-stone-100">
                          {p.name}
                        </p>
                        <p className="text-[11px] font-mono text-[#78716c]">
                          {p.statusBadge} • {p.tracks}
                        </p>
                      </div>
                    </div>
                    <div className="col-span-2 font-mono text-[11px] text-stone-300">
                      {p.resolution} / {p.fps}fps
                    </div>
                    <div className="col-span-2 font-mono text-[11px] text-[#a8a29e]">
                      {p.codec} / {p.colorSpace}
                    </div>
                    <div className="col-span-1 font-mono text-[11px] text-white font-medium">
                      {p.duration}
                    </div>
                    <div className="col-span-2 text-right text-xs font-mono text-[#78716c]">
                      {p.modifiedText.split('•')[0]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Architectural Empty State Blueprint / Interactive Preview ─── */}
        <section
          ref={blueprintRef}
          className={`mt-8 pt-8 pb-16 border-t border-[#2c2928]/60 transition-all duration-300 ${
            blueprintHighlighted ? 'ring-2 ring-stone-400 rounded-3xl p-6 bg-stone-900/20' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
                Project Workspace Engine
              </span>
              <h2 className="text-xl sm:text-2xl font-serif text-[#f5f0ed]">
                Timeline Initializer &amp; Archival State
              </h2>
            </div>
            <button
              onClick={toggleBlueprint}
              className="px-4 py-1.5 rounded-full bg-[#1d1b1a] hover:bg-[#2c2928] text-stone-300 hover:text-white font-mono text-xs transition-colors flex items-center gap-2 border border-[#2c2928]"
            >
              <Code className="w-3.5 h-3.5 text-stone-400" />
              <span>{blueprintHighlighted ? 'Blueprint Highlighted' : 'Inspect Empty State Blueprint'}</span>
            </button>
          </div>

          <div className="relative rounded-2xl bg-[#1d1b1a] border border-[#2c2928] p-8 md:p-12 overflow-hidden shadow-2xl">
            <div className="max-w-xl mx-auto text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#2c2928] border border-[#373433] flex items-center justify-center text-white mb-6 shadow-inner">
                <Clapperboard className="w-7 h-7 text-stone-300" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-serif text-white mb-3">
                No Video Projects Initialized Yet
              </h3>
              <p className="text-xs sm:text-sm text-[#a8a29e] mb-8 leading-relaxed font-light">
                Assemble multi-track sequences, cut B-roll, sync dual-system audio stems, and export cinema masters directly from your local library.
              </p>
              <button
                onClick={() => {
                  setCreatePreset(undefined);
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-black font-medium text-xs tracking-wider uppercase transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg mb-8"
              >
                <Plus className="w-4 h-4" />
                <span>Create your first video project</span>
              </button>

              {/* Quick Template Preset Launchers */}
              <div className="w-full pt-6 border-t border-[#2c2928]/60">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#78716c] block mb-4">
                  Start with Cinema Presets
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      setCreatePreset({ name: '4K Cinema Sequence', width: 3840, height: 2160, fps: 24 });
                      setShowCreateModal(true);
                    }}
                    className="p-3.5 rounded-xl bg-[#151312] border border-[#2c2928] text-left hover:border-stone-500/50 hover:bg-[#221f1e] transition-colors"
                  >
                    <div className="text-xs font-mono font-medium text-stone-200 mb-0.5">
                      4K Cinema Timeline
                    </div>
                    <div className="font-mono text-[10px] text-[#78716c]">
                      3840x2160 • 24.00 fps
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setCreatePreset({ name: 'Vertical Reel 9:16', width: 1080, height: 1920, fps: 60 });
                      setShowCreateModal(true);
                    }}
                    className="p-3.5 rounded-xl bg-[#151312] border border-[#2c2928] text-left hover:border-stone-500/50 hover:bg-[#221f1e] transition-colors"
                  >
                    <div className="text-xs font-mono font-medium text-stone-200 mb-0.5">
                      Social Vertical 9:16
                    </div>
                    <div className="font-mono text-[10px] text-[#78716c]">
                      1080x1920 • 60.00 fps
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setCreatePreset({ name: 'HD Broadcast Cut', width: 1920, height: 1080, fps: 60 });
                      setShowCreateModal(true);
                    }}
                    className="p-3.5 rounded-xl bg-[#151312] border border-[#2c2928] text-left hover:border-stone-500/50 hover:bg-[#221f1e] transition-colors"
                  >
                    <div className="text-xs font-mono font-medium text-stone-200 mb-0.5">
                      Standard HD Master
                    </div>
                    <div className="font-mono text-[10px] text-[#78716c]">
                      1920x1080 • 59.94 fps
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateProjectModal
            key="create-modal"
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreate}
            initialPreset={createPreset}
          />
        )}
        {renameTarget && (
          <RenameProjectModal
            key="rename-modal"
            project={renameTarget}
            onClose={() => setRenameTarget(null)}
            onRename={handleRename}
          />
        )}
        {deleteTarget && (
          <DeleteProjectModal
            key="delete-modal"
            project={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
