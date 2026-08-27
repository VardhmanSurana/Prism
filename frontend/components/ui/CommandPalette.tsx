import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  Image,
  FolderHeart,
  MapPin,
  Users,
  Star,
  Trash2,
  Settings,
  Upload,
  Lock,
  Palette,
  Bot,
  Wrench,
  X,
  ArrowRight,
  Clock,
  Camera,
  Download,
  Share2,
  RefreshCw,
  Grid3X3,
  LayoutList,
  SlidersHorizontal,
} from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

const CATEGORY_ORDER = [
  'Navigation',
  'Actions',
  'View',
  'Settings',
  'Help',
];

/**
 * CommandPalette - Renders command palette.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter and group commands
  /**
   * filteredCommands - Performs filtered commands.
   */
  const filteredCommands = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;

    return commands.filter((cmd) => {
      const searchText = [
        cmd.label,
        cmd.description,
        cmd.category,
        ...(cmd.keywords || []),
      ]
        .join(' ')
        .toLowerCase();
      return searchText.includes(q);
    });
  }, [commands, query]);

  /**
   * groupedCommands - Performs grouped commands.
   */
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    }
    // Sort by category order
    return CATEGORY_ORDER.filter((cat) => groups[cat]).map((cat) => ({
      category: cat,
      items: groups[cat],
    }));
  }, [filteredCommands]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(
    () => groupedCommands.flatMap((g) => g.items),
    [groupedCommands]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatItems[selectedIndex]) {
            flatItems[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            setSelectedIndex((i) => Math.max(i - 1, 0));
          } else {
            setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
          }
          break;
      }
    },
    [flatItems, selectedIndex, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            className="relative w-full max-w-[560px] mx-4 bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
              <Search className="w-5 h-5 text-zinc-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-800 border border-zinc-700 rounded">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="max-h-[360px] overflow-y-auto overscroll-contain"
              role="listbox"
            >
              {flatItems.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-zinc-500">
                  No commands found
                </div>
              )}

              {groupedCommands.map((group) => (
                <div key={group.category}>
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-900/50">
                    {group.category}
                  </div>
                  {group.items.map((item) => {
                    const globalIndex = flatItems.indexOf(item);
                    const isSelected = globalIndex === selectedIndex;
                    return (
                      <div
                        key={item.id}
                        data-index={globalIndex}
                        role="option"
                        aria-selected={isSelected}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-600/20 text-blue-400'
                            : 'text-zinc-300 hover:bg-zinc-800/50'
                        }`}
                        onClick={() => {
                          item.action();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <span className={`shrink-0 ${isSelected ? 'text-blue-400' : 'text-zinc-400'}`}>
                          {item.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {item.label}
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-zinc-500 truncate">
                              {item.description}
                            </div>
                          )}
                        </div>
                        {item.shortcut && (
                          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-800 border border-zinc-700 rounded shrink-0">
                            {item.shortcut}
                          </kbd>
                        )}
                        <ArrowRight
                          className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                            isSelected ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 text-[10px] text-zinc-500">
              <span>{flatItems.length} commands</span>
              <div className="flex items-center gap-2">
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>esc close</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// ─── Default Commands ────────────────────────────────────────────────────────

/**
 * buildDefaultCommands - Performs build default commands.
 */
export function buildDefaultCommands(actions: {
  onNavigate: (view: string) => void;
  onUpload: () => void;
  onSearch: (query: string) => void;
  onToggleLock: () => void;
}): CommandItem[] {
  return [
    // Navigation
    {
      id: 'nav:gallery',
      label: 'Go to Gallery',
      description: 'View all photos',
      icon: <Image className="w-4 h-4" />,
      shortcut: '1',
      category: 'Navigation',
      action: () => actions.onNavigate('gallery'),
      keywords: ['photos', 'home', 'main'],
    },
    {
      id: 'nav:albums',
      label: 'Go to Albums',
      description: 'Browse photo albums',
      icon: <FolderHeart className="w-4 h-4" />,
      shortcut: '2',
      category: 'Navigation',
      action: () => actions.onNavigate('albums'),
      keywords: ['collections', 'groups'],
    },
    {
      id: 'nav:people',
      label: 'Go to People',
      description: 'Face recognition & people',
      icon: <Users className="w-4 h-4" />,
      shortcut: '3',
      category: 'Navigation',
      action: () => actions.onNavigate('people'),
      keywords: ['faces', 'recognition'],
    },
    {
      id: 'nav:map',
      label: 'Go to Map View',
      description: 'Photos by location',
      icon: <MapPin className="w-4 h-4" />,
      shortcut: '4',
      category: 'Navigation',
      action: () => actions.onNavigate('map'),
      keywords: ['location', 'geo', 'places'],
    },
    {
      id: 'nav:favorites',
      label: 'Go to Favorites',
      description: 'View starred photos',
      icon: <Star className="w-4 h-4" />,
      shortcut: '5',
      category: 'Navigation',
      action: () => actions.onNavigate('favorites'),
      keywords: ['starred', 'liked'],
    },
    {
      id: 'nav:trash',
      label: 'Go to Trash',
      description: 'View deleted photos',
      icon: <Trash2 className="w-4 h-4" />,
      shortcut: '6',
      category: 'Navigation',
      action: () => actions.onNavigate('trash'),
      keywords: ['deleted', 'bin'],
    },
    {
      id: 'nav:agent',
      label: 'Go to AI Agent',
      description: 'Chat with Prism AI',
      icon: <Bot className="w-4 h-4" />,
      shortcut: '7',
      category: 'Navigation',
      action: () => actions.onNavigate('agent'),
      keywords: ['ai', 'chat', 'assistant'],
    },

    // Actions
    {
      id: 'action:upload',
      label: 'Upload Photos',
      description: 'Import photos from file system',
      icon: <Upload className="w-4 h-4" />,
      shortcut: 'U',
      category: 'Actions',
      action: actions.onUpload,
      keywords: ['import', 'add', 'file'],
    },
    {
      id: 'action:lock',
      label: 'Lock Folder',
      description: 'Toggle locked folder access',
      icon: <Lock className="w-4 h-4" />,
      shortcut: 'L',
      category: 'Actions',
      action: actions.onToggleLock,
      keywords: ['privacy', 'encrypted', 'vault'],
    },
    {
      id: 'action:settings',
      label: 'Open Settings',
      description: 'Application settings',
      icon: <Settings className="w-4 h-4" />,
      shortcut: ',',
      category: 'Settings',
      action: () => actions.onNavigate('utilities'),
      keywords: ['preferences', 'config'],
    },

    // View
    {
      id: 'view:grid',
      label: 'Grid View',
      description: 'Switch to grid layout',
      icon: <Grid3X3 className="w-4 h-4" />,
      category: 'View',
      action: () => actions.onNavigate('gallery'),
      keywords: ['layout', 'thumbnails'],
    },
    {
      id: 'view:list',
      label: 'List View',
      description: 'Switch to list layout',
      icon: <LayoutList className="w-4 h-4" />,
      category: 'View',
      action: () => actions.onNavigate('gallery'),
      keywords: ['layout', 'details'],
    },
  ];
}
