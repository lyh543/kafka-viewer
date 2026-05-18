import { create } from 'zustand';
import type { Project, RecentProject } from '../types/project';

interface ProjectStore {
  currentProject: Project | null;
  recentProjects: RecentProject[];
  setCurrentProject: (project: Project | null) => void;
  setRecentProjects: (projects: RecentProject[]) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  recentProjects: [],
  setCurrentProject: (project) => set({ currentProject: project }),
  setRecentProjects: (projects) => set({ recentProjects: projects }),
}));
