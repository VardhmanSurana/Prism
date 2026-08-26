/**
 * MagicEraserPanel.tsx
 * AI-powered Magic Eraser panel with brush tools,
 * interactive segmentation, and neural object removal/replacement.
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
import { EditorSlider } from '@/components/Editor/ImageEditor/ui/EditorSlider';

export type MagicEraserMode = 'brush' | 'erase' | 'interactive' | 'auto';
export type MagicEraserOperation = 'remove' | 'replace' | 'outpaint';

export interface MagicEraserSettings {
  brushSize: number;
  brushHardness: number;
  model: string;
  guidance: number;
  steps: number;
  prompt?: string;
  maskOpacity: number;
  showMask: boolean;
}

export type InpaintMode = MagicEraserMode;
export type InpaintOperation = MagicEraserOperation;
export type InpaintSettings = MagicEraserSettings;

export interface MagicEraserPanelProps {
  mode: MagicEraserMode;
  operation: MagicEraserOperation;
  settings: MagicEraserSettings;
  onModeChange: (mode: MagicEraserMode) => void;
  onOperationChange: (op: MagicEraserOperation) => void;
  onSettingsChange: (settings: MagicEraserSettings) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearMask: () => void;
  onProcess: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isProcessing: boolean;
  infoMessage?: string | null;
  onClearInfoMessage?: () => void;
  /** Interactive mode: generate a SAM mask from the placed points. */
  onGenerateSegmentMask?: () => void;
  /** Interactive mode: at least one prompt point has been placed. */
  canSegment?: boolean;
  /** Interactive mode: clear the placed prompt points. */
  onClearSegmentPoints?: () => void;
}

export type InpaintPanelProps = MagicEraserPanelProps;

const ERASER_MODELS = [
  { id: 'lama', name: 'LaMa (Fast Object Removal)', type: 'erase' },
  { id: 'sd15', name: 'Stable Diffusion (Neural Replace)', type: 'diffusion' },
];

export const MagicEraserPanel: React.FC<MagicEraserPanelProps> = ({
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
  onGenerateSegmentMask,
  canSegment,
  onClearSegmentPoints,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleBrushSizeChange = useCallback((value: number) => {
    onSettingsChange({ ...settings, brushSize: value });
  }, [settings, onSettingsChange]);

  const handleBrushHardnessChange = useCallback((value: number) => {
    onSettingsChange({ ...settings, brushHardness: value });
  }, [settings, onSettingsChange]);

  const handleModelChange = useCallback((modelId: string) => {
    const targetModel = ERASER_MODELS.find(m => m.id === modelId);
    if (!targetModel) return;

    if (targetModel.type === 'erase' && operation !== 'remove') {
      onOperationChange('remove');
    }
    onSettingsChange({ ...settings, model: modelId });
  }, [settings, operation, onSettingsChange, onOperationChange]);

  const handleOperationChange = useCallback((op: MagicEraserOperation) => {
    onOperationChange(op);

    const currentModel = ERASER_MODELS.find(m => m.id === settings.model) || ERASER_MODELS[0];
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

  const selectedModel = ERASER_MODELS.find(m => m.id === settings.model) || ERASER_MODELS[0];
  const isDiffusionModel = selectedModel.type === 'diffusion';

  return (
    <div className="flex-1 w-full min-h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0d0f14]">
      {/* ── Studio Header ── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Eraser size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-white tracking-tight text-sm">Magic Eraser</h3>
            <p className="text-[10px] text-gray-400">AI object removal & generative neural fill</p>
          </div>
        </div>
      </div>

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
          Erase & Fill Mode
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleOperationChange('remove')}
            className={`editor-btn editor-card-btn ${
              operation === 'remove' ? 'active' : ''
            } py-3 px-2 text-[10px] font-bold uppercase tracking-wider`}
          >
            <Eraser size={16} className="mx-auto mb-2" />
            Erase Object
          </button>
          <button
            onClick={() => handleOperationChange('replace')}
            className={`editor-btn editor-card-btn ${
              operation === 'replace' ? 'active' : ''
            } py-3 px-2 text-[10px] font-bold uppercase tracking-wider`}
          >
            <Wand2 size={16} className="mx-auto mb-2" />
            Neural Fill
          </button>
          <button
            onClick={() => handleOperationChange('outpaint')}
            className={`editor-btn editor-card-btn ${
              operation === 'outpaint' ? 'active' : ''
            } py-3 px-2 text-[10px] font-bold uppercase tracking-wider`}
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
              className={`editor-btn editor-card-btn ${
                mode === tool.id ? 'active' : ''
              } h-11 flex items-center justify-center`}
              title={tool.title}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* Brush Size */}
        <div className="mb-4">
          <EditorSlider
            label="Brush Size"
            value={settings.brushSize}
            onChange={handleBrushSizeChange}
            min={5}
            max={200}
            defaultValue={30}
            unit=" px"
          />
        </div>

        {/* Brush Hardness */}
        <div className="mb-4">
          <EditorSlider
            label="Brush Hardness"
            value={settings.brushHardness}
            onChange={handleBrushHardnessChange}
            min={0}
            max={100}
            defaultValue={50}
            unit="%"
          />
        </div>

        {/* Mask Opacity */}
        {settings.showMask && (
          <div className="mb-4">
            <EditorSlider
              label="Mask Opacity"
              value={settings.maskOpacity}
              onChange={val => onSettingsChange({ ...settings, maskOpacity: val })}
              min={0}
              max={100}
              step={5}
              defaultValue={50}
              unit="%"
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
            {ERASER_MODELS.map(model => (
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
            <div className="space-y-3.5 pt-1">
              {/* Guidance Scale */}
              <EditorSlider
                label="Guidance Scale"
                value={settings.guidance}
                onChange={handleGuidanceChange}
                min={1}
                max={20}
                step={0.5}
                defaultValue={7.5}
              />

              {/* Steps */}
              <EditorSlider
                label="Inference Steps"
                value={settings.steps}
                onChange={handleStepsChange}
                min={10}
                max={100}
                step={5}
                defaultValue={30}
              />
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
              {operation === 'remove' ? 'Erase Selected Area' : operation === 'replace' ? 'Generate Neural Fill' : 'Expand Canvas'}
            </>
          )}
        </button>

        {mode === 'interactive' && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={onGenerateSegmentMask}
              disabled={!canSegment || isProcessing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all border border-white/10 text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles size={12} />
              Generate Mask from Points
            </button>
            <button
              onClick={onClearSegmentPoints}
              disabled={!canSegment || isProcessing}
              className="flex items-center justify-center p-2.5 rounded-lg text-xs font-medium transition-all border border-white/10 text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Clear Points"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
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

export const InpaintPanel = MagicEraserPanel;

