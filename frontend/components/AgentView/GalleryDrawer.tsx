import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon } from 'lucide-react';
import { Photo } from '../../types';
import { GalleryDrawerProps } from './types';
import { resolveUrl } from '../../constants';

export const GalleryDrawer: React.FC<GalleryDrawerProps> = ({
  photos,
  isOpen,
  onClose,
  onPhotoClick,
  onClear
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-[58%] border-l border-white/5 flex flex-col h-full bg-[#050505]/95 backdrop-blur-2xl relative z-20 shadow-2xl"
        >
          {/* Drawer Header */}
          <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
            <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
              <ImageIcon size={16} className="text-white" />
              <span>Search Results ({photos.length} matches)</span>
            </h3>
            <div className="flex items-center gap-3">
              {photos.length > 0 && onClear && (
                <button
                  onClick={onClear}
                  className="text-xs text-gray-500 hover:text-white transition-colors mr-1 font-semibold"
                >
                  Clear Results
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                aria-label="Close panel"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Drawer Body - Photo Grid */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {photos.map((photo) => (
                  <motion.div
                    key={photo.id}
                    whileHover={{ y: -3, borderColor: 'rgba(255, 255, 255, 0.2)' }}
                    onClick={() => onPhotoClick(photo)}
                    className="aspect-square rounded-xl overflow-hidden cursor-pointer shadow-md border border-white/5 relative group bg-white/[0.02]"
                  >
                    <img
                      src={resolveUrl(photo.url)}
                      alt={photo.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-end">
                      <span className="text-[11px] font-bold text-white truncate">{photo.filename}</span>
                      {photo.date && (
                        <span className="text-[9px] text-gray-400 mt-0.5">
                          {new Date(photo.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {photo.search_explanation && photo.search_explanation.matched.length > 0 && (
                        <div className="mt-1 flex flex-col gap-0.5 border-t border-white/10 pt-1 text-[8px] text-gray-300">
                          {photo.search_explanation.matched.slice(0, 2).map((reason, rIdx) => (
                            <div key={rIdx} className="flex items-center gap-1 font-semibold">
                              <span className="text-white">✓</span>
                              <span className="truncate">{reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <span className="text-xs text-gray-500 font-medium">No results to display</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
