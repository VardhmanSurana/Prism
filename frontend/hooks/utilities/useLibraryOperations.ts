import { useState } from 'react';
import { API_BASE } from '../../constants';

interface UseLibraryOperationsProps {
  onConfirm: (config: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'primary' | 'rose';
  }) => void;
}

export const useLibraryOperations = ({ onConfirm }: UseLibraryOperationsProps) => {
  const [isResetting, setIsResetting] = useState(false);
  const [systemStatus, setSystemStatus] = useState<string | null>(null);

  const handleResetLibrary = () => {
    onConfirm({
      isOpen: true,
      title: 'Reset Library',
      message: 'Completely clear the photo library? This will remove all indexed photos and thumbnails. Your original files will NOT be deleted.',
      onConfirm: executeReset,
      type: 'rose'
    });
  };

  const executeReset = async () => {
    setIsResetting(true);
    setSystemStatus('Resetting library...');
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/reset-library`, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Reset failed with status ${res.status}: ${text}`);
      }
      const data = await res.json();
      setSystemStatus(`✓ ${data.message}`);
      setTimeout(() => {
        window.location.reload(); 
      }, 1500);
    } catch (e) {
      console.error('Failed to reset library', e);
      setSystemStatus(`✗ Reset failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsResetting(false);
      setTimeout(() => setSystemStatus(null), 6000);
    }
  };

  const handleTriggerFaceSync = async () => {
    setSystemStatus('Initiating face discovery...');
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/trigger-face-sync`, { method: 'POST' });
      if (res.ok) {
        setSystemStatus('✓ Face discovery running in background');
      } else {
        setSystemStatus('✗ Failed to start face discovery');
      }
    } catch (e) {
      setSystemStatus('✗ Network error');
    }
    setTimeout(() => setSystemStatus(null), 4000);
  };

  return {
    isResetting,
    systemStatus,
    handleResetLibrary,
    handleTriggerFaceSync,
    setSystemStatus
  };
};
