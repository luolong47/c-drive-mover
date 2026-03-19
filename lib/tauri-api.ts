import { invoke } from '@tauri-apps/api/core';

export interface DiskInfo {
  name: string;
  mount_point: string;
  total_space: number;
  available_space: number;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

export interface TaskSource {
  path: string;
  size: number;
}

export interface MoveTask {
  id: string;
  name: string;
  target_base: string;
  sources: TaskSource[];
  status: 'pending' | 'running' | 'success' | 'failed';
  error?: string;
  created_at: number;
  finished_at?: number;
}

export interface AppSettings {
  default_target_base: string;
  silent_check: boolean;
  blacklist: string[];
}

export async function getDiskInfo(): Promise<DiskInfo[]> {
  return await invoke('get_disk_info');
}

export async function scanDirectory(path: string): Promise<FileEntry[]> {
  return await invoke('scan_directory', { path });
}

export async function getFolderSize(path: string): Promise<number> {
  return await invoke('get_folder_size', { path });
}

export async function getTasks(): Promise<MoveTask[]> {
  return await invoke('get_tasks');
}

export async function saveTask(task: MoveTask): Promise<void> {
  await invoke('save_task', { task });
}

export async function runMigration(task_id: string): Promise<void> {
  await invoke('run_migration', { task_id });
}

export async function restoreTask(task_id: string): Promise<void> {
  await invoke('restore_task', { task_id });
}

export async function getHomeDir(): Promise<string> {
  return await invoke('get_home_dir');
}

export async function searchEverything(query: string): Promise<FileEntry[]> {
  return await invoke('search_everything', { query });
}

export async function selectDirectory(): Promise<string | null> {
  return await invoke('select_directory');
}

export async function getSettings(): Promise<AppSettings> {
  return await invoke('get_settings');
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await invoke('save_settings', { settings });
}
