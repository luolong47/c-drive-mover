'use client';

import {
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  Folder,
  FolderOpen,
  Loader2,
  Save,
  Search,
  Square,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  type DiskInfo,
  type FileEntry,
  getDiskInfo,
  getFolderSize,
  getHomeDir,
  getSettings,
  type MoveTask,
  saveTask,
  scanDirectory,
  searchEverything,
  selectDirectory,
} from '@/lib/tauri-api';
import { formatBytes, getCommonPrefix } from '@/lib/utils';

interface FileNode extends FileEntry {
  id: string;
  children?: FileNode[];
  loading?: boolean;
  segments?: { name: string; path: string }[];
  is_match?: boolean;
}

// --- 工具函数 ---

function getOrCreateNode(
  allNodes: Map<string, FileNode>,
  path: string,
  name: string,
  roots: FileNode[],
  parent: FileNode | null,
): FileNode {
  let node = allNodes.get(path);
  if (!node) {
    node = {
      id: path,
      name: name || path,
      path,
      is_dir: true,
      size: 0,
      children: [],
    };
    allNodes.set(path, node);
    if (parent) parent.children?.push(node);
    else roots.push(node);
  }
  return node;
}

function processPath(
  path: string,
  query: string,
  allNodes: Map<string, FileNode>,
  roots: FileNode[],
  parentPaths: Set<string>,
) {
  const parts = path.split('\\');
  let currentPath = '';
  let parent: FileNode | null = null;
  let foundFirstMatch = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part && i > 0) continue;

    if (i === 0 && part.endsWith(':')) {
      currentPath = `${part}\\`;
    } else {
      currentPath += (currentPath.endsWith('\\') ? '' : '\\') + part;
    }

    const node = getOrCreateNode(allNodes, currentPath, part, roots, parent);
    if (!foundFirstMatch && parent) parentPaths.add(parent.id);
    if (part.toLowerCase().includes(query.toLowerCase())) {
      foundFirstMatch = true;
      node.is_match = true;
    }
    parent = node;
  }
}

function buildTreeFromPaths(
  entries: FileEntry[],
  query: string,
): { roots: FileNode[]; parentPaths: Set<string> } {
  const allNodes = new Map<string, FileNode>();
  const roots: FileNode[] = [];
  const parentPaths = new Set<string>();

  for (const entry of entries) {
    processPath(entry.path, query, allNodes, roots, parentPaths);
  }
  return { roots, parentPaths };
}

function tryCompactWithChild(node: FileNode): FileNode {
  if (node.children && node.children.length === 1) {
    const child = node.children[0];
    if (!node.is_match && !child.is_match) {
      const sep = node.name.endsWith('\\') ? '' : '\\';
      return {
        ...child,
        name: `${node.name}${sep}${child.name}`,
        segments: [...(node.segments || []), ...(child.segments || [])],
      };
    }
  }
  return node;
}

// 合并单子节点目录以实现紧凑展示，同时保留路径段以便独立勾选
function compactNodes(nodes: FileNode[]): FileNode[] {
  return nodes.map((node) => {
    const current = { ...node };

    // 初始化片段信息
    if (!current.segments) {
      current.segments = [{ name: current.name, path: current.path }];
    }

    // 处理子节点递归（先递归处理，再尝试向上合并）
    if (current.children && current.children.length > 0) {
      current.children = compactNodes(current.children);
    }

    return tryCompactWithChild(current);
  });
}

// --- 子组件 ---

