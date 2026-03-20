'use client';

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  HardDrive,
  Loader2,
  Play,
  RotateCcw,
  Terminal,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { type LogEntry, useMonitorTask } from '@/hooks/use-monitor-task';
import type { MoveTask, TaskSource } from '@/lib/tauri-api';
import { formatBytes } from '@/lib/utils';

// --- 阶段配置 ---
interface Stage {
  id: string;
  name: string;
}

const MIGRATION_STAGES: Stage[] = [
  { id: 'precheck', name: '环境检查 (Pre-check)' },
  { id: 'move', name: '数据迁移 (Data Migration)' },
  { id: 'junction', name: '目录联接 (Junction)' },
  { id: 'cleanup', name: '状态同步 (Sync)' },
];

const RESTORE_STAGES: Stage[] = [
  { id: 'precheck', name: '环境检查 (Pre-check)' },
  { id: 'remove_junction', name: '移除联接 (Remove Junction)' },
  { id: 'move_back', name: '数据移回 (Move Back)' },
  { id: 'cleanup', name: '状态同步 (Sync)' },
];

// --- 子组件 ---

function LogTerminal({ logs }: { logs: LogEntry[] }) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="lg:col-span-2 bg-[#151619] rounded-xl border border-zinc-800 flex flex-col shadow-xl overflow-hidden min-h-0 h-[400px] lg:h-auto">
      <div className="bg-[#1e1e24] px-4 py-3 border-b border-zinc-800 flex items-center gap-2 shrink-0">
        <Terminal size={16} className="text-zinc-400" />
        <span className="text-xs font-mono text-zinc-300">系统日志控制台 (System Logs)</span>
        <div className="ml-auto flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        </div>
      </div>
      <div className="p-4 overflow-y-auto flex-1 font-mono text-xs leading-relaxed custom-scrollbar text-zinc-300">
        {logs.length === 0 ? (
          <div className="text-zinc-600 italic">等待任务启动...</div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3 hover:bg-white/5 px-1 -mx-1 rounded">
                <span className="text-zinc-500 shrink-0">[{log.time}]</span>
                <span
                  className={`break-all ${log.type === 'success' ? 'text-emerald-400' : ''} ${log.type === 'warn' ? 'text-amber-400' : ''} ${log.type === 'error' ? 'text-red-400' : ''}`}
                >
                  {log.msg}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

function MonitorHeader({
  status,
  action,
  onStart,
  onBack,
}: {
  status: string;
  action: string | null;
  onStart: () => void;
  onBack: () => void;
}) {
  const isIdle = status === 'idle' && action !== 'view';
  const isFinished = status === 'completed' || status === 'error' || action === 'view';

  return (
    <header className="mb-6 flex justify-between items-end shrink-0">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          执行监控
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">实时监控迁移进度与底层日志</p>
      </div>
      <div className="flex gap-3">
        {isIdle && (
          <>
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={16} /> 取消
            </button>
            <button
              type="button"
              onClick={onStart}
              className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm ${action === 'restore' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600'}`}
            >
              {action === 'restore' ? (
                <>
                  <RotateCcw size={16} /> 开始还原
                </>
              ) : (
                <>
                  <Play size={16} /> 开始执行
                </>
              )}
            </button>
          </>
        )}
        {isFinished && (
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-2 text-sm font-medium text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            返回方案列表
          </button>
        )}
      </div>
    </header>
  );
}

function TaskOverviewCard({
  task,
  status,
  action,
}: {
  task: MoveTask;
  status: string;
  action: string | null;
}) {
  const totalSize = task.sources.reduce((acc: number, s: TaskSource) => acc + s.size, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm shrink-0 transition-colors">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
        <HardDrive size={18} className="text-indigo-500 dark:text-indigo-400" /> 任务概览
      </h2>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">方案名称</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{task.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">执行类型</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {action === 'restore' ? '还原' : '迁移'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">目标路径</span>
          <span
            className="font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]"
            title={task.target_base}
          >
            {task.target_base}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">总计大小</span>
          <span className="font-mono text-zinc-700 dark:text-zinc-300">
            {formatBytes(totalSize)}
          </span>
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-zinc-500 dark:text-zinc-400">当前状态</span>
          <span
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              status === 'idle'
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                : status === 'running'
                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20 animate-pulse'
                  : status === 'completed'
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                    : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
            }`}
          >
            {status === 'idle' && (action === 'view' ? '查看历史' : '等待执行')}
            {status === 'running' && (action === 'restore' ? '还原中...' : '迁移中...')}
            {status === 'completed' && '执行成功'}
            {status === 'error' && '执行失败'}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProgressMonitorCard({
  stages,
  currentStage,
  progress,
  status,
  action,
  errorMsg,
}: {
  stages: Stage[];
  currentStage: number;
  progress: number;
  status: string;
  action: string | null;
  errorMsg: string | null;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm flex-1 flex flex-col transition-colors">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4">
        {action === 'restore' ? '还原进度' : '迁移进度'}
      </h2>
      <div className="space-y-6">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">总体进度</span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400">
              {Math.floor(progress)}%
            </span>
          </div>
          <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden transition-colors">
            <div
              className="h-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
      <div className="mt-8 space-y-4">
        {stages.map((stage, idx) => {
          const isCompleted = currentStage > idx || status === 'completed';
          const isCurrent = currentStage === idx && status === 'running';
          return (
            <div key={stage.id} className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                  isCompleted
                    ? 'bg-emerald-500 dark:bg-emerald-600 border-emerald-500 dark:border-emerald-600 text-white'
                    : isCurrent
                      ? 'border-indigo-500 dark:border-indigo-400 text-indigo-500 dark:text-indigo-400'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-300 dark:text-zinc-600'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <span className="text-[10px] font-bold">{idx + 1}</span>
                )}
              </div>
              <span
                className={`text-sm transition-colors ${isCompleted ? 'text-zinc-900 dark:text-zinc-100' : isCurrent ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-zinc-400 dark:text-zinc-600'}`}
              >
                {stage.name}
              </span>
            </div>
          );
        })}
      </div>
      {status === 'error' && (
        <div className="mt-auto p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400 break-all">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

// --- 主组件 ---

function MonitorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams.get('taskId');
  const action = searchParams.get('action');

  const stages = action === 'restore' ? RESTORE_STAGES : MIGRATION_STAGES;
  const { task, status, currentStage, progress, logs, errorMsg, handleStart } = useMonitorTask(
    taskId,
    action,
    stages.length,
  );

  const onBack = () => router.push('/tasks');

  if (errorMsg && status !== 'error') {
    return (
      <div className="p-8 text-center">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
        <p className="text-zinc-600 dark:text-zinc-400">{errorMsg}</p>
        <button type="button" onClick={onBack} className="mt-4 text-indigo-500 underline">
          返回列表
        </button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
      <MonitorHeader status={status} action={action} onStart={handleStart} onBack={onBack} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-1 flex flex-col gap-6 min-h-0">
          <TaskOverviewCard task={task} status={status} action={action} />
          <ProgressMonitorCard
            stages={stages}
            currentStage={currentStage}
            progress={progress}
            status={status}
            action={action}
            errorMsg={errorMsg}
          />
        </div>
        <LogTerminal logs={logs} />
      </div>
    </div>
  );
}

export default function MonitorPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-zinc-500 h-full flex items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      }
    >
      <MonitorContent />
    </Suspense>
  );
}
