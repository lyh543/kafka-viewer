// Project types
export interface Project {
  name: string;
  path: string;
}

export interface RecentProject {
  name: string;
  path: string;
  last_opened: string;
}

export interface GlobalConfig {
  recent_projects: RecentProject[];
  settings: AppSettings;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  locale: string;
  zoom: number;
  cache_per_page_mb: number;
  cache_total_mb: number;
}
