import { useState } from 'react';
import { API_BASE } from '../../constants';
import { open, confirm } from '@tauri-apps/plugin-dialog';

import { customConfirm } from '../../services/ConfirmService';

interface UsePurgeOperationsProps {
  openBrowseDialog: (title: string, multiple?: boolean) => Promise<string[] | null>;
}

/**
 * usePurgeOperations - Hook managing purge operations.
 */
export const usePurgeOperations = ({ openBrowseDialog }: UsePurgeOperationsProps) => {
  const [purgeInput, setPurgeInput] = useState('');
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);

  /**
   * handlePurgeBrowse - Handles purge browse.
   */
  const handlePurgeBrowse = async () => {
    const selected = await openBrowseDialog('Select Folder to Purge from Library', false);
    if (selected && selected.length > 0) setPurgeInput(selected[0]);
  };

  /**
   * handlePurgeFolder - Handles purge folder.
   */
  const handlePurgeFolder = async () => {
    if (!purgeInput) return;
    if (!await customConfirm(`Remove all photos from "${purgeInput}" from the library? This cannot be undone.`, 'Confirm Purge')) return;
    setPurgeStatus('Purging...');
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/purge-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: purgeInput })
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      const deleted = typeof data.deleted_count === 'number' ? data.deleted_count : 0;
      const failed = typeof data.failed_count === 'number' ? data.failed_count : 0;
      if (data.status === 'partial' || failed > 0) {
        setPurgeStatus(`⚠ Removed ${deleted} photo${deleted !== 1 ? 's' : ''}, ${failed} failed — check backend logs`);
      } else {
        setPurgeStatus(`✓ Removed ${deleted} photo${deleted !== 1 ? 's' : ''} from library`);
      }
      setPurgeInput('');
    } catch (e) {
      setPurgeStatus('✗ Failed to purge folder');
    }
    setTimeout(() => setPurgeStatus(null), 4000);
  };

  return {
    purgeInput,
    setPurgeInput,
    purgeStatus,
    handlePurgeBrowse,
    handlePurgeFolder
  };
};
