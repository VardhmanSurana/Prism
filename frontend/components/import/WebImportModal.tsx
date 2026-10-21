import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  X,
  Link2,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ClipboardPaste,
  Image as ImageIcon,
} from 'lucide-react';
import type { Photo } from '@/types';

export interface WebImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (url: string) => Promise<Photo | void>;
}

/**
 * WebImportModal - Dialog for ingesting web media URLs directly into local Prism archive.
 */
export const WebImportModal: React.FC<WebImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setStatus('idle');
      setErrorMessage('');
      setPreviewLoaded(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setPreviewLoaded(false);
    if (status === 'error') {
      setStatus('idle');
      setErrorMessage('');
    }
  }, [url]);

  if (!isOpen) return null;

  const isValidUrl = (str: string) => {
    try {
      const parsed = new URL(str.trim());
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetUrl = url.trim();
    if (!targetUrl || !isValidUrl(targetUrl)) {
      setStatus('error');
      setErrorMessage('Please enter a valid HTTP or HTTPS URL.');
      return;
    }

    try {
      setStatus('loading');
      setErrorMessage('');
      await onImport(targetUrl);
      setStatus('success');
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(
        err?.message || 'Failed to download media from the specified URL. Please check the link and try again.'
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const isImageCandidate =
    isValidUrl(url) &&
    /\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(url.trim());

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget && status !== 'loading') {
            onClose();
          }
        }}
        onKeyDown={handleKeyDown}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-lg bg-[#181514] border border-[#292524] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8)] text-[#f5f5f4] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#292524]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#23201e] border border-[#292524] flex items-center justify-center text-[#f5f5f4] shadow-inner">
                <Globe size={18} className="text-[#a8a29e]" />
              </div>
              <div>
                <h3 className="font-serif text-lg tracking-tight text-[#f5f5f4] font-medium">
                  Import from Web
                </h3>
                <p className="text-xs text-[#78716c]">
                  Download online media directly into your archive
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={status === 'loading'}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#78716c] hover:text-[#f5f5f4] hover:bg-[#23201e] transition-colors disabled:opacity-40 cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
            <div>
              <label
                htmlFor="web-import-url"
                className="block text-xs font-medium text-[#a8a29e] mb-2 uppercase tracking-wider font-mono text-[10px]"
              >
                Media Web Address (URL)
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-[#78716c] pointer-events-none">
                  <Link2 size={16} />
                </div>
                <input
                  id="web-import-url"
                  ref={inputRef}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={status === 'loading'}
                  placeholder="https://images.unsplash.com/... or direct image link"
                  className="w-full bg-[#0c0a09] border border-[#292524] rounded-xl pl-10 pr-20 py-2.5 text-xs text-[#f5f5f4] placeholder-[#78716c] focus:outline-none focus:border-[#78716c] focus:ring-1 focus:ring-[#78716c] transition-all"
                  autoComplete="off"
                />

                <div className="absolute right-2 flex items-center gap-1">
                  {url ? (
                    <button
                      type="button"
                      onClick={() => setUrl('')}
                      disabled={status === 'loading'}
                      className="p-1 text-[#78716c] hover:text-[#f5f5f4] transition-colors"
                      title="Clear"
                    >
                      <X size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#a8a29e] hover:text-[#f5f5f4] bg-[#1c1917] hover:bg-[#23201e] rounded-md border border-[#292524] transition-colors cursor-pointer"
                      title="Paste from clipboard"
                    >
                      <ClipboardPaste size={12} />
                      <span>Paste</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Live Image Preview (when available) */}
            {isImageCandidate && (
              <div className="p-3 bg-[#0c0a09] border border-[#292524] rounded-xl flex items-center gap-3 overflow-hidden">
                <div className="w-12 h-12 rounded-lg bg-[#1c1917] overflow-hidden shrink-0 flex items-center justify-center border border-[#292524]">
                  <img
                    src={url}
                    alt="Preview"
                    className={`w-full h-full object-cover transition-opacity duration-200 ${
                      previewLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    onLoad={() => setPreviewLoaded(true)}
                    onError={() => setPreviewLoaded(false)}
                  />
                  {!previewLoaded && <ImageIcon size={18} className="text-[#78716c]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#f5f5f4] font-medium truncate">
                    {url.split('/').pop()?.split('?')[0] || 'Remote media item'}
                  </div>
                  <div className="text-[10px] text-[#78716c] flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                    <span>Direct web media candidate detected</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {status === 'error' && (
              <div className="p-3 rounded-xl bg-red-950/30 border border-red-900/50 flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-400" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            {/* Format support footer hint */}
            <div className="text-[11px] text-[#78716c] flex items-center justify-between pt-1">
              <span>Supports JPG, PNG, WebP, AVIF, GIF, & MP4</span>
              <span className="font-mono text-[10px]">Local Vault Ingestion</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#292524]">
              <button
                type="button"
                onClick={onClose}
                disabled={status === 'loading'}
                className="px-4 py-2 rounded-xl text-xs text-[#a8a29e] hover:text-[#f5f5f4] hover:bg-[#23201e] transition-colors cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!url.trim() || status === 'loading' || status === 'success'}
                className="px-4 py-2 rounded-xl bg-[#f5f5f4] text-[#0c0a09] text-xs font-semibold hover:bg-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.12)] active:scale-95"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-[#0c0a09]" />
                    <span>Downloading...</span>
                  </>
                ) : status === 'success' ? (
                  <>
                    <CheckCircle2 size={14} className="text-[#0c0a09]" />
                    <span>Imported!</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Import to Library</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
