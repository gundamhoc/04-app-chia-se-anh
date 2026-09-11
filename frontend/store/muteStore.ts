import { create } from 'zustand';

// Danh sách hội thoại/nhóm đang TẮT thông báo (đồng bộ từ API conversations + groups)
// Dùng để chặn Local Notification nền khi có tin nhắn mới gửi tới

interface MuteState {
  mutedDirectIds: number[];
  mutedGroupIds: number[];
  setMutedDirect: (ids: number[]) => void;
  setMutedGroups: (ids: number[]) => void;
  setDirectMuted: (friendId: number, muted: boolean) => void;
  setGroupMuted: (groupId: number, muted: boolean) => void;
}

export const useMuteStore = create<MuteState>((set) => ({
  mutedDirectIds: [],
  mutedGroupIds: [],

  setMutedDirect: (ids) => set({ mutedDirectIds: ids }),
  setMutedGroups: (ids) => set({ mutedGroupIds: ids }),

  setDirectMuted: (friendId, muted) =>
    set((state) => ({
      mutedDirectIds: muted
        ? Array.from(new Set([...state.mutedDirectIds, friendId]))
        : state.mutedDirectIds.filter((id) => id !== friendId),
    })),

  setGroupMuted: (groupId, muted) =>
    set((state) => ({
      mutedGroupIds: muted
        ? Array.from(new Set([...state.mutedGroupIds, groupId]))
        : state.mutedGroupIds.filter((id) => id !== groupId),
    })),
}));
