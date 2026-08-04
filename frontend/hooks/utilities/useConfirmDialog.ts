import { useState } from 'react';

interface ConfirmDialogConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type: 'primary' | 'rose';
}

export const useConfirmDialog = () => {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'primary'
  });

  const openConfirmDialog = (config: Omit<ConfirmDialogConfig, 'isOpen'>) => {
    setConfirmDialog({
      ...config,
      isOpen: true
    });
  };

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
