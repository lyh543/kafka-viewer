import type { Project, RecentProject } from '../types/project';
import { invokeLogged } from '../utils/logger';

export async function createProject(name: string, path: string): Promise<Project> {
  return invokeLogged('create_project', { name, path });
}

export async function openProject(path: string): Promise<Project> {
  return invokeLogged('open_project', { path });
}

export async function closeProject(): Promise<void> {
  return invokeLogged('close_project');
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  return invokeLogged('get_recent_projects');
}

export async function removeRecentProject(path: string): Promise<void> {
  return invokeLogged('remove_recent_project', { path });
}