function TreeNode({
  node,
  depth,
  expandedNodes,
  selectedPaths,
  searchQuery,
  toggleNode,
  toggleSelection,
  loadDirectory,
  renderTree,
}: {
  node: FileNode;
  depth: number;
  expandedNodes: Set<string>;
  selectedPaths: Map<string, number>;
  searchQuery: string;
  toggleNode: (node: FileNode) => void;
  toggleSelection: (path: string) => void;
  loadDirectory: (node: FileNode) => void;
  renderTree: (nodes: FileNode[], depth: number) => React.ReactNode;
}) {
  const isSelected = selectedPaths.has(node.path);
  const isExpanded = expandedNodes.has(node.id);

  useEffect(() => {
    if (!searchQuery && isExpanded && !node.children?.length && !node.loading) {
      loadDirectory(node);
    }
  }, [searchQuery, isExpanded, node, loadDirectory]);

  return (
    <div className="select-none">
      <button
        type="button"
        className={`w-full flex items-center gap-2 py-1.5 px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-500/10' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => (node.loading ? null : toggleNode(node))}
      >
        <div className="w-4 h-4 flex items-center justify-center text-zinc-400 dark:text-zinc-500 shrink-0">
          {node.loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <ChevronRight
              size={14}
              className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          )}
        </div>
        <button
          type="button"
          className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            toggleSelection(node.path);
          }}
        >
          {isSelected ? (
            <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400" />
          ) : (
            <Square size={16} />
          )}
        </button>
        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate flex items-center gap-1">
          {node.segments ? (
            node.segments.map((seg, i) => (
              <div key={seg.path} className="flex items-center gap-1">
                <button
                  type="button"
                  className={`px-1 rounded transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-indigo-500/50 ${
                    seg.name.toLowerCase().includes(searchQuery.toLowerCase())
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  } ${
                    selectedPaths.has(seg.path)
                      ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                      : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelection(seg.path);
                  }}
                  title={seg.path}
                >
                  {seg.name}
                </button>
                {i < (node.segments?.length || 0) - 1 && (
                  <span className="text-zinc-400 dark:text-zinc-600 text-xs">\</span>
                )}
              </div>
            ))
          ) : (
            <span>{node.name}</span>
          )}
        </div>
      </button>
      {node.children && isExpanded && <div>{renderTree(node.children, depth + 1)}</div>}
    </div>
  );
}

// --- Hooks ---

function useEverythingSearch(searchQuery: string, setExpandedNodes: (s: Set<string>) => void) {
  const [searchTree, setSearchTree] = useState<FileNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const search = async () => {
      if (!searchQuery.trim()) {
        setSearchTree([]);
        return;
      }
      setIsSearching(true);
      try {
        const results = await searchEverything(searchQuery);
        const { roots, parentPaths } = buildTreeFromPaths(results, searchQuery);
        setSearchTree(roots);
        setExpandedNodes(parentPaths);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, setExpandedNodes]);

  return { searchTree, isSearching };
}

function useInitialize(
  setTargetDisk: (d: DiskInfo | null) => void,
  setRootNodes: (n: FileNode[]) => void,
  setTargetBase: (s: string) => void,
) {
  useEffect(() => {
    const init = async () => {
      try {
        const [disks, homeDir, settings] = await Promise.all([
          getDiskInfo(),
          getHomeDir(),
          getSettings(),
        ]);

        if (settings.default_target_base) {
          setTargetBase(settings.default_target_base);
          const drive = settings.default_target_base.split(':')[0].toUpperCase();
          const disk = disks.find((d) => d.mount_point.startsWith(drive));
          if (disk) setTargetDisk(disk);
        } else {
          const dDrive = disks.find((d) => d.mount_point.startsWith('D'));
          if (dDrive) setTargetDisk(dDrive);
        }

        const nodes = [homeDir].filter(Boolean).map((p) => ({
          id: p,
          name: p.split('\\').pop() || p,
          path: p,
          is_dir: true,
          size: 0,
          children: [],
        }));
        setRootNodes(nodes);
      } catch (err) {
        console.error('Init error:', err);
      }
    };
    init();
  }, [setTargetDisk, setRootNodes, setTargetBase]);
}

