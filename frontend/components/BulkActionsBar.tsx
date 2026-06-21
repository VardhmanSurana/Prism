import { motion } from 'framer-motion';
import { X, FolderPlus, FolderMinus, Lock, Trash2, Heart, RotateCcw } from 'lucide-react';
import { ViewMode } from '../types';

interface BulkActionsBarProps {
  selectedCount: number;
  currentView: ViewMode;
  onClear: () => void;
  onAddToAlbum: () => void;
  onRemoveFromAlbum?: () => void;
  onToggleLock: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  isFavorited?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  currentView,
  onClear,
  onAddToAlbum,
  onRemoveFromAlbum,
  onToggleLock,
  onFavorite,
  onDelete,
  onRestore,
  isFavorited
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  const isTrashView = currentView === 'trash';

  return (
    <motion.div 
      initial={{ y: 100, x: '-50%', opacity: 0 }}
      animate={{ y: 0, x: '-50%', opacity: 1 }}
      exit={{ y: 100, x: '-50%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="absolute bottom-6 left-1/2 bg-surface border border-border rounded-full shadow-2xl px-6 py-3 flex items-center gap-6 z-30"
    >
      <div className="flex items-center gap-3 pr-4 border-r border-border">
        <button onClick={onClear} className="p-1 hover:bg-surfaceHover rounded-full transition-colors">
          <X size={20} className="text-gray-400" />
        </button>
        <span className="font-semibold text-white">{selectedCount} selected</span>
      </div>
      <div className="flex items-center gap-2">
        {isTrashView ? (
          <>
            <button 
              onClick={onRestore} 
              className="p-2 hover:bg-surfaceHover rounded-full text-gray-300 hover:text-green-400" 
              title="Restore to Gallery"
            >
              <RotateCcw size={20} />
            </button>
            <button 
              onClick={onDelete} 
              className="p-2 hover:bg-surfaceHover rounded-full text-gray-300 hover:text-red-400" 
              title="Delete Permanently"
            >
              <Trash2 size={20} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onFavorite}
              className={`p-2 hover:bg-surfaceHover rounded-full transition-all ${
                isFavorited ? 'text-rose-400' : 'text-gray-300 hover:text-rose-400'
              }`}
              title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              <Heart size={20} className={isFavorited ? 'fill-rose-400' : ''} />
            </button>
            {currentView === 'albums' && onRemoveFromAlbum && (
              <button 
                onClick={onRemoveFromAlbum} 
                className="p-2 hover:bg-surfaceHover rounded-full text-gray-300 hover:text-red-400" 
                title="Remove from Album"
              >
                <FolderMinus size={20} />
              </button>
            )}
            <button onClick={onAddToAlbum} className="p-2 hover:bg-surfaceHover rounded-full text-gray-300 hover:text-white" title="Add to Album">
              <FolderPlus size={20} />
            </button>
            <button 
              onClick={onToggleLock} 
              className="p-2 hover:bg-surfaceHover rounded-full text-gray-300 hover:text-white" 
              title={currentView === 'locked' ? "Unlock" : "Lock"}
            >
              <Lock size={20} className={currentView === 'locked' ? "text-primary" : ""} />
            </button>
            <button 
              onClick={onDelete} 
              className="p-2 hover:bg-surfaceHover rounded-full text-gray-300 hover:text-red-400" 
              title="Trash"
            >
              <Trash2 size={20} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
