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
  is_junction: boolean;
  target_path?: string;
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
  common_prefix: string;
  sources: TaskSource[];
  status: 'pending' | 'running' | 'success' | 'failed';
  error?: string;
  created_at: number;
  finished_at?: number;
}

export interface LogEntry {
  id: number;
  task_id: string;
  msg: string;
  event_type: 'info' | 'warn' | 'error' | 'success';
  created_at: number;
}

export interface AppSettings {
  default_target_base: string;
  silent_check: boolean;
  blacklist: string[];
  webdav_url?: string;
  webdav_username?: string;
  webdav_password?: string;
  webdav_folder?: string;
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

export async function checkPlans(): Promise<number> {
  return await invoke('check_plans');
}

export async function fixUserDirectories(): Promise<number> {
  return await invoke('fix_user_directories');
}

export async function deleteTask(task_id: string): Promise<void> {
  await invoke('delete_task', { taskId: task_id });
}

export async function getTaskLogs(task_id: string): Promise<LogEntry[]> {
  return await invoke('get_task_logs', { taskId: task_id });
}

export async function saveTask(task: MoveTask): Promise<void> {
  await invoke('save_task', { task });
}

export async function runMigration(task_id: string): Promise<void> {
  await invoke('run_migration', { taskId: task_id });
}

export async function restoreTask(task_id: string): Promise<void> {
  await invoke('restore_task', { taskId: task_id });
}

export async function killProcesses(process_names: string[]): Promise<void> {
  await invoke('kill_processes', { processNames: process_names });
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

export async function webdavBackup(settings: AppSettings): Promise<void> {
  await invoke('webdav_backup', { settings });
}

export async function webdavRestore(): Promise<void> {
  await invoke('webdav_restore');
}

export async function testWebdavConnection(settings: AppSettings): Promise<void> {
  await invoke('test_webdav_connection', { settings });
}
