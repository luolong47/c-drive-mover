import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export function getCommonPrefix(paths: string[]): string {
  if (!paths || paths.length === 0) return '';

  // Normalize paths to use backslashes for Windows
  const normalizedPaths = paths.map((p) => p.replace(/\//g, '\\'));

  let prefix = normalizedPaths[0];
  for (let i = 1; i < normalizedPaths.length; i++) {
    while (normalizedPaths[i].indexOf(prefix) !== 0) {
      prefix = prefix.substring(0, prefix.lastIndexOf('\\'));
      if (prefix === '') return '';
    }
  }

  // Ensure the prefix ends with a backslash if it's a directory
  return prefix.endsWith('\\') ? prefix : `${prefix}\\`;
}
