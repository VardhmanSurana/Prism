import { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE } from '../../../constants';
import { MAP_STYLES } from '../constants';

export const useMapStyle = () => {
  const [selectedStyleId, setSelectedStyleId] = useState<string>('dark');
  const [loadingStyle, setLoadingStyle] = useState<boolean>(true);

  // Fetch saved style from backend
  useEffect(() => {
    const fetchMapStyle = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/settings/map-style`);
        if (res.ok) {
          const data = await res.json();
          if (data.map_style) {
            setSelectedStyleId(data.map_style);
          }
        }
      } catch (e) {
        console.error("Failed to load map style preference from backend:", e);
      } finally {
        setLoadingStyle(false);
      }
    };
    fetchMapStyle();
  }, []);

  // Save selected style to backend
  const handleStyleChange = useCallback(async (styleId: string) => {
    setSelectedStyleId(styleId);
    try {
      await fetch(`${API_BASE}/api/v1/settings/map-style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map_style: styleId })
      });
    } catch (e) {
      console.error("Failed to save map style preference to backend:", e);
    }
  }, []);

  const currentStyle = useMemo(() => {
    return MAP_STYLES.find(s => s.id === selectedStyleId) || MAP_STYLES[1];
  }, [selectedStyleId]);

  return {
    selectedStyleId,
    loadingStyle,
    currentStyle,
    handleStyleChange
  };
};
