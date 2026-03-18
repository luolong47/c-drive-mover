'use client';

import {
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  Folder,
  Loader2,
  Save,
  Search,
  Square,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import {
  type DiskInfo,
  type FileEntry,
  getDiskInfo,
  getFolderSize,
  type MoveTask,
  saveTask,
  scanDirectory,
} from '@/lib/tauri-api';
import { formatBytes, getCommonPrefix } from '@/lib/utils';

interface FileNode extends FileEntry {
  id: string;
  children?: FileNode[];
  loading?: boolean;
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  expandedNodes: Set<string>;
  selectedPaths: Map<string, number>;
  searchQuery: string;
  toggleNode: (node: FileNode) => void;
  toggleSelection: (path: string) => void;
  renderTree: (nodes: FileNode[], depth: number) => React.ReactNode;
}

function TreeNode({
  node,
  depth,
  expandedNodes,
  selectedPaths,
  searchQuery,
  toggleNode,
  toggleSelection,
  renderTree,
}: TreeNodeProps) {
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedPaths.has(node.path);

  if (
    searchQuery &&
    !node.path.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !node.children?.some((c: FileNode) => c.path.toLowerCase().includes(searchQuery.toLowerCase()))
  ) {
    return null;
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!node.loading) toggleNode(node);
    }
  };

  const handleSelectKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      toggleSelection(node.path);
    }
  };

  return (
    <div className="select-none">
      <button
        type="button"
        className={`w-full flex items-center gap-2 py-1.5 px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-500/10' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => (node.loading ? null : toggleNode(node))}
        onKeyDown={handleKeyDown}
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
          onKeyDown={handleSelectKeyDown}
        >
          {isSelected ? (
            <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400" />
          ) : (
            <Square size={16} />
          )}
        </button>

        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
          {node.name}
        </span>
      </button>

      {node.children && isExpanded && <div>{renderTree(node.children, depth + 1)}</div>}
    </div>
  );
}

export default function CreateTaskPage() {
  const router = useRouter();
  const [taskName, setTaskName] = useState('');
  const [targetBase, setTargetBase] = useState('D:\\Cdrive-Mover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<Map<string, number>>(new Map());
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [targetDisk, setTargetDisk] = useState<DiskInfo | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const disks = await getDiskInfo();
        const dDrive = disks.find((d) => d.mount_point.startsWith('D'));
        if (dDrive) setTargetDisk(dDrive);

        const initialPaths = [
          'C:\\Users',
          'C:\\ProgramData',
          'C:\\Program Files',
          'C:\\Program Files (x86)',
        ];

        const nodes = initialPaths.map((p) => ({
          id: p,
          name: p.split('\\').pop() || p,
          path: p,
          is_dir: true,
          size: 0,
        }));
        setRootNodes(nodes);
      } catch (err) {
        console.error('Init failed:', err);
      }
    };
    init();
  }, []);

  const totalSize = useMemo(() => {
    return Array.from(selectedPaths.values()).reduce((acc, s) => acc + s, 0);
  }, [selectedPaths]);

  const commonPrefix = useMemo(() => {
    return getCommonPrefix(Array.from(selectedPaths.keys()));
  }, [selectedPaths]);

  const selectedItems = useMemo(() => {
    return Array.from(selectedPaths.entries()).map(([path, size]) => ({ path, size }));
  }, [selectedPaths]);

  const loadDirectory = async (node: FileNode) => {
    if (node.children || node.loading) return;

    const updateLoading = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((n) => {
        if (n.id === node.id) return { ...n, loading: true };
        if (n.children) return { ...n, children: updateLoading(n.children) };
        return n;
      });
    };
    setRootNodes((prev) => updateLoading(prev));

    try {
      const entries = await scanDirectory(node.path);
      const children = entries.map((e) => ({
        ...e,
        id: e.path,
      }));

      const updateChildren = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((n) => {
          if (n.id === node.id) return { ...n, children, loading: false };
          if (n.children) return { ...n, children: updateChildren(n.children) };
          return n;
        });
      };
      setRootNodes((prev) => updateChildren(prev));
    } catch (err) {
      console.error('Scan failed:', err);
      const resetLoading = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((n) => {
          if (n.id === node.id) return { ...n, loading: false };
          if (n.children) return { ...n, children: resetLoading(n.children) };
          return n;
        });
      };
      setRootNodes((prev) => resetLoading(prev));
    }
  };

  const toggleNode = (node: FileNode) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(node.id)) {
      newExpanded.delete(node.id);
    } else {
      newExpanded.add(node.id);
      loadDirectory(node);
    }
    setExpandedNodes(newExpanded);
  };

  const toggleSelection = async (path: string) => {
    const newSelected = new Map(selectedPaths);
    if (newSelected.has(path)) {
      newSelected.delete(path);
      setSelectedPaths(newSelected);
    } else {
      try {
        const size = await getFolderSize(path);
        newSelected.set(path, size);
        setSelectedPaths(newSelected);
      } catch (err) {
        console.error('Size calculation failed:', err);
      }
    }
  };

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <TreeNode
        key={node.id}
        node={node}
        depth={depth}
        expandedNodes={expandedNodes}
        selectedPaths={selectedPaths}
        searchQuery={searchQuery}
        toggleNode={toggleNode}
        toggleSelection={toggleSelection}
        renderTree={renderTree}
      />
    ));
  };

  const handleSave = async () => {
    if (!taskName || selectedPaths.size === 0 || !targetBase) return;
    setIsSaving(true);
    try {
      const newTask: MoveTask = {
        id: crypto.randomUUID(),
        name: taskName,
        target_base: targetBase,
        sources: Array.from(selectedPaths.entries()).map(([path, size]) => ({ path, size })),
        status: 'pending',
        created_at: Math.floor(Date.now() / 1000),
      };
      await saveTask(newTask);
      router.push('/tasks');
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Capacity check
  const FREE_SPACE = targetDisk?.available_space || 1024 * 1024 * 1024 * 100;
  const isOverCapacity = totalSize > FREE_SPACE;

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
              !taskName || selectedPaths.size === 0 || !targetBase || isOverCapacity || isSaving
            }
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            保存方案
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-7 flex flex-col gap-6 min-h-0">
          <div className="bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 shrink-0 transition-colors">
            <div className="grid grid-cols-2 gap-4">
              <div>
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
              <div>
                <label
                  htmlFor="target-base"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  目标基础路径 (Target Base)
                </label>
                <div className="flex gap-2">
                  <input
                    id="target-base"
                    type="text"
                    value={targetBase}
                    onChange={(e) => setTargetBase(e.target.value)}
                    placeholder="D:\Cdrive-Mover"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border-none rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-900 dark:text-zinc-100 transition-all font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 flex flex-col flex-1 min-h-0 transition-colors">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                选择源目录 (Sources)
              </h2>
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
              {renderTree(rootNodes)}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6 min-h-0">
          <div
            className={`bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 shrink-0 transition-colors ${isOverCapacity ? 'bg-red-100/60 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' : ''}`}
          >
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4">容量预估</h2>
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">预计迁移总大小</span>
              <span
                className={`text-3xl font-light font-mono ${isOverCapacity ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}
              >
                {totalSize === 0 ? '0 Bytes' : formatBytes(totalSize)}
              </span>
            </div>

            <div className="h-2 bg-white dark:bg-zinc-900 rounded-full overflow-hidden mb-2 transition-colors">
              <div
                className={`h-full transition-all duration-500 ${isOverCapacity ? 'bg-red-500 dark:bg-red-400' : 'bg-indigo-500 dark:bg-indigo-400'}`}
                style={{ width: `${Math.min((totalSize / FREE_SPACE) * 100, 100)}%` }}
              />
            </div>

            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-500 dark:text-zinc-400">
                目标盘剩余: {formatBytes(FREE_SPACE)}
              </span>
              <span
                className={
                  isOverCapacity
                    ? 'text-red-500 dark:text-red-400 font-medium'
                    : 'text-zinc-400 dark:text-zinc-500'
                }
              >
                {((totalSize / FREE_SPACE) * 100).toFixed(1)}%
              </span>
            </div>

            {isOverCapacity && (
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
                      const relativePath = item.path.substring(commonPrefix.length);
                      const finalPath = `${targetBase}\\${taskName || '[方案名]'}\\${relativePath}`;

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
                            {finalPath}
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
      </div>
    </div>
  );
}
