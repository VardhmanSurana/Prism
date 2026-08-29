/**
 * TopBarSection.tsx
 * Top bar (save/copy/undo/redo/history) + optional draft-recovery banner.
 */
import React from 'react';
import { TopBar } from '../../TopBar';
import { DraftRecoveryBanner } from '../../DraftRecoveryBanner';

export interface TopBarSectionProps {
  onClose: () => void;
  onReset: () => void;
  isDirty: boolean;
  isSaving: boolean;
  handleSave: (isSaveAs: boolean, format?: string, quality?: number) => void;
  handleCopy: () => void;
  isComparing: boolean;
  onCompareToggle: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onToggleHistory: () => void;
  isHistoryOpen: boolean;
  historyCount: number;
  exportProgress: { step: string; current: number; total: number } | null;
  onCopyEdits: () => void;
  onPasteEdits: () => void;
  hasCopiedEdits: boolean;
  draft: {
    hasRestoredDraft: boolean;
    draftTimestamp: number | null;
    discardDraft: () => void;
    dismissBanner: () => void;
  };
}

export const TopBarSection: React.FC<TopBarSectionProps> = (p) => (
  <>
    <TopBar
      onClose={p.onClose}
      onReset={p.onReset}
      isDirty={p.isDirty}
      isSaving={p.isSaving}
      handleSave={p.handleSave}
      handleCopy={p.handleCopy}
      isComparing={p.isComparing}
      onCompareToggle={p.onCompareToggle}
      handleUndo={p.handleUndo}
      handleRedo={p.handleRedo}
      canUndo={p.canUndo}
      canRedo={p.canRedo}
      onToggleHistory={p.onToggleHistory}
      isHistoryOpen={p.isHistoryOpen}
      historyCount={p.historyCount}
      exportProgress={p.exportProgress}
      onCopyEdits={p.onCopyEdits}
      onPasteEdits={p.onPasteEdits}
      hasCopiedEdits={p.hasCopiedEdits}
    />
    {p.draft.hasRestoredDraft && (
      <DraftRecoveryBanner
        timestamp={p.draft.draftTimestamp}
        onDiscard={p.draft.discardDraft}
        onKeep={p.draft.dismissBanner}
      />
    )}
  </>
);
