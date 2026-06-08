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
  Download,
  Settings,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Expand,
  HelpCircle,
  Eye,
  EyeOff,
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
  photoId?: number | string;
  onShowTutorial?: () => void;
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
  photoId,
  onShowTutorial,
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
      {/* ── Help Button ── */}
      {onShowTutorial && (
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={onShowTutorial}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10"
          >
            <HelpCircle size={12} />
            Show Tutorial
          </button>
        </div>
      )}

      {/* ── Operation Mode ── */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">
          Operation
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleOperationChange('remove')}
            className={`py-2 px-2 rounded-lg text-[10px] font-medium transition-all border ${
              operation === 'remove'
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
            }`}
          >
            <Eraser size={12} className="mx-auto mb-1" />
            Remove
          </button>
          <button
            onClick={() => handleOperationChange('replace')}
            className={`py-2 px-2 rounded-lg text-[10px] font-medium transition-all border ${
              operation === 'replace'
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
            }`}
          >
            <Wand2 size={12} className="mx-auto mb-1" />
            Replace
          </button>
          <button
            onClick={() => handleOperationChange('outpaint')}
            className={`py-2 px-2 rounded-lg text-[10px] font-medium transition-all border ${
              operation === 'outpaint'
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
            }`}
          >
            <Expand size={12} className="mx-auto mb-1" />
            Outpaint
          </button>
        </div>
      </div>

      {/* ── Brush Tools ── */}
      <div className="px-4 pb-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">
          Brush Tools
        </p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <button
            onClick={() => onModeChange('brush')}
            className={`py-2 rounded-lg text-[10px] font-medium transition-all border ${
              mode === 'brush'
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
            }`}
            title="Brush"
          >
            <Paintbrush size={12} className="mx-auto" />
          </button>
          <button
            onClick={() => onModeChange('erase')}
            className={`py-2 rounded-lg text-[10px] font-medium transition-all border ${
              mode === 'erase'
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
            }`}
            title="Eraser"
          >
            <Eraser size={12} className="mx-auto" />
          </button>
          <button
            onClick={() => onModeChange('interactive')}
            className={`py-2 rounded-lg text-[10px] font-medium transition-all border ${
              mode === 'interactive'
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
            }`}
            title="Interactive Segmentation"
          >
            <Wand2 size={12} className="mx-auto" />
          </button>
          <button
            onClick={() => onModeChange('auto')}
            className={`py-2 rounded-lg text-[10px] font-medium transition-all border ${
              mode === 'auto'
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
            }`}
            title="Auto Detect"
          >
            <Sparkles size={12} className="mx-auto" />
          </button>
        </div>

        {/* Brush Size */}
        <div className="mb-4">
          <div className="flex justify-between items-baseline mb-2">
            <label className="text-[11px] text-white/55">Brush Size</label>
            <span className="text-[10px] text-primary tabular-nums">{settings.brushSize}px</span>
          </div>
          <input
            type="range"
            min={5}
            max={200}
            step={1}
            value={settings.brushSize}
            onChange={e => handleBrushSizeChange(Number(e.target.value))}
            className="adjustment-slider"
          />
        </div>

        {/* Brush Hardness */}
        <div className="mb-4">
          <div className="flex justify-between items-baseline mb-2">
            <label className="text-[11px] text-white/55">Hardness</label>
            <span className="text-[10px] text-primary tabular-nums">{settings.brushHardness}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={settings.brushHardness}
            onChange={e => handleBrushHardnessChange(Number(e.target.value))}
            className="adjustment-slider"
          />
        </div>

        {/* Mask Visibility Toggle */}
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] text-white/55">Mask Preview</label>
          <button
            onClick={() => onSettingsChange({ ...settings, showMask: !settings.showMask })}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-white/5 hover:bg-white/10 transition-colors text-white/70"
          >
            {settings.showMask ? <Eye size={11} /> : <EyeOff size={11} />}
            {settings.showMask ? 'Hide' : 'Show'}
          </button>
        </div>

        {/* Mask Opacity */}
        {settings.showMask && (
          <div className="mb-4">
            <div className="flex justify-between items-baseline mb-2">
              <label className="text-[11px] text-white/55">Mask Opacity</label>
              <span className="text-[10px] text-primary tabular-nums">{settings.maskOpacity}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.maskOpacity}
              onChange={e => onSettingsChange({ ...settings, maskOpacity: Number(e.target.value) })}
              className="adjustment-slider"
            />
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
