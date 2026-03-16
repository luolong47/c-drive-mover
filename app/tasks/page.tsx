'use client';

import { useState } from 'react';
import { Search, Play, Edit2, RotateCcw, Trash2, FolderOpen, AlertCircle, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { formatBytes } from '@/lib/utils';

// Mock data for tasks
const initialTasks = [
  {
    id: '1769590899250',
    name: 'antigravity',
    targetBase: 'D:\\Cdata',
    createdAt: Date.now() - 86400000 * 2,
    status: 'completed',
    totalSize: 1024 * 1024 * 1024 * 15.4, // 15.4 GB
    sources: [
      { originalPath: 'C:\\Users\\LuoLong\\.antigravity', size: 1024 * 1024 * 500 },
      { originalPath: 'C:\\Users\\LuoLong\\.gemini', size: 1024 * 1024 * 200 },
    ]
  },
  {
    id: '1769590899251',
    name: 'docker-data',
    targetBase: 'E:\\DockerData',
    createdAt: Date.now() - 86400000 * 5,
    status: 'pending',
    totalSize: 1024 * 1024 * 1024 * 45.2, // 45.2 GB
    sources: [
      { originalPath: 'C:\\ProgramData\\Docker', size: 1024 * 1024 * 1024 * 45.2 },
    ]
  },
  {
    id: '1769590899252',
    name: 'npm-cache',
    targetBase: 'D:\\DevCache',
    createdAt: Date.now() - 86400000 * 10,
    status: 'restored',
    totalSize: 1024 * 1024 * 1024 * 2.1, // 2.1 GB
    sources: [
      { originalPath: 'C:\\Users\\LuoLong\\AppData\\Local\\npm-cache', size: 1024 * 1024 * 1024 * 2.1 },
    ]
  }
];

const statusConfig: Record<string, { label: string, color: string, bg: string }> = {
  pending: { label: '待迁移', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' },
  moving: { label: '迁移中', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' },
  completed: { label: '已迁移', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' },
  error: { label: '异常', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' },
  restored: { label: '已还原', color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700' },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.sources.some(s => s.originalPath.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">方案管理</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">管理、执行或还原迁移任务</p>
        </div>
        <Link 
          href="/create" 
          className="bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <PlusCircle size={16} /> 新建迁移方案
        </Link>
      </header>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="搜索方案名称或源目录路径..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 transition-all"
          />
        </div>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100"
        >
          <option value="all">全部状态</option>
          <option value="pending">待迁移</option>
          <option value="completed">已迁移</option>
          <option value="restored">已还原</option>
        </select>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 transition-colors">
            <FolderOpen className="mx-auto text-zinc-300 dark:text-zinc-600 mb-3" size={32} />
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">没有找到匹配的迁移方案</p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <div key={task.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{task.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig[task.status].bg} ${statusConfig[task.status].color}`}>
                      {statusConfig[task.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    目标盘: {task.targetBase} | 总大小: {formatBytes(task.totalSize)} | 创建于: {new Date(task.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {task.status === 'pending' && (
                    <>
                      <Link href={`/monitor?taskId=${task.id}`} className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md transition-colors" title="执行迁移">
                        <Play size={18} />
                      </Link>
                      <button className="p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors" title="编辑">
                        <Edit2 size={18} />
                      </button>
                    </>
                  )}
                  {task.status === 'completed' && (
                    <button className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-md transition-colors" title="还原至C盘">
                      <RotateCcw size={18} />
                    </button>
                  )}
                  <button className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors" title="删除记录">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 border border-zinc-100 dark:border-zinc-800">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">源目录 ({task.sources.length})</p>
                <div className="space-y-1.5">
                  {task.sources.map((source, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs font-mono">
                      <span className="text-zinc-700 dark:text-zinc-300 truncate pr-4">{source.originalPath}</span>
                      <span className="text-zinc-400 dark:text-zinc-500 shrink-0">{formatBytes(source.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
