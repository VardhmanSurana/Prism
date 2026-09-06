/**
 * useExitGuard.ts
 * Exit-confirmation flow with draft-aware handling.
 */
import { useCallback, useState } from 'react';

export interface UseExitGuardParams {
  isDirty: boolean;
  onClose: () => void;
  discardDraft: () => void;
}

export function useExitGuard(p: UseExitGuardParams) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleRequestClose = useCallback(() => {
    if (p.isDirty) {
      setShowExitConfirm(true);
    } else {
      p.onClose();
    }
  }, [p.isDirty, p.onClose]);

  const handleDiscardAndClose = useCallback(() => {
    p.discardDraft();
    setShowExitConfirm(false);
    p.onClose();
  }, [p.discardDraft, p.onClose]);

  const handleKeepDraftAndClose = useCallback(() => {
    setShowExitConfirm(false);
    p.onClose();
  }, [p.onClose]);

  return {
    showExitConfirm,
    setShowExitConfirm,
    handleRequestClose,
    handleDiscardAndClose,
    handleKeepDraftAndClose,
  };
}
