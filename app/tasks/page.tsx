'use client';

import {
  AlertCircle,
  FileText,
  FolderOpen,
  Loader2,
  Play,
  PlusCircle,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { deleteTask, getTasks, type MoveTask } from '@/lib/tauri-api';
import { formatBytes } from '@/lib/utils';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: {
    label: '待迁移',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  },
  running: {
    label: '迁移中',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
  },
  success: {
    label: '已完成',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  },
  failed: {
    label: '失败',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
  },
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<MoveTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchTasks = useCallback(async () => {
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleRunTask = (task_id: string) => {
    router.push(`/monitor?taskId=${task_id}`);
  };

  const handleRestoreTask = (task_id: string) => {
    router.push(`/monitor?taskId=${task_id}&action=restore`);
  };

  const handleViewLogs = (task_id: string) => {
    router.push(`/monitor?taskId=${task_id}&action=view`);
  };

  const handleDeleteTask = async (task_id: string) => {
    if (!confirm('确定要删除这个迁移方案吗？这不会影响已经迁移的数据或目录联接。')) return;
    try {
      await deleteTask(task_id);
      await fetchTasks();
    } catch (err) {
      console.error('Delete failed:', err);
      alert(`删除失败: ${err}`);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.sources.some((s) => s.path.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            方案管理
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">管理、执行或还原迁移任务</p>
        </div>
        <Link
          href="/create"
          className="bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <PlusCircle size={16} /> 新建迁移方案
        </Link>
      </header>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
            size={18}
          />
          <input
            type="text"
            placeholder="搜索方案名称或源目录路径..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 transition-all font-mono"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100"
        >
          <option value="all">全部状态</option>
          <option value="pending">待迁移</option>
          <option value="running">迁移中</option>
          <option value="success">已完成</option>
          <option value="failed">失败</option>
        </select>
      </div>

      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 transition-colors">
            <FolderOpen className="mx-auto text-zinc-300 dark:text-zinc-600 mb-3" size={32} />
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">没有找到匹配的迁移方案</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const totalSize = task.sources.reduce((acc, s) => acc + s.size, 0);
            return (
              <div
                key={task.id}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                        {task.name}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig[task.status]?.bg || ''} ${statusConfig[task.status]?.color || ''}`}
                      >
                        {statusConfig[task.status]?.label || task.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                      目标盘: {task.target_base} | 总大小: {formatBytes(totalSize)} | 创建于:{' '}
                      {new Date(task.created_at * 1000).toLocaleDateString()}
                    </p>
                    {task.error && (
                      <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                        <AlertCircle size={12} /> {task.error}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {task.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
                        title="删除方案"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    {(task.status === 'pending' || task.status === 'failed') && (
                      <button
                        type="button"
                        onClick={() => handleRunTask(task.id)}
                        className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md transition-colors"
                        title="执行迁移"
                      >
                        <Play size={18} />
                      </button>
                    )}
                    {task.status === 'running' && (
                      <div className="p-2 text-blue-500">
                        <Loader2 size={18} className="animate-spin" />
                      </div>
                    )}
                    {(task.status === 'success' || task.status === 'failed') && (
                      <button
                        type="button"
                        onClick={() => handleRestoreTask(task.id)}
                        className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-md transition-colors"
                        title="还原至C盘"
                      >
                        <RotateCcw size={18} />
                      </button>
                    )}
                    {(task.status === 'success' || task.status === 'failed') && (
                      <button
                        type="button"
                        onClick={() => handleViewLogs(task.id)}
                        className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-500/10 rounded-md transition-colors"
                        title="查看记录"
                      >
                        <FileText size={18} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                    源目录 ({task.sources.length})
                  </p>
                  <div className="space-y-3">
                    {task.sources.map((source) => {
                      const normalizedPath = source.path.replace(/\//g, '\\');
                      const normalizedPrefix = (task.common_prefix || '').replace(/\//g, '\\');

                      const relPath =
                        normalizedPrefix && normalizedPath.startsWith(normalizedPrefix)
                          ? normalizedPath.substring(normalizedPrefix.length).replace(/^[\\/]/, '')
                          : normalizedPath.split(/[\\/]/).pop() || '';

                      const targetPath = `${task.target_base}\\${task.name}\\${relPath}`.replace(
                        /\\\\/g,
                        '\\',
                      );
                      return (
                        <div key={source.path} className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-zinc-700 dark:text-zinc-300 truncate pr-4">
                              {source.path}
                            </span>
                            <span className="text-zinc-400 dark:text-zinc-500 shrink-0">
                              {formatBytes(source.size)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 pl-2 border-l border-zinc-200 dark:border-zinc-700 ml-1">
                            <span className="shrink-0">└─→</span>
                            <span className="truncate">{targetPath}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
