import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, BookOpen, Download, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Photo } from '@/types';
import { resolveUrl } from '@/constants';
import { GlassMaterial } from '@/components/ui/GlassMaterial';
import { springs } from '@/lib/motion-tokens';

type PageLayout = '1-per-page' | '2-per-page' | '4-per-page' | 'mixed';
type PageSize = 'a4' | 'letter' | 'square';

interface Page {
  id: string;
  photos: Photo[];
  layout: PageLayout;
}

interface PhotoBookProps {
  photos: Photo[];
  isOpen: boolean;
  onClose: () => void;
}

const PAGE_SIZES: Record<PageSize, { width: number; height: number; label: string }> = {
  a4: { width: 210, height: 297, label: 'A4' },
  letter: { width: 216, height: 279, label: 'Letter' },
  square: { width: 200, height: 200, label: 'Square' },
};

function createPages(photos: Photo[], layout: PageLayout): Page[] {
  if (layout === 'mixed') {
    const pages: Page[] = [];
    const patterns: PageLayout[] = ['1-per-page', '2-per-page', '4-per-page'];
    let idx = 0;
    let patternIdx = 0;

    while (idx < photos.length) {
      const currentLayout = patterns[patternIdx % patterns.length];
      const count = currentLayout === '1-per-page' ? 1 : currentLayout === '2-per-page' ? 2 : 4;
      const pagePhotos = photos.slice(idx, idx + count);
      if (pagePhotos.length > 0) {
        pages.push({
          id: `page-${pages.length}`,
          photos: pagePhotos,
          layout: currentLayout,
        });
      }
      idx += count;
      patternIdx++;
    }
    return pages;
  }

  const perPage = layout === '1-per-page' ? 1 : layout === '2-per-page' ? 2 : 4;
  const pages: Page[] = [];
  for (let i = 0; i < photos.length; i += perPage) {
    pages.push({
      id: `page-${pages.length}`,
      photos: photos.slice(i, i + perPage),
      layout,
    });
  }
  return pages;
}

