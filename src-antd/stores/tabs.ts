import { create } from 'zustand';

export interface Tab {
  id: string;
  type: 'topic_status' | 'topic_data' | 'consumer_group_status';
  connectionId: string;
  connectionName: string;
  title: string;
  resourceName: string;
}

interface TabsStore {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  openOrSwitchTab: (tab: Tab) => void;
}

export const useTabsStore = create<TabsStore>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) =>
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id })),

  removeTab: (id) =>
    set((s) => {
      const newTabs = s.tabs.filter((t) => t.id !== id);
      const activeTabId =
        s.activeTabId === id
          ? newTabs.length > 0
            ? newTabs[newTabs.length - 1].id
            : null
          : s.activeTabId;
      return { tabs: newTabs, activeTabId };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  openOrSwitchTab: (tab) => {
    const existing = get().tabs.find((t) => t.id === tab.id);
    if (existing) {
      set({ activeTabId: tab.id });
    } else {
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
    }
  },
}));
