import { useState } from 'react';
import { API_BASE } from '../../constants';
import { open, confirm } from '@tauri-apps/plugin-dialog';

import { customConfirm } from '../../services/ConfirmService';

interface UsePurgeOperationsProps {
  openBrowseDialog: (title: string, multiple?: boolean) => Promise<string[] | null>;
}

export const usePurgeOperations = ({ openBrowseDialog }: UsePurgeOperationsProps) => {
  const [purgeInput, setPurgeInput] = useState('');
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);

  const handlePurgeBrowse = async () => {
    const selected = await openBrowseDialog('Select Folder to Purge from Library', false);
    if (selected && selected.length > 0) setPurgeInput(selected[0]);
  };

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
      const data = await res.json();
      setPurgeStatus(`✓ Removed ${data.deleted} photo${data.deleted !== 1 ? 's' : ''} from library`);
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
