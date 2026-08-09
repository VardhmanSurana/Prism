import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Download, Plus, Trash2, ChevronUp, ChevronDown, Sparkles, Upload, ImagePlus } from 'lucide-react';
import { Photo } from '@/types';
import { resolveUrl } from '@/constants';
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

const PAGE_SIZES: Record<PageSize, { width: number; height: number; label: string; dims: string }> = {
  a4: { width: 210, height: 297, label: 'A4', dims: '210×297 mm' },
  letter: { width: 216, height: 279, label: 'Letter', dims: '8.5×11 in' },
  square: { width: 200, height: 200, label: 'Square', dims: '8×8 in' },
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPages(createPages(photos, layout));
    }
  }, [isOpen, photos, layout]);

  const handleLayoutChange = useCallback((newLayout: PageLayout) => {
    setLayout(newLayout);
    setPages(createPages(photos, newLayout));
  }, [photos]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const uploadedPhotos: Photo[] = Array.from(files).map((file, idx) => ({
      id: `uploaded-${Date.now()}-${idx}`,
      url: URL.createObjectURL(file),
      path: file.name,
      width: 1200,
      height: 800,
      date: new Date().toISOString(),
      isFavorite: false,
      caption: file.name.replace(/\.[^/.]+$/, ''),
    }));

    const newPages = createPages(uploadedPhotos, layout);
    setPages(prev => [...prev, ...newPages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [layout]);

  const triggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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
        let layoutHtml = '';

        if (page.layout === '1-per-page') {
          const photo = page.photos[0];
          if (photo) {
            layoutHtml = `
              <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#111;position:relative;">
                <img src="${resolveUrl(photo.url)}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                ${includeCaptions && photo.caption ? `<div style="position:absolute;bottom:20px;left:20px;color:white;font-family:sans-serif;font-size:14px;background:rgba(0,0,0,0.6);padding:6px 12px;border-radius:6px;backdrop-filter:blur(4px);">${photo.caption}</div>` : ''}
              </div>`;
          }
        } else if (page.layout === '2-per-page') {
          layoutHtml = `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:12px;padding:20px;background:#111;">
            ${page.photos.map(photo => `
              <div style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#000;border-radius:8px;position:relative;">
                <img src="${resolveUrl(photo.url)}" style="width:100%;height:100%;object-fit:cover;" />
                ${includeCaptions && photo.caption ? `<div style="position:absolute;bottom:10px;left:10px;color:white;font-family:sans-serif;font-size:12px;background:rgba(0,0,0,0.6);padding:4px 8px;border-radius:4px;">${photo.caption}</div>` : ''}
              </div>
            `).join('')}
          </div>`;
        } else {
          layoutHtml = `<div style="width:100%;height:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:12px;padding:20px;background:#111;">
            ${page.photos.map(photo => `
              <div style="display:flex;align-items:center;justify-content:center;overflow:hidden;background:#000;border-radius:8px;position:relative;">
                <img src="${resolveUrl(photo.url)}" style="width:100%;height:100%;object-fit:cover;" />
                ${includeCaptions && photo.caption ? `<div style="position:absolute;bottom:8px;left:8px;color:white;font-family:sans-serif;font-size:10px;background:rgba(0,0,0,0.6);padding:3px 6px;border-radius:4px;">${photo.caption}</div>` : ''}
              </div>
            `).join('')}
          </div>`;
        }

        return `
          <div class="page" style="width:${dims.width}mm;height:${dims.height}mm;position:relative;overflow:hidden;page-break-after:always;">
            ${layoutHtml}
            <div style="position:absolute;bottom:10px;right:14px;color:rgba(255,255,255,0.4);font-size:10px;font-family:sans-serif;font-weight:500;">${pageIdx + 1} / ${pages.length}</div>
          </div>`;
      }).join('');

      printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Exported PDF Document</title>
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

  const currentDims = PAGE_SIZES[pageSize];
  const previewAspectRatio = currentDims.width / currentDims.height;

  return (
    <AnimatePresence>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 10 }}
          transition={springs.gentle}
          className="relative w-full max-w-5xl h-[88vh] flex flex-col bg-surface border border-white/10 rounded-2xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-950/60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <BookOpen size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">Create PDF</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-neutral-400">{photos.length} photos</span>
                  <span className="text-neutral-600">•</span>
                  <span className="text-xs text-blue-400 font-medium">{pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition-colors"
              title="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Sidebar Controls */}
            <div className="w-72 border-r border-white/10 p-5 flex flex-col gap-6 overflow-y-auto custom-scrollbar bg-neutral-950/30">
              {/* Layout Option */}
              <div>
                <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3 block">
                  Page Layout
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    {
                      id: '1-per-page' as PageLayout,
                      label: '1 / Page',
                      icon: (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                        </svg>
                      ),
                    },
                    {
                      id: '2-per-page' as PageLayout,
                      label: '2 / Page',
                      icon: (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="8" rx="1.5" />
                          <rect x="3" y="13" width="18" height="8" rx="1.5" />
                        </svg>
                      ),
                    },
                    {
                      id: '4-per-page' as PageLayout,
                      label: '4 / Page',
                      icon: (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="8" height="8" rx="1" />
                          <rect x="13" y="3" width="8" height="8" rx="1" />
                          <rect x="3" y="13" width="8" height="8" rx="1" />
                          <rect x="13" y="13" width="8" height="8" rx="1" />
                        </svg>
                      ),
                    },
                    {
                      id: 'mixed' as PageLayout,
                      label: 'Mixed',
                      icon: (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="8" rx="1.5" />
                          <rect x="3" y="13" width="8" height="8" rx="1" />
                          <rect x="13" y="13" width="8" height="8" rx="1" />
                        </svg>
                      ),
                    },
                  ]).map(({ id, label, icon }) => {
                    const isSelected = layout === id;
                    return (
                      <button
                        key={id}
                        onClick={() => handleLayoutChange(id)}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-colors 150ms ease, border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease text-center ${
                          isSelected
                            ? 'border-blue-500/80 bg-blue-500/10 text-white shadow-[0_0_14px_rgba(37,99,235,0.2)] ring-1 ring-blue-500/40'
                            : 'border-white/10 bg-white/[0.03] text-neutral-400 hover:border-white/20 hover:bg-white/5 hover:text-neutral-200'
                        }`}
                      >
                        <span className={isSelected ? 'text-blue-400' : 'text-neutral-400'}>{icon}</span>
                        <span className="text-[10px] font-semibold tracking-wide uppercase">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Page Size Segmented Button */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                    Page Size
                  </label>
                  <span className="text-[10px] font-mono text-neutral-500">{currentDims.dims}</span>
                </div>
                <div className="flex p-1 bg-neutral-900/80 border border-white/10 rounded-xl gap-1">
                  {Object.entries(PAGE_SIZES).map(([key, val]) => {
                    const isSelected = pageSize === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setPageSize(key as PageSize)}
                        className={`flex-1 py-2 px-2 rounded-lg text-xs transition-colors 150ms ease, background-color 150ms ease, transform 150ms cubic-bezier(0.23, 1, 0.32, 1) text-center ${
                          isSelected
                            ? 'bg-white text-neutral-950 font-bold shadow-md border border-white/20 scale-[1.02]'
                            : 'text-neutral-400 hover:text-white hover:bg-white/5 font-medium'
                        }`}
                      >
                        {val.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Captions Toggle */}
              <div className="flex items-center justify-between py-2 border-y border-white/5">
                <div>
                  <label className="text-xs font-medium text-neutral-200 block">Include Captions</label>
                  <span className="text-[10px] text-neutral-400 block">Show photo descriptions</span>
                </div>
                <button
                  onClick={() => setIncludeCaptions(!includeCaptions)}
                  className={`w-11 h-6 rounded-full transition-colors 150ms ease, background-color 150ms ease, box-shadow 150ms ease relative p-0.5 ${
                    includeCaptions ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]' : 'bg-white/15 hover:bg-white/20'
                  }`}
                >
                  <motion.div
                    className="w-5 h-5 rounded-full bg-white shadow-md"
                    animate={{ x: includeCaptions ? 20 : 0 }}
                    transition={springs.snappy}
                  />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="mt-auto pt-4 space-y-2.5">
                <button
                  onClick={triggerUpload}
                  className="w-full py-2.5 px-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:text-blue-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors 150ms ease, transform 150ms cubic-bezier(0.23, 1, 0.32, 1) active:scale-[0.98]"
                >
                  <ImagePlus size={15} />
                  Upload Images
                </button>
                <button
                  onClick={addPage}
                  className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors 150ms ease, transform 150ms cubic-bezier(0.23, 1, 0.32, 1) active:scale-[0.98]"
                >
                  <Plus size={15} />
                  Add Blank Page
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting || pages.length === 0}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-transform 150ms cubic-bezier(0.23, 1, 0.32, 1), opacity 150ms ease active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={15} />
                  {isExporting ? 'Preparing Print...' : 'Export PDF'}
                </button>
              </div>
            </div>

            {/* Main Page Preview Stage */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-black/40">
              <div className="space-y-10 max-w-xl mx-auto">
                {pages.map((page, pageIdx) => (
                  <motion.div
                    key={page.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={springs.gentle}
                    className="relative group"
                  >
                    {/* Page Bar */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-neutral-400 tracking-wider uppercase">
                          Page {pageIdx + 1}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 font-mono">
                          {PAGE_SIZES[pageSize].label} • {page.layout}
                        </span>
                      </div>
                      <button
                        onClick={() => removePage(pageIdx)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-neutral-500 hover:text-red-400 transition-colors"
                        title="Remove page"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Page Canvas Frame */}
                    <div
                      className="w-full bg-neutral-950 rounded-xl overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-transform 300ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 300ms ease"
                      style={{ aspectRatio: `${previewAspectRatio}` }}
                    >
                      {renderPagePreview(page, pageIdx)}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  function renderPagePreview(page: Page, pageIdx: number) {
    if (page.photos.length === 0) {
      return (
        <div
          onClick={triggerUpload}
          className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-neutral-500 border-2 border-dashed border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5 cursor-pointer transition-colors 200ms ease, border-color 200ms ease, background-color 200ms ease rounded-xl m-2 group/empty"
        >
          <Upload className="w-8 h-8 opacity-40 text-blue-400 group-hover/empty:scale-110 transition-transform" />
          <p className="text-xs font-medium text-neutral-300">Click to Upload Images</p>
          <p className="text-[11px] text-neutral-500 text-center">Select photos from your device to add to this page</p>
        </div>
      );
    }

    if (page.layout === '1-per-page') {
      const photo = page.photos[0];
      return (
        <div className="w-full h-full relative bg-neutral-950 group/photo flex items-center justify-center overflow-hidden">
          <img
            src={resolveUrl(photo.url)}
            alt=""
            className="w-full h-full object-contain"
          />
          {includeCaptions && photo.caption && (
            <div className="absolute bottom-4 left-4 right-4 text-white text-xs font-sans bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10 max-w-md">
              {photo.caption}
            </div>
          )}
          {/* Controls overlay */}
          <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover/photo:opacity-100 transition-opacity bg-black/70 backdrop-blur-md p-1 rounded-lg border border-white/10 shadow-lg">
            <button onClick={() => movePhoto(pageIdx, 0, 'up')} className="p-1 hover:bg-white/20 rounded text-neutral-300 hover:text-white" title="Move Up"><ChevronUp size={14} /></button>
            <button onClick={() => movePhoto(pageIdx, 0, 'down')} className="p-1 hover:bg-white/20 rounded text-neutral-300 hover:text-white" title="Move Down"><ChevronDown size={14} /></button>
            <button onClick={() => removePhoto(pageIdx, 0)} className="p-1 hover:bg-red-500/20 rounded text-red-400" title="Remove Photo"><Trash2 size={14} /></button>
          </div>
        </div>
      );
    }

    if (page.layout === '2-per-page') {
      return (
        <div className="w-full h-full flex flex-col gap-2 p-3 bg-neutral-950">
          {page.photos.map((photo, i) => (
            <div key={photo.id} className="flex-1 relative bg-neutral-900 rounded-lg overflow-hidden group/photo border border-white/5">
              <img src={resolveUrl(photo.url)} alt="" className="w-full h-full object-cover" />
              {includeCaptions && photo.caption && (
                <div className="absolute bottom-2 left-2 text-white text-[11px] font-sans bg-black/60 backdrop-blur-sm px-2 py-1 rounded border border-white/10">
                  {photo.caption}
                </div>
              )}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/photo:opacity-100 transition-opacity bg-black/70 backdrop-blur-md p-1 rounded-lg border border-white/10 shadow-lg">
                <button onClick={() => movePhoto(pageIdx, i, 'up')} className="p-1 hover:bg-white/20 rounded text-neutral-300 hover:text-white"><ChevronUp size={12} /></button>
                <button onClick={() => movePhoto(pageIdx, i, 'down')} className="p-1 hover:bg-white/20 rounded text-neutral-300 hover:text-white"><ChevronDown size={12} /></button>
                <button onClick={() => removePhoto(pageIdx, i)} className="p-1 hover:bg-red-500/20 rounded text-red-400"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="w-full h-full grid grid-cols-2 gap-2 p-3 bg-neutral-950">
        {page.photos.map((photo, i) => (
          <div key={photo.id} className="relative bg-neutral-900 rounded-lg overflow-hidden group/photo border border-white/5">
            <img src={resolveUrl(photo.url)} alt="" className="w-full h-full object-cover" />
            {includeCaptions && photo.caption && (
              <div className="absolute bottom-1.5 left-1.5 text-white text-[10px] font-sans bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/10">
                {photo.caption}
              </div>
            )}
            <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover/photo:opacity-100 transition-opacity bg-black/70 backdrop-blur-md p-0.5 rounded-md border border-white/10 shadow-lg">
              <button onClick={() => movePhoto(pageIdx, i, 'up')} className="p-0.5 hover:bg-white/20 rounded text-neutral-300 hover:text-white"><ChevronUp size={10} /></button>
              <button onClick={() => movePhoto(pageIdx, i, 'down')} className="p-0.5 hover:bg-white/20 rounded text-neutral-300 hover:text-white"><ChevronDown size={10} /></button>
              <button onClick={() => removePhoto(pageIdx, i)} className="p-0.5 hover:bg-red-500/20 rounded text-red-400"><Trash2 size={10} /></button>
            </div>
          </div>
        ))}
      </div>
    );
  }
};