function useTaskStatistics(selectedPaths: Map<string, number>, targetDisk: DiskInfo | null) {
  const totalSize = useMemo(
    () => Array.from(selectedPaths.values()).reduce((acc, s) => acc + s, 0),
    [selectedPaths],
  );
  const commonPrefix = useMemo(
    () => getCommonPrefix(Array.from(selectedPaths.keys())),
    [selectedPaths],
  );
  const selectedItems = useMemo(
    () => Array.from(selectedPaths.entries()).map(([path, size]) => ({ path, size })),
    [selectedPaths],
  );
  const freeSpace = targetDisk?.available_space || 1024 * 1024 * 1024 * 100;
  return { totalSize, commonPrefix, selectedItems, freeSpace };
}

function useTaskActions(
  setRootNodes: (updater: (prev: FileNode[]) => FileNode[]) => void,
  selectedPaths: Map<string, number>,
  setSelectedPaths: (m: Map<string, number>) => void,
  expandedNodes: Set<string>,
  setExpandedNodes: (s: Set<string>) => void,
  taskName: string,
  targetBase: string,
  commonPrefix: string,
  setIsSaving: (b: boolean) => void,
  router: ReturnType<typeof useRouter>,
  isBlacklisted: (path: string) => boolean,
  setError: (s: string | null) => void,
) {
  const loadDirectory = async (node: FileNode) => {
    if (node.children?.length || node.loading) return;
    setRootNodes((prev) =>
      prev.map((n) => {
        const update = (curr: FileNode): FileNode => {
          if (curr.id === node.id) return { ...curr, loading: true };
          if (curr.children) return { ...curr, children: curr.children.map(update) };
          return curr;
        };
        return update(n);
      }),
    );
    try {
      const entries = await scanDirectory(node.path);
      const children = entries.map((e) => ({ ...e, id: e.path, children: [] }));
      setRootNodes((prev) =>
        prev.map((n) => {
          const update = (curr: FileNode): FileNode => {
            if (curr.id === node.id) return { ...curr, children, loading: false };
            if (curr.children) return { ...curr, children: curr.children.map(update) };
            return curr;
          };
          return update(n);
        }),
      );
    } catch (err) {
      console.error('Scan error:', err);
    }
  };
  const toggleNode = (node: FileNode) => {
    const next = new Set(expandedNodes);
    if (next.has(node.id)) next.delete(node.id);
    else {
      next.add(node.id);
      loadDirectory(node);
    }
    setExpandedNodes(next);
  };
  const toggleSelection = async (path: string) => {
    if (isBlacklisted(path)) {
      setError(`该路径已在黑名单中，禁止迁移：${path}`);
      setTimeout(() => setError(null), 3000);
      return;
    }
    setError(null);
    const next = new Map(selectedPaths);
    if (next.has(path)) next.delete(path);
    else {
      try {
        const size = await getFolderSize(path);
        next.set(path, size);
      } catch (err) {
        console.error('Size error:', err);
      }
    }
    setSelectedPaths(next);
  };
  const handleSave = async () => {
    if (!taskName || selectedPaths.size === 0 || !targetBase) return;

    // 二次确认黑名单
    for (const path of selectedPaths.keys()) {
      if (isBlacklisted(path)) {
        setError(`路径 ${path} 在黑名单中，无法保存方案。`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const task: MoveTask = {
        id: crypto.randomUUID(),
        name: taskName,
        target_base: targetBase,
        common_prefix: commonPrefix,
        sources: Array.from(selectedPaths.entries()).map(([p, s]) => ({
          path: p.replace(/\//g, '\\'),
          size: s,
        })),
        status: 'pending',
        created_at: Math.floor(Date.now() / 1000),
      };
      await saveTask(task);
      router.push('/tasks');
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };
  return { loadDirectory, toggleNode, toggleSelection, handleSave };
}

// --- 视图组件 ---

interface TaskConfigurationSectionProps {
  taskName: string;
  setTaskName: (s: string) => void;
  targetBase: string;
  handleBrowse: () => void;
  setTargetBase: (s: string) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  isAnyLoading: boolean;
  isSearching: boolean;
  displayRoots: FileNode[];
  renderTree: (nodes: FileNode[], depth?: number) => React.ReactNode;
}

function TaskConfigurationSection({
  taskName,
  setTaskName,
  targetBase,
  handleBrowse,
  setTargetBase,
  searchQuery,
  setSearchQuery,
  isAnyLoading,
  isSearching,
  displayRoots,
  renderTree,
}: TaskConfigurationSectionProps) {
  return (
    <div className="lg:col-span-7 flex flex-col gap-6 min-w-0">
      <div className="bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 shrink-0 transition-colors">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label
              htmlFor="task-name"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              方案名称
            </label>
            <input
              id="task-name"
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="例如: AppData-Move"
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border-none rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-900 dark:text-zinc-100 transition-all font-mono"
            />
          </div>
          <div className="min-w-0">
            <label
              htmlFor="target-base"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              目标基础路径
            </label>
            <div className="flex gap-2">
              <input
                id="target-base"
                type="text"
                value={targetBase}
                onChange={(e) => setTargetBase(e.target.value)}
                placeholder="D:\Cdrive-Mover"
                className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-zinc-900 border-none rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-900 dark:text-zinc-100 transition-all font-mono"
              />
              <button
                type="button"
                onClick={handleBrowse}
                className="p-2.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md transition-all flex items-center justify-center border-none shadow-sm hover:shadow-md active:scale-95 shrink-0"
                title="选择目录"
              >
                <FolderOpen size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 flex flex-col flex-1 min-h-0 transition-colors">
        <div className="flex justify-between items-center mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              选择源目录 (Sources)
            </h2>
            {isAnyLoading && (
              <Loader2 size={14} className="animate-spin text-indigo-500 opacity-80" />
            )}
          </div>
          <div className="relative w-48">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
              size={14}
            />
            <input
              type="text"
              placeholder="搜索目录"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-900 border-none rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-900 dark:text-zinc-100 transition-all"
            />
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-2 overflow-y-auto flex-1 custom-scrollbar transition-colors">
          {searchQuery ? (
            displayRoots.length === 0 && !isSearching ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 py-12">
                <Search size={32} className="mb-2 opacity-50" />
                <p className="text-xs">未找到匹配目录 (请确保输入的路径正确)</p>
              </div>
            ) : (
              renderTree(displayRoots)
            )
          ) : displayRoots.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600">
              <Loader2 size={24} className="animate-spin mb-2 opacity-50" />
              <p className="text-xs">正在初始化目录...</p>
            </div>
          ) : (
            renderTree(displayRoots)
          )}
        </div>
      </div>
    </div>
  );
}

interface TaskPreviewSectionProps {
  totalSize: number;
  freeSpace: number;
  selectedItems: { path: string; size: number }[];
  commonPrefix: string;
  targetBase: string;
  taskName: string;
}

function TaskPreviewSection({
  totalSize,
  freeSpace,
  selectedItems,
  commonPrefix,
  targetBase,
  taskName,
}: TaskPreviewSectionProps) {
  return (
    <div className="lg:col-span-5 flex flex-col gap-6 min-w-0">
      <div
        className={`bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 shrink-0 transition-colors ${totalSize > freeSpace ? 'bg-red-100/60 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' : ''}`}
      >
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4">容量预估</h2>
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">预计迁移总大小</span>
          <span
            className={`text-3xl font-light font-mono ${totalSize > freeSpace ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}
          >
            {totalSize === 0 ? '0 Bytes' : formatBytes(totalSize)}
          </span>
        </div>
        <div className="h-2 bg-white dark:bg-zinc-900 rounded-full overflow-hidden mb-2 transition-colors">
          <div
            className={`h-full transition-all duration-500 ${totalSize > freeSpace ? 'bg-red-500 dark:bg-red-400' : 'bg-indigo-500 dark:bg-indigo-400'}`}
            style={{ width: `${Math.min((totalSize / freeSpace) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs font-mono">
          <span className="text-zinc-500 dark:text-zinc-400">
            目标盘剩余: {formatBytes(freeSpace)}
          </span>
          <span
            className={
              totalSize > freeSpace
                ? 'text-red-500 dark:text-red-400 font-medium'
                : 'text-zinc-400 dark:text-zinc-500'
            }
          >
            {((totalSize / freeSpace) * 100).toFixed(1)}%
          </span>
        </div>
        {totalSize > freeSpace && (
          <div className="mt-4 flex items-start gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-3 rounded-md border border-red-100 dark:border-red-500/20">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs font-medium leading-relaxed">
              目标盘空间不足！请清理目标磁盘或减少选中的源目录。
            </p>
          </div>
        )}
      </div>

      <div className="bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 flex flex-col flex-1 min-h-0 transition-colors">
        <div className="mb-3 shrink-0">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">路径映射预览</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            系统将自动提取公共前缀并保留目录层级结构
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 overflow-y-auto flex-1 custom-scrollbar transition-colors">
          {selectedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600">
              <Folder size={32} className="mb-2 opacity-50" />
              <p className="text-xs">请在左侧选择需要迁移的目录</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-md border border-zinc-100 dark:border-zinc-800 transition-colors">
                <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  提取的最长公共前缀
                </p>
                <p className="text-xs font-mono text-zinc-800 dark:text-zinc-200 break-all">
                  {commonPrefix || '无'}
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  生成的目标路径
                </p>
                {selectedItems.map((item) => {
                  const normalizedPath = item.path.replace(/\//g, '\\');
                  const normalizedPrefix = commonPrefix.replace(/\//g, '\\');
                  const rel = normalizedPath.startsWith(normalizedPrefix)
                    ? normalizedPath.substring(normalizedPrefix.length).replace(/^[\\/]/, '')
                    : normalizedPath.split(/[\\/]/).pop() || '';

                  const final = `${targetBase}\\${taskName || '[方案名]'}\\${rel}`.replace(
                    /\\\\/g,
                    '\\',
                  );
                  return (
                    <div
                      key={item.path}
                      className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-md border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden group transition-colors"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 dark:bg-indigo-400" />
                      <p
                        className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate mb-1"
                        title={item.path}
                      >
                        源: {item.path}
                      </p>
                      <p className="text-xs font-mono text-indigo-700 dark:text-indigo-400 break-all">
                        {final}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CreateTaskViewProps {
  router: ReturnType<typeof useRouter>;
  taskName: string;
  setTaskName: (s: string) => void;
  targetBase: string;
  setTargetBase: (s: string) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  selectedPaths: Map<string, number>;
  isSaving: boolean;
  isSearching: boolean;
  totalSize: number;
  freeSpace: number;
  commonPrefix: string;
  selectedItems: { path: string; size: number }[];
  displayRoots: FileNode[];
  handleSave: () => void;
  handleBrowse: () => void;
  renderTree: (nodes: FileNode[], depth?: number) => React.ReactNode;
  isAnyLoading: boolean;
  error: string | null;
}

function CreateTaskView({
  router,
  taskName,
  setTaskName,
  targetBase,
  setTargetBase,
  searchQuery,
  setSearchQuery,
  selectedPaths,
  isSaving,
  isSearching,
  totalSize,
  freeSpace,
  commonPrefix,
  selectedItems,
  displayRoots,
  handleSave,
  handleBrowse,
  renderTree,
  isAnyLoading,
  error,
}: CreateTaskViewProps) {
  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
      <header className="mb-6 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            新建迁移方案
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">配置需要迁移的 C 盘目录与目标路径</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2"
          >
            <X size={16} /> 取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={
              !taskName ||
              selectedPaths.size === 0 ||
              !targetBase ||
              totalSize > freeSpace ||
              isSaving
            }
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            保存方案
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        <TaskConfigurationSection
          taskName={taskName}
          setTaskName={setTaskName}
          targetBase={targetBase}
          handleBrowse={handleBrowse}
          setTargetBase={setTargetBase}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isAnyLoading={isAnyLoading}
          isSearching={isSearching}
          displayRoots={displayRoots}
          renderTree={renderTree}
        />
        <TaskPreviewSection
          totalSize={totalSize}
          freeSpace={freeSpace}
          selectedItems={selectedItems}
          commonPrefix={commonPrefix}
          targetBase={targetBase}
          taskName={taskName}
        />
      </div>
    </div>
  );
}

// --- 主页面 ---

export default function CreateTaskPage() {
  const router = useRouter();
  const [taskName, setTaskName] = useState('');
  const [targetBase, setTargetBase] = useState('D:\\Cdrive-Mover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<Map<string, number>>(new Map());
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [targetDisk, setTargetDisk] = useState<DiskInfo | null>(null);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const syncDisk = async () => {
      if (!targetBase) return;
      try {
        const [disks, settings] = await Promise.all([getDiskInfo(), getSettings()]);
        setBlacklist(settings.blacklist || []);
        const drive = targetBase.split(':')[0].toUpperCase();
        const disk = disks.find((d) => d.mount_point.startsWith(drive));
        if (disk) setTargetDisk(disk);
      } catch (err) {
        console.error('Disk sync error:', err);
      }
    };
    syncDisk();
  }, [targetBase]);

  const isBlacklisted = (path: string) => {
    return blacklist.some((b) => {
      const bLower = b.toLowerCase().replace(/\\$/, '');
      const pLower = path.toLowerCase().replace(/\\$/, '');
      return pLower === bLower || pLower.startsWith(`${bLower}\\`);
    });
  };

  const handleBrowse = async () => {
    try {
      const selected = await selectDirectory();
      if (selected) setTargetBase(selected);
    } catch (err) {
      console.error('Browse error:', err);
    }
  };

  const { searchTree, isSearching } = useEverythingSearch(searchQuery, setExpandedNodes);
  const { totalSize, commonPrefix, selectedItems, freeSpace } = useTaskStatistics(
    selectedPaths,
    targetDisk,
  );
  const { loadDirectory, toggleNode, toggleSelection, handleSave } = useTaskActions(
    setRootNodes,
    selectedPaths,
    setSelectedPaths,
    expandedNodes,
    setExpandedNodes,
    taskName,
    targetBase,
    commonPrefix,
    setIsSaving,
    router,
    isBlacklisted,
    setError,
  );

  useInitialize(setTargetDisk, setRootNodes, setTargetBase);

  const isAnyLoading = useMemo(
    () =>
      isSearching ||
      (function check(nodes: FileNode[]): boolean {
        return nodes.some((n) => n.loading || (n.children && check(n.children)));
      })(rootNodes),
    [rootNodes, isSearching],
  );

  const displayRoots = useMemo(() => {
    const raw = searchQuery ? searchTree : rootNodes;
    return compactNodes(raw);
  }, [searchQuery, searchTree, rootNodes]);

  const renderTree = (nodes: FileNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => (
      <TreeNode
        key={node.id}
        node={node}
        depth={depth}
        expandedNodes={expandedNodes}
        selectedPaths={selectedPaths}
        searchQuery={searchQuery}
        toggleNode={toggleNode}
        toggleSelection={toggleSelection}
        loadDirectory={loadDirectory}
        renderTree={renderTree}
      />
    ));

  return (
    <CreateTaskView
      router={router}
      taskName={taskName}
      setTaskName={setTaskName}
      targetBase={targetBase}
      setTargetBase={setTargetBase}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      selectedPaths={selectedPaths}
      isSaving={isSaving}
      isSearching={isSearching}
      totalSize={totalSize}
      freeSpace={freeSpace}
      commonPrefix={commonPrefix}
      selectedItems={selectedItems}
      displayRoots={displayRoots}
      handleSave={handleSave}
      handleBrowse={handleBrowse}
      renderTree={renderTree}
      isAnyLoading={isAnyLoading}
      error={error}
    />
  );
}
