/**
 * InpaintPanel.tsx
 * IOPaint-inspired inpainting/outpainting panel with brush tools,
 * interactive segmentation, and AI-powered object removal/replacement.
 */

import React, { useState, useCallback } from 'react';
import {
  Eraser,
  Paintbrush,
  Wand2,
  Undo2,
  Redo2,
  Trash2,
  Sparkles,
  Settings,
  Loader2,
  Expand,
  HelpCircle,
} from 'lucide-react';

export type InpaintMode = 'brush' | 'erase' | 'interactive' | 'auto';
export type InpaintOperation = 'remove' | 'replace' | 'outpaint';

export interface InpaintSettings {
  brushSize: number;
  brushHardness: number;
  model: string;
  guidance: number;
  steps: number;
  prompt?: string;
  maskOpacity: number;
  showMask: boolean;
}

interface InpaintPanelProps {
  mode: InpaintMode;
  operation: InpaintOperation;
  settings: InpaintSettings;
  onModeChange: (mode: InpaintMode) => void;
  onOperationChange: (op: InpaintOperation) => void;
  onSettingsChange: (settings: InpaintSettings) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearMask: () => void;
  onProcess: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isProcessing: boolean;
  infoMessage?: string | null;
  onClearInfoMessage?: () => void;
}

const INPAINT_MODELS = [
  { id: 'lama', name: 'LaMa (Fast, Object Removal)', type: 'erase' },
  { id: 'ldm', name: 'LDM (High Quality)', type: 'erase' },
  { id: 'mat', name: 'MAT (Best Quality)', type: 'erase' },
  { id: 'sd15', name: 'Stable Diffusion 1.5', type: 'diffusion' },
  { id: 'sdxl', name: 'Stable Diffusion XL', type: 'diffusion' },
  { id: 'powerpaint', name: 'PowerPaint', type: 'diffusion' },
];

