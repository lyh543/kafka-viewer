import { create } from 'zustand';
import { getRecentLogs } from '@/api/system';

interface LogStore {
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  lines: string[];
  openDialog: () => Promise<void>;
  reload: () => Promise<void>;
  close: () => void;
}

const MAX_LINES = 500;

export const useLogStore = create<LogStore>((set) => {
  const load = async () => {
    set({ loading: true, error: null });

    try {
      const lines = await getRecentLogs(MAX_LINES);
      set({ lines, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  };

  return {
    isOpen: false,
    loading: false,
    error: null,
    lines: [],
    openDialog: async () => {
      set({ isOpen: true });
      await load();
    },
    reload: load,
    close: () => set({ isOpen: false }),
  };
});
