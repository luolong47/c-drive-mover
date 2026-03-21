'use client';

import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Loader2,
  Play,
  PlusCircle,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
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

interface TaskItemProps {
  task: MoveTask;
  onRun: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onViewLogs: (id: string) => void;
}

function TaskItem({ task, onRun, onRestore, onDelete, onViewLogs }: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const totalSize = task.sources.reduce((acc, s) => acc + s.size, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {task.name}
            </h3>
            <span
              className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig[task.status]?.bg || ''} ${statusConfig[task.status]?.color || ''}`}
            >
              {statusConfig[task.status]?.label || task.status}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">
            目标盘: {task.target_base} | 总大小: {formatBytes(totalSize)} | 创建于:{' '}
            {new Date(task.created_at * 1000).toLocaleDateString()}
          </p>
          {task.error && (
            <p className="text-xs text-red-500 mt-2 flex items-start gap-1 break-all">
              <AlertCircle size={12} className="shrink-0 mt-0.5" /> <span>{task.error}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {(task.status === 'pending' || task.status === 'failed') && (
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              title="删除任务"
            >
              <Trash2 size={18} />
            </button>
          )}
          {(task.status === 'pending' || task.status === 'failed') && (
            <button
              type="button"
              onClick={() => onRun(task.id)}
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
              onClick={() => onRestore(task.id)}
              className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-md transition-colors"
              title="还原至C盘"
            >
              <RotateCcw size={18} />
            </button>
          )}
          {(task.status === 'success' || task.status === 'failed') && (
            <button
              type="button"
              onClick={() => onViewLogs(task.id)}
              className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-500/10 rounded-md transition-colors"
              title="查看记录"
            >
              <FileText size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 border border-zinc-100 dark:border-zinc-800 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex justify-between items-center text-xs font-medium text-zinc-500 dark:text-zinc-400 group cursor-pointer"
        >
          <span>源目录 ({task.sources.length})</span>
          {isExpanded ? (
            <ChevronDown
              size={14}
              className="group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors"
            />
          ) : (
            <ChevronRight
              size={14}
              className="group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors"
            />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="space-y-3"
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

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

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto px-6 py-8">
      <header className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            迁移任务
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">管理已创建的目录迁移方案。</p>
        </div>
        <Link
          href="/create"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
        >
          <PlusCircle size={18} />
          <span>新建方案</span>
        </Link>
      </header>

      <div className="flex gap-4 mb-6 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            placeholder="搜索方案名称或目录路径..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm appearance-none cursor-pointer min-w-[120px]"
        >
          <option value="all">所有状态</option>
          <option value="pending">待迁移</option>
          <option value="running">迁移中</option>
          <option value="success">已完成</option>
          <option value="failed">失败</option>
        </select>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2 space-y-4 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p className="text-sm">正在加载任务列表...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 transition-colors">
            <FolderOpen className="mx-auto text-zinc-300 dark:text-zinc-600 mb-3" size={32} />
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">没有找到匹配的迁移方案</p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onRun={handleRunTask}
              onRestore={handleRestoreTask}
              onDelete={handleDeleteTask}
              onViewLogs={handleViewLogs}
            />
          ))
        )}
      </div>
    </div>
  );
}
