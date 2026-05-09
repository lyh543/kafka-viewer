import { invoke } from '@tauri-apps/api/core';
import type { Project, RecentProject } from '../types/project';

export async function createProject(name: string, path: string): Promise<Project> {
  return invoke('create_project', { name, path });
}

export async function openProject(path: string): Promise<Project> {
  return invoke('open_project', { path });
}

export async function closeProject(): Promise<void> {
  return invoke('close_project');
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  return invoke('get_recent_projects');
}

export async function removeRecentProject(path: string): Promise<void> {
  return invoke('remove_recent_project', { path });
}
