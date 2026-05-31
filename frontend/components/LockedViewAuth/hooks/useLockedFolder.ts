import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../../constants';
import { LockedFolderStatus, SetupResponse, VerifyResponse } from '../types';

interface UseLockedFolderReturn {
  isConfigured: boolean;
  loading: boolean;
  error: string;
  submitting: boolean;
  checkStatus: () => Promise<void>;
  setup: (password: string) => Promise<boolean>;
  verify: (password: string) => Promise<boolean>;
  setError: (error: string) => void;
  setSubmitting: (submitting: boolean) => void;
}

export function useLockedFolder(onAuthenticate: () => void): UseLockedFolderReturn {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/locked-folder/status`);
      const data: LockedFolderStatus = await res.json();
      setIsConfigured(data.is_configured);
      if (data.is_authenticated) {
        onAuthenticate();
      }
    } catch (e) {
      console.error("Failed to fetch Locked Folder status", e);
    } finally {
      setLoading(false);
    }
  }, [onAuthenticate]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const setup = async (password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/locked-folder/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data: SetupResponse = await res.json();
      return data.success;
    } catch (err) {
      return false;
    }
  };

  const verify = async (password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/locked-folder/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data: VerifyResponse = await res.json();
      return data.success;
    } catch (err) {
      return false;
    }
  };

  return {
    isConfigured,
    loading,
    error,
    submitting,
    checkStatus,
    setup,
    verify,
    setError,
    setSubmitting
  };
}