export const PhotoBook: React.FC<PhotoBookProps> = ({ photos, isOpen, onClose }) => {
  const [pages, setPages] = useState<Page[]>([]);
  const [layout, setLayout] = useState<PageLayout>('1-per-page');
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [includeCaptions, setIncludeCaptions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPages(createPages(photos, layout));
    }
  }, [isOpen, photos, layout]);

  const handleLayoutChange = useCallback((newLayout: PageLayout) => {
    setLayout(newLayout);
    setPages(createPages(photos, newLayout));
  }, [photos]);

  const movePhoto = useCallback((pageIdx: number, photoIdx: number, direction: 'up' | 'down') => {
    setPages(prev => {
      const next = [...prev];
      const page = { ...next[pageIdx], photos: [...next[pageIdx].photos] };
      const targetIdx = direction === 'up' ? photoIdx - 1 : photoIdx + 1;

      if (targetIdx < 0 || targetIdx >= page.photos.length) {
        if (direction === 'up' && pageIdx > 0) {
          const prevPage = { ...next[pageIdx - 1], photos: [...next[pageIdx - 1].photos] };
          const [moved] = page.photos.splice(photoIdx, 1);
          prevPage.photos.push(moved);
          next[pageIdx - 1] = prevPage;
        } else if (direction === 'down' && pageIdx < next.length - 1) {
          const nextPage = { ...next[pageIdx + 1], photos: [...next[pageIdx + 1].photos] };
          const [moved] = page.photos.splice(photoIdx, 1);
          nextPage.photos.unshift(moved);
          next[pageIdx + 1] = nextPage;
        }
      } else {
        [page.photos[photoIdx], page.photos[targetIdx]] = [page.photos[targetIdx], page.photos[photoIdx]];
      }

      next[pageIdx] = page;
      return next.filter(p => p.photos.length > 0);
    });
  }, []);

  const removePhoto = useCallback((pageIdx: number, photoIdx: number) => {
    setPages(prev => {
      const next = prev.map((p, i) => i === pageIdx ? { ...p, photos: p.photos.filter((_, j) => j !== photoIdx) } : p);
      return next.filter(p => p.photos.length > 0);
    });
  }, []);

  const addPage = useCallback(() => {
    setPages(prev => [...prev, {
      id: `page-${Date.now()}`,
      photos: [],
      layout: '1-per-page',
    }]);
  }, []);

  const removePage = useCallback((pageIdx: number) => {
    setPages(prev => prev.filter((_, i) => i !== pageIdx));
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const dims = PAGE_SIZES[pageSize];
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const pageHtml = pages.map((page, pageIdx) => {
        const aspect = dims.width / dims.height;
        let layoutHtml = '';

        if (page.layout === '1-per-page') {
          const photo = page.photos[0];
          if (photo) {
            layoutHtml = `
              <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#111;">
                <img src="${resolveUrl(photo.url)}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                ${includeCaptions && photo.caption ? `<div style="position:absolute;bottom:20px;left:20px;color:white;font-family:serif;font-size:14px;text-shadow:0 1px 4px rgba(0,0,0,0.8)">${photo.caption}</div>` : ''}
              </div>`;
          }
        } else if (page.layout === '2-per-page') {
          layoutHtml = `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:16px;background:#111;">
            ${page.photos.map(photo => `
              <div style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#000;border-radius:4px;">
                <img src="${resolveUrl(photo.url)}" style="width:100%;height:100%;object-fit:cover;" />
                ${includeCaptions && photo.caption ? `<div style="position:absolute;bottom:8px;left:8px;color:white;font-family:serif;font-size:11px;text-shadow:0 1px 3px rgba(0,0,0,0.8)">${photo.caption}</div>` : ''}
              </div>
            `).join('')}
          </div>`;
        } else {
          layoutHtml = `<div style="width:100%;height:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:8px;padding:16px;background:#111;">
            ${page.photos.map(photo => `
              <div style="display:flex;align-items:center;justify-content:center;overflow:hidden;background:#000;border-radius:4px;">
                <img src="${resolveUrl(photo.url)}" style="width:100%;height:100%;object-fit:cover;" />
                ${includeCaptions && photo.caption ? `<div style="position:absolute;bottom:4px;left:4px;color:white;font-family:serif;font-size:9px;text-shadow:0 1px 2px rgba(0,0,0,0.8)">${photo.caption}</div>` : ''}
              </div>
            `).join('')}
          </div>`;
        }

        return `
          <div class="page" style="width:${dims.width}mm;height:${dims.height}mm;position:relative;overflow:hidden;page-break-after:always;">
            ${layoutHtml}
            <div style="position:absolute;bottom:8px;right:12px;color:rgba(255,255,255,0.3);font-size:9px;font-family:sans-serif;">${pageIdx + 1} / ${pages.length}</div>
          </div>`;
      }).join('');

      printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Photo Book</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#000; }
  @page { size: ${dims.width}mm ${dims.height}mm; margin:0; }
  .page { page-break-after:always; }
</style></head><body>${pageHtml}</body></html>`);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
        setIsExporting(false);
      }, 500);
    } catch {
      setIsExporting(false);
    }
  }, [pages, pageSize, includeCaptions]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={springs.gentle}
        className="relative w-full max-w-5xl h-[85vh] mx-4 flex flex-col bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <BookOpen size={20} className="text-primary" />
            <h2 className="text-lg font-bold text-white">Photo Book</h2>
            <span className="text-sm text-gray-400">{photos.length} photos, {pages.length} pages</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surfaceHover rounded-full text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-72 border-r border-border p-4 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Page Layout</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: '1-per-page' as PageLayout, label: '1/Page', icon: '■' },
                  { id: '2-per-page' as PageLayout, label: '2/Page', icon: '▮▮' },
                  { id: '4-per-page' as PageLayout, label: '4/Page', icon: '▥' },
                  { id: 'mixed' as PageLayout, label: 'Mixed', icon: '⊞' },
                ]).map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => handleLayoutChange(id)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      layout === id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-white/5 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <span className="text-lg block mb-1">{icon}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Page Size</label>
              <div className="flex gap-2">
                {Object.entries(PAGE_SIZES).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setPageSize(key as PageSize)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      pageSize === key
                        ? 'bg-primary text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {val.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Captions</label>
              <button
                onClick={() => setIncludeCaptions(!includeCaptions)}
                className={`w-10 h-6 rounded-full transition-all ${
                  includeCaptions ? 'bg-primary' : 'bg-white/20'
                }`}
              >
                <motion.div
                  className={`w-5 h-5 rounded-full shadow-sm ${includeCaptions ? 'bg-white' : 'bg-gray-300'}`}
                  animate={{ x: includeCaptions ? 18 : 2 }}
                  transition={springs.snappy}
                />
              </button>
            </div>

            <div className="mt-auto pt-4 space-y-2">
              <GlassMaterial intensity="regular" interactive borderRadius="12px" className="w-full">
                <button
                  onClick={addPage}
                  className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-white"
                >
                  <Plus size={16} />
                  Add Blank Page
                </button>
              </GlassMaterial>
              <GlassMaterial intensity="regular" interactive borderRadius="12px" className="w-full">
                <button
                  onClick={handleExport}
                  disabled={isExporting || pages.length === 0}
                  className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  <Download size={16} />
                  {isExporting ? 'Opening Print...' : 'Export PDF'}
                </button>
              </GlassMaterial>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="space-y-8 max-w-2xl mx-auto">
              {pages.map((page, pageIdx) => (
                <motion.div
                  key={page.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springs.gentle}
                  className="relative"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Page {pageIdx + 1}</span>
                    <button
                      onClick={() => removePage(pageIdx)}
                      className="p-1 hover:bg-surfaceHover rounded text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="bg-black rounded-xl overflow-hidden border border-border shadow-lg">
                    {renderPagePreview(page, pageIdx)}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  function renderPagePreview(page: Page, pageIdx: number) {
    if (page.photos.length === 0) {
      return (
        <div className="aspect-[3/4] flex items-center justify-center text-gray-600 text-sm">
          Drop photos here
        </div>
      );
    }

    if (page.layout === '1-per-page') {
      const photo = page.photos[0];
      return (
        <div className="aspect-[3/4] relative bg-black">
          <img
            src={resolveUrl(photo.url)}
            alt=""
            className="w-full h-full object-contain"
          />
          {includeCaptions && photo.caption && (
            <div className="absolute bottom-3 left-3 text-white text-xs font-serif italic drop-shadow-lg">
              {photo.caption}
            </div>
          )}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <button onClick={() => movePhoto(pageIdx, 0, 'up')} className="p-1 bg-black/60 rounded text-white hover:bg-black/80"><ChevronUp size={12} /></button>
            <button onClick={() => movePhoto(pageIdx, 0, 'down')} className="p-1 bg-black/60 rounded text-white hover:bg-black/80"><ChevronDown size={12} /></button>
            <button onClick={() => removePhoto(pageIdx, 0)} className="p-1 bg-black/60 rounded text-red-400 hover:bg-black/80"><Trash2 size={12} /></button>
          </div>
        </div>
      );
    }

    if (page.layout === '2-per-page') {
      return (
        <div className="aspect-[3/4] flex flex-col gap-1 p-2 bg-black">
          {page.photos.map((photo, i) => (
            <div key={photo.id} className="flex-1 relative bg-neutral-900 rounded overflow-hidden">
              <img src={resolveUrl(photo.url)} alt="" className="w-full h-full object-cover" />
              {includeCaptions && photo.caption && (
                <div className="absolute bottom-1 left-1 text-white text-[10px] font-serif italic drop-shadow-lg">
                  {photo.caption}
                </div>
              )}
              <div className="absolute top-1 right-1 flex flex-col gap-0.5">
                <button onClick={() => movePhoto(pageIdx, i, 'up')} className="p-0.5 bg-black/60 rounded text-white hover:bg-black/80"><ChevronUp size={10} /></button>
                <button onClick={() => movePhoto(pageIdx, i, 'down')} className="p-0.5 bg-black/60 rounded text-white hover:bg-black/80"><ChevronDown size={10} /></button>
                <button onClick={() => removePhoto(pageIdx, i)} className="p-0.5 bg-black/60 rounded text-red-400 hover:bg-black/80"><Trash2 size={10} /></button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="aspect-[3/4] grid grid-cols-2 gap-1 p-2 bg-black">
        {page.photos.map((photo, i) => (
          <div key={photo.id} className="relative bg-neutral-900 rounded overflow-hidden">
            <img src={resolveUrl(photo.url)} alt="" className="w-full h-full object-cover" />
            <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5">
              <button onClick={() => movePhoto(pageIdx, i, 'up')} className="p-0.5 bg-black/60 rounded text-white hover:bg-black/80"><ChevronUp size={8} /></button>
              <button onClick={() => movePhoto(pageIdx, i, 'down')} className="p-0.5 bg-black/60 rounded text-white hover:bg-black/80"><ChevronDown size={8} /></button>
              <button onClick={() => removePhoto(pageIdx, i)} className="p-0.5 bg-black/60 rounded text-red-400 hover:bg-black/80"><Trash2 size={8} /></button>
            </div>
          </div>
        ))}
      </div>
    );
  }
};