export const InpaintPanel: React.FC<InpaintPanelProps> = ({
  mode,
  operation,
  settings,
  onModeChange,
  onOperationChange,
  onSettingsChange,
  onUndo,
  onRedo,
  onClearMask,
  onProcess,
  canUndo,
  canRedo,
  isProcessing,
  infoMessage,
  onClearInfoMessage,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleBrushSizeChange = useCallback((value: number) => {
    onSettingsChange({ ...settings, brushSize: value });
  }, [settings, onSettingsChange]);

  const handleBrushHardnessChange = useCallback((value: number) => {
    onSettingsChange({ ...settings, brushHardness: value });
  }, [settings, onSettingsChange]);

  const handleModelChange = useCallback((modelId: string) => {
    const targetModel = INPAINT_MODELS.find(m => m.id === modelId);
    if (!targetModel) return;

    if (targetModel.type === 'erase' && operation !== 'remove') {
      onOperationChange('remove');
    }
    onSettingsChange({ ...settings, model: modelId });
  }, [settings, operation, onSettingsChange, onOperationChange]);

  const handleOperationChange = useCallback((op: InpaintOperation) => {
    onOperationChange(op);

    const currentModel = INPAINT_MODELS.find(m => m.id === settings.model) || INPAINT_MODELS[0];
    if (op !== 'remove' && currentModel.type === 'erase') {
      onSettingsChange({ ...settings, model: 'sd15' });
    }
  }, [settings, onSettingsChange, onOperationChange]);

  const handleGuidanceChange = useCallback((value: number) => {
    onSettingsChange({ ...settings, guidance: value });
  }, [settings, onSettingsChange]);

  const handleStepsChange = useCallback((value: number) => {
    onSettingsChange({ ...settings, steps: value });
  }, [settings, onSettingsChange]);

  const handlePromptChange = useCallback((prompt: string) => {
    onSettingsChange({ ...settings, prompt });
  }, [settings, onSettingsChange]);

  const selectedModel = INPAINT_MODELS.find(m => m.id === settings.model) || INPAINT_MODELS[0];
  const isDiffusionModel = selectedModel.type === 'diffusion';

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {infoMessage && (
        <div className="mx-4 mt-2 mb-1 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-medium leading-relaxed flex items-start gap-2">
          <Sparkles size={12} className="shrink-0 mt-0.5" />
          <span className="flex-1">{infoMessage}</span>
          {onClearInfoMessage && (
            <button onClick={onClearInfoMessage} className="text-amber-400/60 hover:text-amber-300 shrink-0">×</button>
          )}
        </div>
      )}

      {/* ── Operation Mode ── */}
      <div className="px-5 pt-4 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-4">
          Core AI Operation
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleOperationChange('remove')}
            className={`py-3 px-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
              operation === 'remove'
                ? 'bg-primary border-primary text-[#050505] shadow-lg shadow-primary/20'
                : 'bg-white/[0.02] text-white/30 border-white/5 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            <Eraser size={16} className="mx-auto mb-2" />
            Remove
          </button>
          <button
            onClick={() => handleOperationChange('replace')}
            className={`py-3 px-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
              operation === 'replace'
                ? 'bg-primary border-primary text-[#050505] shadow-lg shadow-primary/20'
                : 'bg-white/[0.02] text-white/30 border-white/5 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            <Wand2 size={16} className="mx-auto mb-2" />
            Replace
          </button>
          <button
            onClick={() => handleOperationChange('outpaint')}
            className={`py-3 px-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
              operation === 'outpaint'
                ? 'bg-primary border-primary text-[#050505] shadow-lg shadow-primary/20'
                : 'bg-white/[0.02] text-white/30 border-white/5 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            <Expand size={16} className="mx-auto mb-2" />
            Expand
          </button>
        </div>
      </div>

      {/* ── Brush Tools ── */}
      <div className="px-5 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-4">
          Selection Tools
        </p>
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { id: 'brush', icon: <Paintbrush size={14} />, title: 'Brush' },
            { id: 'erase', icon: <Eraser size={14} />, title: 'Eraser' },
            { id: 'interactive', icon: <Wand2 size={14} />, title: 'Interactive' },
            { id: 'auto', icon: <Sparkles size={14} />, title: 'Auto' },
          ].map(tool => (
            <button
              key={tool.id}
              onClick={() => onModeChange(tool.id as InpaintMode)}
              className={`h-11 rounded-xl flex items-center justify-center transition-all border ${
                mode === tool.id
                  ? 'bg-primary text-[#050505] border-primary shadow-lg shadow-primary/20'
                  : 'bg-white/[0.02] text-white/30 border-white/5 hover:text-white/60 hover:bg-white/5'
              }`}
              title={tool.title}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* Brush Size */}
        <div className="mb-6 group/item">
          <div className="flex justify-between items-baseline mb-3">
            <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 transition-colors">Brush Size</label>
            <span className="text-[10px] text-primary font-mono font-bold">{settings.brushSize}px</span>
          </div>
          <div className="relative h-4 flex items-center group/slider">
            <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
            <div
              className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300"
              style={{
                left:  '0%',
                width: `${(settings.brushSize / 200) * 100}%`,
                background: `rgb(var(--color-primary) / 0.8)`,
                boxShadow: `0 0 8px rgb(var(--color-primary) / 0.3)`,
              }}
            />
            <input
              type="range"
              min={5}
              max={200}
              step={1}
              value={settings.brushSize}
              onChange={e => handleBrushSizeChange(Number(e.target.value))}
              className="adjustment-slider slider-thumb-premium"
            />
          </div>
        </div>

        {/* Brush Hardness */}
        <div className="mb-6 group/item">
          <div className="flex justify-between items-baseline mb-3">
            <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 transition-colors">Hardness</label>
            <span className="text-[10px] text-primary font-mono font-bold">{settings.brushHardness}%</span>
          </div>
          <div className="relative h-4 flex items-center group/slider">
            <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
            <div
              className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300"
              style={{
                left:  '0%',
                width: `${settings.brushHardness}%`,
                background: `rgb(var(--color-primary) / 0.8)`,
                boxShadow: `0 0 8px rgb(var(--color-primary) / 0.3)`,
              }}
            />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.brushHardness}
              onChange={e => handleBrushHardnessChange(Number(e.target.value))}
              className="adjustment-slider slider-thumb-premium"
            />
          </div>
        </div>

        {/* Mask Opacity */}
        {settings.showMask && (
          <div className="mb-6 group/item">
            <div className="flex justify-between items-baseline mb-3">
              <label className="text-[11px] font-medium text-white/40 group-hover/item:text-white/70 transition-colors">Mask Opacity</label>
              <span className="text-[10px] text-primary font-mono font-bold">{settings.maskOpacity}%</span>
            </div>
            <div className="relative h-4 flex items-center group/slider">
              <div className="absolute w-full h-[1px] bg-white/5 rounded-full" />
              <div
                className="absolute h-[1px] rounded-full pointer-events-none transition-all duration-300"
                style={{
                  left:  '0%',
                  width: `${settings.maskOpacity}%`,
                  background: `rgb(var(--color-primary) / 0.8)`,
                  boxShadow: `0 0 8px rgb(var(--color-primary) / 0.3)`,
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={settings.maskOpacity}
                onChange={e => onSettingsChange({ ...settings, maskOpacity: Number(e.target.value) })}
                className="adjustment-slider slider-thumb-premium"
              />
            </div>
          </div>
        )}

        {/* History Controls */}
        <div className="flex gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all border ${
              canUndo
                ? 'border-white/10 text-white/50 hover:text-white hover:bg-white/5'
                : 'border-transparent text-white/15 cursor-default'
            }`}
          >
            <Undo2 size={11} />
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all border ${
              canRedo
                ? 'border-white/10 text-white/50 hover:text-white hover:bg-white/5'
                : 'border-transparent text-white/15 cursor-default'
            }`}
          >
            <Redo2 size={11} />
            Redo
          </button>
          <button
            onClick={onClearMask}
            className="flex items-center justify-center p-2 rounded-lg text-xs font-medium transition-all border border-white/10 text-white/50 hover:text-white hover:bg-white/5"
            title="Clear Mask"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* ── AI Model Selection ── */}
      <div className="px-4 pb-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">
          AI Model
        </p>
        <div className="relative group">
          <select
            value={settings.model}
            onChange={e => handleModelChange(e.target.value)}
            className="w-full appearance-none bg-[#111] border border-white/10 text-white/90 text-xs rounded-lg pl-3 pr-10 py-2.5 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer group-hover:bg-[#161616]"
          >
            {INPAINT_MODELS.map(model => (
              <option key={model.id} value={model.id} className="bg-[#111] text-white py-2">
                {model.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white/60 transition-colors">
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Prompt (for diffusion models) ── */}
      {isDiffusionModel && (operation === 'replace' || operation === 'outpaint') && (
        <div className="px-4 pb-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">
            Prompt
          </p>
          <textarea
            value={settings.prompt || ''}
            onChange={e => handlePromptChange(e.target.value)}
            placeholder="Describe what to generate..."
            className="w-full bg-white/5 border border-white/10 text-white/80 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 transition-all resize-none"
            rows={3}
          />
        </div>
      )}

      {/* ── Advanced Settings ── */}
      {isDiffusionModel && (
        <div className="px-4 pb-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-[11px] text-white/55 hover:text-white/80 transition-colors mb-3"
          >
            <Settings size={11} />
            Advanced Settings
          </button>

          {showAdvanced && (
            <div className="space-y-4">
              {/* Guidance Scale */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-[11px] text-white/55">Guidance Scale</label>
                  <span className="text-[10px] text-primary tabular-nums">{settings.guidance}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={0.5}
                  value={settings.guidance}
                  onChange={e => handleGuidanceChange(Number(e.target.value))}
                  className="adjustment-slider"
                />
              </div>

              {/* Steps */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-[11px] text-white/55">Steps</label>
                  <span className="text-[10px] text-primary tabular-nums">{settings.steps}</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={settings.steps}
                  onChange={e => handleStepsChange(Number(e.target.value))}
                  className="adjustment-slider"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Process Button ── */}
      <div className="px-4 pb-4">
        <button
          onClick={onProcess}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all bg-primary text-black hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Apply
            </>
          )}
        </button>
      </div>

      {/* ── Usage Tips ── */}
      <div className="px-4 pb-4">
        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 mb-2">
            Tips
          </p>
          <ul className="text-[10px] text-white/50 space-y-1.5">
            {mode === 'brush' && (
              <>
                <li>• Paint over areas to mask</li>
                <li>• Hold Shift for straight lines</li>
                <li>• Adjust brush size with [ and ]</li>
              </>
            )}
            {mode === 'interactive' && (
              <>
                <li>• Left click to select regions</li>
                <li>• Right click to deselect</li>
                <li>• Click multiple times for refinement</li>
              </>
            )}
            {mode === 'auto' && (
              <>
                <li>• AI automatically detects objects</li>
                <li>• Click detected objects to select</li>
              </>
            )}
            {operation === 'replace' && (
              <li>• Use detailed prompts for best results</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};
