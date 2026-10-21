import { useState, useEffect } from 'react';
import { API_BASE } from '../../constants';

/**
 * useLockedFolder - Hook managing locked folder.
 */
export function useLockedFolder() {
  const [isLockedAuthenticated, setIsLockedAuthenticated] = useState(false);

  useEffect(() => {
    /**
     * checkLockedAuth - Performs check locked auth.
     */
    const checkLockedAuth = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/settings/locked-folder/status`);
        const data = await res.json();
        if (data.is_authenticated) {
          setIsLockedAuthenticated(true);
        }
      } catch (e) {
        console.error("Failed to check lock authentication status", e);
      }
    };
    checkLockedAuth();
  }, []);

  /**
   * handleLockSession - Handles lock session.
   */
  const handleLockSession = async () => {
    if (!isLockedAuthenticated) return;
    try {
      await fetch(`${API_BASE}/api/v1/settings/locked-folder/lock-session`, {
        method: 'POST'
      });
    } catch (e) {
      console.error("Failed to call backend lock-session endpoint", e);
    } finally {
      setIsLockedAuthenticated(false);
    }
  };

  return {
    isLockedAuthenticated,
    setIsLockedAuthenticated,
    handleLockSession
  };
}
