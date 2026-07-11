import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { SmartFolderCriteria, SmartFolderMediaType } from './types';

interface SaveSmartFolderFormProps {
  initialNamePattern?: string;
  currentPath?: string;
  onSave: (name: string, criteria: SmartFolderCriteria, basePath?: string) => void;
  onCancel: () => void;
}

const SIZE_PRESETS: { label: string; value: number | undefined }[] = [
  { label: 'Any size', value: undefined },
  { label: '≥ 1 MB', value: 1_000_000 },
  { label: '≥ 5 MB', value: 5_000_000 },
  { label: '≥ 20 MB', value: 20_000_000 },
];

export const SaveSmartFolderForm: React.FC<SaveSmartFolderFormProps> = ({
  initialNamePattern = '',
  currentPath,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(
    initialNamePattern ? `Search: ${initialNamePattern}` : 'My smart folder'
  );
  const [namePattern, setNamePattern] = useState(initialNamePattern);
  const [mediaType, setMediaType] = useState<SmartFolderMediaType>('all');
  const [minSizeBytes, setMinSizeBytes] = useState<number | undefined>(undefined);
  const [pinBasePath, setPinBasePath] = useState(Boolean(currentPath));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const criteria: SmartFolderCriteria = {
      namePattern: namePattern.trim() || undefined,
      mediaType,
      minSizeBytes,
    };

    onSave(name.trim(), criteria, pinBasePath && currentPath ? currentPath : undefined);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/10 bg-[#101010] p-3 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/50 inline-flex items-center gap-1.5">
          <Star size={11} className="text-primary" />
          Save smart folder
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-mono uppercase text-white/40">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#141414] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40"
          placeholder="e.g. Large vacation RAW"
          autoFocus
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] font-mono uppercase text-white/40">Name contains</span>
        <input
          value={namePattern}
          onChange={(e) => setNamePattern(e.target.value)}
          className="w-full bg-[#141414] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40"
          placeholder="Optional filter, e.g. DSC or 2023"
        />
      </label>

      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase text-white/40">Media type</span>
        <div className="flex gap-1.5">
          {(['all', 'image', 'video'] as SmartFolderMediaType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMediaType(t)}
              className={`px-2.5 py-1 text-[10px] rounded-lg border uppercase tracking-wider font-semibold transition-all cursor-pointer
                ${
                  mediaType === t
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase text-white/40">Minimum size</span>
        <div className="flex flex-wrap gap-1.5">
          {SIZE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setMinSizeBytes(p.value)}
              className={`px-2.5 py-1 text-[10px] rounded-lg border transition-all cursor-pointer
                ${
                  minSizeBytes === p.value
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {currentPath && (
        <label className="flex items-start gap-2 text-[10px] text-white/50 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={pinBasePath}
            onChange={(e) => setPinBasePath(e.target.checked)}
            className="mt-0.5 rounded border-white/10 bg-transparent text-primary focus:ring-0 w-3 h-3"
          />
          <span>
            Pin to current folder
            <span className="block text-white/30 truncate max-w-[280px]" title={currentPath}>
              {currentPath}
            </span>
          </span>
        </label>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold border border-white/10 text-white/60 hover:text-white rounded-lg cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold bg-primary text-black rounded-lg disabled:opacity-40 cursor-pointer"
        >
          Save
        </button>
      </div>
    </form>
  );
};
