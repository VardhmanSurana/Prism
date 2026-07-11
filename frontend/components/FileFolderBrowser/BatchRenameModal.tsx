import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { API_BASE } from '../../constants';
import { buildRenamePreview, PATTERN_HELP } from './renamePattern';

interface BatchRenameModalProps {
  paths: string[];
  onClose: () => void;
  onComplete: () => void;
}

export const BatchRenameModal: React.FC<BatchRenameModalProps> = ({
  paths,
  onClose,
  onComplete,
}) => {
  const [pattern, setPattern] = useState('Vacation_{nnn}');
  const [startIndex, setStartIndex] = useState(1);
  const [preserveExtension, setPreserveExtension] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const preview = useMemo(
    () => buildRenamePreview(paths, pattern, startIndex, preserveExtension),
    [paths, pattern, startIndex, preserveExtension]
  );

  const errorCount = preview.filter((p) => !p.ok).length;
  const changeCount = preview.filter((p) => p.ok && !p.skipped).length;
  const canApply = changeCount > 0 && errorCount === 0 && pattern.trim().length > 0;

  const handleApply = async () => {
    if (!canApply || isSubmitting) return;
    setIsSubmitting(true);
    setServerError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/utilities/batch-rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paths,
          pattern: pattern.trim(),
          start_index: startIndex,
          dry_run: false,
          preserve_extension: preserveExtension,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.detail;
        const message =
          typeof detail === 'string'
            ? detail
            : detail?.message || `Rename failed (${res.status})`;
        setServerError(message);
        return;
      }

      onComplete();
    } catch {
      setServerError('Connection to backend failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 8 }}
        className="relative w-full max-w-lg bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[min(560px,90vh)]"
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-white/95 uppercase tracking-wider">
              Batch rename
            </h3>
            <p className="text-[10px] text-white/40 font-mono mt-0.5">
              {paths.length} file{paths.length === 1 ? '' : 's'} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          <label className="block space-y-1">
            <span className="text-[10px] font-mono uppercase text-white/40">Pattern</span>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              autoFocus
              className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              placeholder="Vacation_{nnn}"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {PATTERN_HELP.map((h) => (
              <button
                key={h.token}
                type="button"
                title={h.meaning}
                onClick={() => setPattern((p) => p + h.token)}
                className="px-2 py-0.5 text-[10px] font-mono rounded-md border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                {h.token}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[10px] font-mono uppercase text-white/50">
              Start at
              <input
                type="number"
                min={0}
                value={startIndex}
                onChange={(e) => setStartIndex(Math.max(0, Number(e.target.value) || 0))}
                className="w-16 bg-[#141414] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-primary/40"
              />
            </label>
            <label className="flex items-center gap-2 text-[10px] text-white/50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={preserveExtension}
                onChange={(e) => setPreserveExtension(e.target.checked)}
                className="rounded border-white/10 bg-transparent text-primary focus:ring-0 w-3 h-3"
              />
              Keep original extension
            </label>
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-3 py-1.5 bg-white/[0.03] text-[9px] font-mono uppercase text-white/35">
              <span>Original</span>
              <span />
              <span>New name</span>
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-white/5">
              {preview.map((row) => (
                <div
                  key={row.sourcePath}
                  className={`grid grid-cols-[1fr_auto_1fr] gap-2 px-3 py-1.5 text-[11px] items-center
                    ${!row.ok ? 'bg-red-500/5' : row.skipped ? 'opacity-50' : ''}`}
                >
                  <span className="truncate text-white/50 font-mono" title={row.sourceName}>
                    {row.sourceName}
                  </span>
                  <span className="text-white/20">→</span>
                  <span
                    className={`truncate font-mono ${
                      !row.ok ? 'text-red-400' : row.skipped ? 'text-white/40' : 'text-primary'
                    }`}
                    title={row.error || row.destName}
                  >
                    {row.ok ? row.destName : row.error || row.destName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {serverError && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <p className="text-[10px] text-white/35 font-mono">
            {changeCount} will rename
            {errorCount > 0 ? ` · ${errorCount} error${errorCount === 1 ? '' : 's'}` : ''}
            {preview.some((p) => p.skipped)
              ? ` · ${preview.filter((p) => p.skipped).length} unchanged`
              : ''}
          </p>
        </div>

        <div className="p-4 border-t border-white/5 flex justify-end gap-2 shrink-0 bg-[#080808]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-1.5 border border-white/10 text-white/70 hover:text-white rounded-xl text-xs uppercase tracking-wider font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply || isSubmitting}
            className="px-4 py-1.5 bg-primary text-black rounded-xl text-xs uppercase tracking-wider font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Renaming…
              </>
            ) : (
              <>
                <Check size={12} />
                Rename {changeCount}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
