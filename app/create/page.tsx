'use client';

import { useState, useMemo } from 'react';
import { Folder, ChevronRight, ChevronDown, CheckSquare, Square, Save, X, Search, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatBytes, getCommonPrefix } from '@/lib/utils';

// Mock file system tree
const mockFileSystem = [
  {
    id: 'users',
    name: 'Users',
    path: 'C:\\Users',
    size: 0,
    children: [
      {
        id: 'luolong',
        name: 'LuoLong',
        path: 'C:\\Users\\LuoLong',
        size: 0,
        children: [
          { id: 'antigravity', name: '.antigravity', path: 'C:\\Users\\LuoLong\\.antigravity', size: 1024 * 1024 * 500, isDir: true },
          { id: 'gemini', name: '.gemini', path: 'C:\\Users\\LuoLong\\.gemini', size: 1024 * 1024 * 200, isDir: true },
          { id: 'vscode', name: '.vscode', path: 'C:\\Users\\LuoLong\\.vscode', size: 1024 * 1024 * 1200, isDir: true },
          {
            id: 'appdata',
            name: 'AppData',
            path: 'C:\\Users\\LuoLong\\AppData',
            size: 0,
            children: [
              {
                id: 'roaming',
                name: 'Roaming',
                path: 'C:\\Users\\LuoLong\\AppData\\Roaming',
                size: 0,
                children: [
                  { id: 'antigravity-app', name: 'Antigravity', path: 'C:\\Users\\LuoLong\\AppData\\Roaming\\Antigravity', size: 1024 * 1024 * 1500, isDir: true },
                  { id: 'wechat', name: 'Tencent\\WeChat', path: 'C:\\Users\\LuoLong\\AppData\\Roaming\\Tencent\\WeChat', size: 1024 * 1024 * 1024 * 12, isDir: true },
                ]
              },
              {
                id: 'local',
                name: 'Local',
                path: 'C:\\Users\\LuoLong\\AppData\\Local',
                size: 0,
                children: [
                  { id: 'npm-cache', name: 'npm-cache', path: 'C:\\Users\\LuoLong\\AppData\\Local\\npm-cache', size: 1024 * 1024 * 1024 * 2.1, isDir: true },
                  { id: 'google-chrome', name: 'Google\\Chrome', path: 'C:\\Users\\LuoLong\\AppData\\Local\\Google\\Chrome', size: 1024 * 1024 * 1024 * 3.5, isDir: true },
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'programdata',
    name: 'ProgramData',
    path: 'C:\\ProgramData',
    size: 0,
    children: [
      { id: 'docker', name: 'Docker', path: 'C:\\ProgramData\\Docker', size: 1024 * 1024 * 1024 * 45.2, isDir: true },
      { id: 'nvidia', name: 'NVIDIA', path: 'C:\\ProgramData\\NVIDIA', size: 1024 * 1024 * 1024 * 1.8, isDir: true },
    ]
  }
];

// Flatten tree for easier search and selection
function flattenTree(nodes: any[], result: any[] = []) {
  for (const node of nodes) {
    if (node.isDir) {
      result.push(node);
    }
    if (node.children) {
      flattenTree(node.children, result);
    }
  }
  return result;
}

const flatFileSystem = flattenTree(mockFileSystem);

export default function CreateTaskPage() {
  const router = useRouter();
  const [taskName, setTaskName] = useState('');
  const [targetBase, setTargetBase] = useState('D:\\Cdata');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['users', 'luolong', 'appdata', 'roaming']));

  // Calculate selected items and totals
  const selectedItems = useMemo(() => {
    return flatFileSystem.filter(item => selectedPaths.has(item.path));
  }, [selectedPaths]);

  const totalSize = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + item.size, 0);
  }, [selectedItems]);

  const commonPrefix = useMemo(() => {
    return getCommonPrefix(Array.from(selectedPaths));
  }, [selectedPaths]);

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const toggleSelection = (path: string) => {
    const newSelected = new Set(selectedPaths);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedPaths(newSelected);
  };

  const renderTree = (nodes: any[], depth = 0) => {
    return nodes.map(node => {
      const isExpanded = expandedNodes.has(node.id);
      const isSelected = selectedPaths.has(node.path);
      
      // Filter logic
      if (searchQuery && !node.path.toLowerCase().includes(searchQuery.toLowerCase()) && !node.children?.some((c: any) => c.path.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return null;
      }

      return (
        <div key={node.id} className="select-none">
          <div 
            className={`flex items-center gap-2 py-1.5 px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-500/10' : ''}`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => node.isDir ? toggleSelection(node.path) : toggleNode(node.id)}
          >
            <div className="w-4 h-4 flex items-center justify-center text-zinc-400 dark:text-zinc-500 shrink-0">
              {node.children && (
                isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              )}
            </div>
            
            {node.isDir ? (
              <div 
                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                onClick={(e) => { e.stopPropagation(); toggleSelection(node.path); }}
              >
                {isSelected ? <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400" /> : <Square size={16} />}
              </div>
            ) : (
              <Folder size={16} className="text-zinc-400 dark:text-zinc-500" />
            )}
            
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">{node.name}</span>
            {node.isDir && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-auto font-mono">{formatBytes(node.size)}</span>
            )}
          </div>
          
          {node.children && isExpanded && (
            <div>{renderTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  const handleSave = () => {
    if (!taskName || selectedPaths.size === 0 || !targetBase) return;
    // In a real app, save to tasks.json via IPC
    router.push('/tasks');
  };

  // Capacity check (mocking D drive has 100GB free)
  const FREE_SPACE = 1024 * 1024 * 1024 * 100; // 100 GB
  const isOverCapacity = totalSize > FREE_SPACE;

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
      <header className="mb-6 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">新建迁移方案</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">配置需要迁移的 C 盘目录与目标路径</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2"
          >
            <X size={16} /> 取消
          </button>
          <button 
            onClick={handleSave}
            disabled={!taskName || selectedPaths.size === 0 || !targetBase || isOverCapacity}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <Save size={16} /> 保存方案
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Column: Configuration & Source Selection */}
        <div className="lg:col-span-7 flex flex-col gap-6 min-h-0">
          {/* Basic Config */}
          <div className="bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 shrink-0 transition-colors">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">方案名称</label>
                <input 
                  type="text" 
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="例如: antigravity"
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border-none rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-900 dark:text-zinc-100 transition-all font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">目标基础路径 (Target Base)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={targetBase}
                    onChange={(e) => setTargetBase(e.target.value)}
                    placeholder="D:\Cdata"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border-none rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-zinc-900 dark:text-zinc-100 transition-all font-mono"
                  />
                  <button className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md text-sm font-medium transition-colors">
                    浏览
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Directory Tree */}
          <div className="bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 flex flex-col flex-1 min-h-0 transition-colors">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">选择源目录 (Sources)</h2>
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={14} />
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
              {renderTree(mockFileSystem)}
            </div>
          </div>
        </div>

        {/* Right Column: Preview & Summary */}
        <div className="lg:col-span-5 flex flex-col gap-6 min-h-0">
          {/* Summary Card */}
          <div className={`bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 shrink-0 transition-colors ${isOverCapacity ? 'bg-red-100/60 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' : ''}`}>
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4">容量预估</h2>
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">预计迁移总大小</span>
              <span className={`text-3xl font-light font-mono ${isOverCapacity ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
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
              <span className="text-zinc-500 dark:text-zinc-400">目标盘剩余: {formatBytes(FREE_SPACE)}</span>
              <span className={isOverCapacity ? 'text-red-500 dark:text-red-400 font-medium' : 'text-zinc-400 dark:text-zinc-500'}>
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

          {/* Path Mapping Preview */}
          <div className="bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 flex flex-col flex-1 min-h-0 transition-colors">
            <div className="mb-3 shrink-0">
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">路径映射预览</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">系统将自动提取公共前缀并保留目录层级结构</p>
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
                    <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">提取的最长公共前缀</p>
                    <p className="text-xs font-mono text-zinc-800 dark:text-zinc-200 break-all">{commonPrefix || '无'}</p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">生成的目标路径</p>
                    {selectedItems.map((item, idx) => {
                      const relativePath = item.path.substring(commonPrefix.length);
                      const finalPath = `${targetBase}\\${taskName || '[方案名]'}\\${relativePath}`;
                      
                      return (
                        <div key={idx} className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-md border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden group transition-colors">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 dark:bg-indigo-400" />
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate mb-1" title={item.path}>
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
