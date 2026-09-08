import { create } from 'zustand';

interface PresenceState {
  onlineUserIds: number[];
  setOnlineUsers: (ids: number[]) => void;
  setUserOnline: (userId: number) => void;
  setUserOffline: (userId: number) => void;
  isUserOnline: (userId: number | undefined | null) => boolean;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUserIds: [],

  setOnlineUsers: (ids) => {
    if (!Array.isArray(ids)) return;
    const cleanIds = Array.from(
      new Set(
        ids
          .map((id) => Number(id))
          .filter((id) => !isNaN(id) && id > 0)
      )
    );
    set({ onlineUserIds: cleanIds });
  },

  setUserOnline: (userId) => {
    const uid = Number(userId);
    if (isNaN(uid) || uid <= 0) return;
    set((state) => {
      if (state.onlineUserIds.includes(uid)) return state;
      return { onlineUserIds: [...state.onlineUserIds, uid] };
    });
  },

  setUserOffline: (userId) => {
    const uid = Number(userId);
    if (isNaN(uid) || uid <= 0) return;
    set((state) => ({
      onlineUserIds: state.onlineUserIds.filter((id) => id !== uid),
    }));
  },

  isUserOnline: (userId) => {
    if (!userId) return false;
    const uid = Number(userId);
    return get().onlineUserIds.includes(uid);
  },
}));
