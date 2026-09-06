import { create } from 'zustand';

export type PlaybackRate = 0.1 | 0.25 | 0.5 | 1.0;
export type CameraLayout = '3-grid' | 'dual-split' | 'pip' | 'focus';
export type CameraViewId = 'face_on' | 'behind' | 'impact';
export type PlayerTabId = 'cameras' | '3d-model' | 'pressure-mat' | 'all-in-one';

interface PlayerStoreState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: PlaybackRate;
  isLooping: boolean;
  
  // Navigation Tabs
  activeTab: PlayerTabId;
  setActiveTab: (tab: PlayerTabId) => void;

  // Multi-Camera Layout
  cameraLayout: CameraLayout;
  setCameraLayout: (layout: CameraLayout) => void;
  primaryCamera: CameraViewId;
  setPrimaryCamera: (cam: CameraViewId) => void;
  cyclePrimaryCamera: () => void;

  // Legacy compat aliases
  layoutMode: 'split' | 'pip';
  primaryView: 'body' | 'impact';
  setLayoutMode: (mode: 'split' | 'pip') => void;
  toggleLayoutMode: () => void;
  setPrimaryView: (view: 'body' | 'impact') => void;
  swapPrimaryView: () => void;

  isMuted: boolean;
  showGuides: boolean;

  // Actions
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (rate: PlaybackRate) => void;
  toggleLoop: () => void;
  toggleMute: () => void;
  toggleGuides: () => void;
  seekTo: (time: number) => void;
  stepFrames: (count: number, containerFps: number) => void;
  jumpToImpact: () => void;
}

export const usePlayerStore = create<PlayerStoreState>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 4.0,
  playbackRate: 1.0,
  isLooping: true,

  activeTab: 'cameras',
  setActiveTab: (tab) => set({ activeTab: tab }),

  cameraLayout: '3-grid',
  setCameraLayout: (layout) => set({ 
    cameraLayout: layout,
    layoutMode: layout === 'pip' ? 'pip' : 'split'
  }),

  primaryCamera: 'face_on',
  setPrimaryCamera: (cam) => set({ primaryCamera: cam }),
  cyclePrimaryCamera: () => {
    const { primaryCamera } = get();
    const order: CameraViewId[] = ['face_on', 'behind', 'impact'];
    const nextIdx = (order.indexOf(primaryCamera) + 1) % order.length;
    set({ primaryCamera: order[nextIdx] });
  },

  // Legacy aliases
  layoutMode: 'split',
  primaryView: 'body',
  setLayoutMode: (mode) => set({ 
    layoutMode: mode, 
    cameraLayout: mode === 'pip' ? 'pip' : 'dual-split' 
  }),
  toggleLayoutMode: () => set((s) => ({
    layoutMode: s.layoutMode === 'split' ? 'pip' : 'split',
    cameraLayout: s.cameraLayout === 'pip' ? '3-grid' : 'pip'
  })),
  setPrimaryView: (view) => set({ 
    primaryView: view, 
    primaryCamera: view === 'body' ? 'face_on' : 'impact' 
  }),
  swapPrimaryView: () => {
    const { primaryCamera } = get();
    const next = primaryCamera === 'face_on' ? 'behind' : primaryCamera === 'behind' ? 'impact' : 'face_on';
    set({ 
      primaryCamera: next,
      primaryView: next === 'impact' ? 'impact' : 'body'
    });
  },

  isMuted: true,
  showGuides: true,

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  togglePlay: () => {
    const { isPlaying, currentTime, duration } = get();
    if (!isPlaying && currentTime >= duration - 0.05) {
      set({ currentTime: 0, isPlaying: true });
    } else {
      set({ isPlaying: !isPlaying });
    }
  },

  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  toggleLoop: () => set((s) => ({ isLooping: !s.isLooping })),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),

  seekTo: (time: number) => {
    const { duration } = get();
    const clamped = Math.max(0, Math.min(duration, time));
    set({ currentTime: clamped });
  },

  stepFrames: (count: number, containerFps: number) => {
    const { currentTime, duration } = get();
    const fps = containerFps > 0 ? containerFps : 30;
    const frameDelta = 1 / fps;
    const next = Math.max(0, Math.min(duration, currentTime + count * frameDelta));
    set({ currentTime: next, isPlaying: false });
  },

  jumpToImpact: () => {
    const { duration } = get();
    const impactTime = Math.min(duration, 2.45);
    set({ currentTime: impactTime });
  }
}));
