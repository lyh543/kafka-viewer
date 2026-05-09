import { invoke } from '@tauri-apps/api/core';

export interface UpdateInfo {
  has_update: boolean;
  latest_version: string;
  download_url: string;
  release_notes: string;
}

export interface CacheStats {
  used_mb: number;
  limit_mb: number;
}

export async function checkUpdate(): Promise<UpdateInfo> {
  return invoke('check_update');
}

export async function getCacheStats(): Promise<CacheStats> {
  return invoke('get_cache_stats');
}
