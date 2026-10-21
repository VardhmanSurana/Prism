import { useState } from 'react';

interface ConfirmDialogConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type: 'primary' | 'rose';
}

/**
 * useConfirmDialog - Hook managing confirm dialog.
 */
export const useConfirmDialog = () => {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'primary'
  });

  /**
   * openConfirmDialog - Performs open confirm dialog.
   */
  const openConfirmDialog = (config: Omit<ConfirmDialogConfig, 'isOpen'>) => {
    setConfirmDialog({
      ...config,
      isOpen: true
    });
  };

  /**
   * closeConfirmDialog - Performs close confirm dialog.
   */
  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  return {
    confirmDialog,
    setConfirmDialog,
    openConfirmDialog,
    closeConfirmDialog
  };
};
