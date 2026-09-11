import { create } from 'zustand';
import { Photo } from '../types';
import { API_BASE } from '../constants';

export interface BurstCluster {
  burst_id: string;
  start_time?: string;
  end_time?: string;
  photo_count: number;
  best_photo_id?: number;
  photos: Photo[];
}

interface CullState {
  clusters: BurstCluster[];
  activeClusterIndex: number;
  primaryIndex: number;
  secondaryIndex: number;
  compareMode: boolean;
  zoomLevel: 1 | 2;
  autoAdvance: boolean;
  panOffset: { x: number; y: number };
  isLoading: boolean;
  lastPurgedIds: number[];
  lastUndoToken: string | null;

  // Actions
  fetchBursts: (includeAll?: boolean) => Promise<void>;
  setActiveClusterIndex: (index: number) => void;
  setPrimaryIndex: (index: number) => void;
  setSecondaryIndex: (index: number) => void;
  toggleCompareMode: () => void;
  setZoomLevel: (level: 1 | 2) => void;
  toggleZoom: () => void;
  setPanOffset: (offset: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  setAutoAdvance: (val: boolean) => void;
  setPhotoCullStatus: (photoId: number | string, status: 'picked' | 'rejected' | 'unflagged') => Promise<void>;
  setPhotoRating: (photoId: number | string, rating: number) => Promise<void>;
  advanceCandidate: (step?: number) => void;
  purgeRejected: () => Promise<number>;
  undoPurge: () => Promise<void>;

  // Selectors
  getActiveCluster: () => BurstCluster | undefined;
  getPrimaryPhoto: () => Photo | undefined;
  getSecondaryPhoto: () => Photo | undefined;
  getTriageStats: () => { picked: number; rejected: number; unflagged: number; total: number };
}

export const useCullStore = create<CullState>((set, get) => ({
  clusters: [],
  activeClusterIndex: 0,
  primaryIndex: 0,
  secondaryIndex: 1,
  compareMode: false,
  zoomLevel: 1,
  autoAdvance: true,
  panOffset: { x: 0, y: 0 },
  isLoading: false,
  lastPurgedIds: [],
  lastUndoToken: null,

  fetchBursts: async (includeAll = true) => {
    set({ isLoading: true });
    try {
      const url = `${API_BASE}/api/v1/cull/bursts?include_all=${includeAll ? 'true' : 'false'}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const clusters: BurstCluster[] = data.clusters || [];
        set({
          clusters,
          activeClusterIndex: 0,
          primaryIndex: 0,
          secondaryIndex: clusters[0]?.photos.length > 1 ? 1 : 0,
          panOffset: { x: 0, y: 0 },
          zoomLevel: 1,
        });
      }
    } catch (e) {
      console.error('Failed to fetch bursts for culling:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveClusterIndex: (index: number) => {
    const { clusters } = get();
    if (index < 0 || index >= clusters.length) return;
    const targetCluster = clusters[index];
    set({
      activeClusterIndex: index,
      primaryIndex: 0,
      secondaryIndex: targetCluster && targetCluster.photos.length > 1 ? 1 : 0,
      panOffset: { x: 0, y: 0 },
    });
  },

  setPrimaryIndex: (index: number) => {
    const cluster = get().getActiveCluster();
    if (!cluster || index < 0 || index >= cluster.photos.length) return;
    set({ primaryIndex: index, panOffset: { x: 0, y: 0 } });
  },

  setSecondaryIndex: (index: number) => {
    const cluster = get().getActiveCluster();
    if (!cluster || index < 0 || index >= cluster.photos.length) return;
    set({ secondaryIndex: index });
  },

  toggleCompareMode: () => {
    set((state) => ({ compareMode: !state.compareMode, panOffset: { x: 0, y: 0 } }));
  },

  setZoomLevel: (level: 1 | 2) => set({ zoomLevel: level }),

  toggleZoom: () => {
    set((state) => ({
      zoomLevel: state.zoomLevel === 1 ? 2 : 1,
      panOffset: state.zoomLevel === 1 ? state.panOffset : { x: 0, y: 0 },
    }));
  },

  setPanOffset: (offset) => {
    set((state) => ({
      panOffset: typeof offset === 'function' ? offset(state.panOffset) : offset,
    }));
  },

  setAutoAdvance: (val: boolean) => set({ autoAdvance: val }),

  advanceCandidate: (step = 1) => {
    const { clusters, activeClusterIndex, primaryIndex } = get();
    const currentCluster = clusters[activeClusterIndex];
    if (!currentCluster) return;

    const nextIndex = primaryIndex + step;
    if (nextIndex < currentCluster.photos.length) {
      set({ primaryIndex: nextIndex, panOffset: { x: 0, y: 0 } });
    } else if (activeClusterIndex + 1 < clusters.length) {
      // Advance to next cluster
      set({
        activeClusterIndex: activeClusterIndex + 1,
        primaryIndex: 0,
        secondaryIndex: clusters[activeClusterIndex + 1]?.photos.length > 1 ? 1 : 0,
        panOffset: { x: 0, y: 0 },
      });
    }
  },

  setPhotoCullStatus: async (photoId: number | string, status: 'picked' | 'rejected' | 'unflagged') => {
    const numId = Number(photoId);

    // Optimistically update clusters in state
    set((state) => {
      const updatedClusters = state.clusters.map((c) => ({
        ...c,
        photos: c.photos.map((p) => (Number(p.id) === numId ? { ...p, cull_status: status } : p)),
      }));
      return { clusters: updatedClusters };
    });

    // Auto advance if enabled
    if (get().autoAdvance) {
      get().advanceCandidate(1);
    }

    try {
      await fetch(`${API_BASE}/api/v1/cull/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_ids: [numId], cull_status: status }),
      });
    } catch (e) {
      console.error('Failed to update cull status on backend:', e);
    }
  },

  setPhotoRating: async (photoId: number | string, rating: number) => {
    const numId = Number(photoId);

    set((state) => {
      const updatedClusters = state.clusters.map((c) => ({
        ...c,
        photos: c.photos.map((p) => (Number(p.id) === numId ? { ...p, rating } : p)),
      }));
      return { clusters: updatedClusters };
    });

    try {
      await fetch(`${API_BASE}/api/v1/cull/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_ids: [numId], rating }),
      });
    } catch (e) {
      console.error('Failed to update rating on backend:', e);
    }
  },

  purgeRejected: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/cull/purge-rejected`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        const purgedIds: number[] = data.purged_photo_ids || [];
        set({ lastPurgedIds: purgedIds, lastUndoToken: data.undo_token || null });

        // Remove purged photos from state
        set((state) => {
          const updatedClusters = state.clusters
            .map((c) => ({
              ...c,
              photos: c.photos.filter((p) => !purgedIds.includes(Number(p.id))),
            }))
            .filter((c) => c.photos.length > 0);

          return {
            clusters: updatedClusters,
            activeClusterIndex: Math.min(state.activeClusterIndex, Math.max(0, updatedClusters.length - 1)),
            primaryIndex: 0,
          };
        });

        return data.purged_count || 0;
      }
    } catch (e) {
      console.error('Failed to purge rejected photos:', e);
    }
    return 0;
  },

  undoPurge: async () => {
    const { lastPurgedIds, lastUndoToken } = get();
    try {
      const res = await fetch(`${API_BASE}/api/v1/cull/undo-purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_ids: lastPurgedIds.length > 0 ? lastPurgedIds : undefined,
          undo_token: lastUndoToken || undefined,
        }),
      });
      if (res.ok) {
        set({ lastPurgedIds: [], lastUndoToken: null });
        await get().fetchBursts();
      }
    } catch (e) {
      console.error('Failed to undo purge:', e);
    }
  },

  getActiveCluster: () => {
    const { clusters, activeClusterIndex } = get();
    return clusters[activeClusterIndex];
  },

  getPrimaryPhoto: () => {
    const cluster = get().getActiveCluster();
    if (!cluster) return undefined;
    return cluster.photos[get().primaryIndex];
  },

  getSecondaryPhoto: () => {
    const cluster = get().getActiveCluster();
    if (!cluster) return undefined;
    return cluster.photos[get().secondaryIndex];
  },

  getTriageStats: () => {
    const { clusters } = get();
    let picked = 0;
    let rejected = 0;
    let unflagged = 0;
    let total = 0;

    for (const c of clusters) {
      for (const p of c.photos) {
        total += 1;
        if (p.cull_status === 'picked') picked += 1;
        else if (p.cull_status === 'rejected') rejected += 1;
        else unflagged += 1;
      }
    }

    return { picked, rejected, unflagged, total };
  },
}));
