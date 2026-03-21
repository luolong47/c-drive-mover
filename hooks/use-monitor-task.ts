import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';
import {
  getTaskLogs,
  getTasks,
  killProcesses,
  type MoveTask,
  restoreTask,
  runMigration,
} from '@/lib/tauri-api';

export interface LogEntry {
  id: string;
  time: string;
  msg: string;
  type: 'info' | 'warn' | 'error' | 'success';
}

export function useMonitorTask(taskId: string | null, action: string | null, stagesCount: number) {
  const [task, setTask] = useState<MoveTask | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error' | 'locked'>(
    'idle',
  );
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockingProcesses, setLockingProcesses] = useState<string[] | null>(null);

  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const id = Math.random().toString(36).substring(2, 11);
    setLogs((prev) => [...prev, { id, time, msg, type }]);
  }, []);

  const updateStageByMsg = useCallback(
    (msg: string) => {
      const restoreKeywords = [
        { key: '开始还原', stage: 0 },
        { key: '移除联接', stage: 1 },
        { key: '移回 C 盘', stage: 2 },
        { key: '还原成功完成', stage: 3, done: true },
      ];
      const migrationKeywords = [
        { key: '准备就绪', stage: 0 },
        { key: '正在移动', stage: 1 },
        { key: '创建 Windows 目录联接', stage: 2 },
        { key: '迁移成功完成', stage: 3, done: true },
      ];

      const keywords = action === 'restore' ? restoreKeywords : migrationKeywords;
      const match = keywords.find((kw) => msg.includes(kw.key));

      if (match) {
        setCurrentStage(match.stage);
        if (match.done) setProgress(100);
      }
    },
    [action],
  );

  useEffect(() => {
    if (!taskId) return;

    const loadHistory = async () => {
      const history = await getTaskLogs(taskId);
      setLogs(
        history.map((log) => ({
          id: String(log.id),
          time: new Date(log.created_at * 1000).toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          msg: log.msg,
          type: log.event_type,
        })),
      );
    };

    const setupInitialState = (found: MoveTask) => {
      if (action === 'view') {
        const initialStatus =
          found.status === 'success' ? 'completed' : found.status === 'failed' ? 'error' : 'idle';
        setStatus(initialStatus);
        addLog(`查看任务历史记录: ${found.name}`, 'info');
        setProgress(100);
        setCurrentStage(stagesCount);
      }
    };

    const fetchTask = async () => {
      try {
        const tasks = await getTasks();
        const found = tasks.find((t) => t.id === taskId);
        if (!found) {
          setErrorMsg('未找到指定的任务 ID');
          return;
        }

        setTask(found);
        await loadHistory();
        setupInitialState(found);
      } catch (_err) {
        setErrorMsg('获取任务信息失败');
      }
    };

    fetchTask();
  }, [taskId, action, addLog, stagesCount]);

  useEffect(() => {
    if (!taskId) return;
    const unlisten = listen<{ msg: string; event_type: string }>('migration-log', (event) => {
      const { msg, event_type } = event.payload;
      addLog(msg, event_type as LogEntry['type']);
      updateStageByMsg(msg);
      setProgress((prev) => Math.min(prev + 100 / ((task?.sources.length || 1) * 4), 95));
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [addLog, task, updateStageByMsg, taskId]);

  const handleMigrationError = useCallback(
    (msg: string) => {
      if (msg.startsWith('LOCKS_DETECTED:')) {
        try {
          const parts = msg.split(':');
          const pList = JSON.parse(parts[1]);
          setLockingProcesses(pList);
          setStatus('locked');
          setErrorMsg(`目录被程序占用: ${pList.join(', ')}`);
        } catch (_e) {
          setStatus('error');
          setErrorMsg(msg);
        }
      } else {
        setStatus('error');
        setErrorMsg(msg);
      }
      addLog(`任务中止: ${msg}`, 'error');
    },
    [addLog],
  );

  const executeTaskAction = useCallback(
    async (actionType: string) => {
      if (!taskId) return;
      if (actionType === 'restore') {
        await restoreTask(taskId);
      } else {
        await runMigration(taskId);
      }
    },
    [taskId],
  );

  const resetTaskStatus = useCallback(
    (msg: string) => {
      setStatus('running');
      addLog('--- 开启新操作流程 ---', 'info');
      setCurrentStage(0);
      setProgress(5);
      setErrorMsg(null);
      setLockingProcesses(null);
      addLog(msg, 'info');
    },
    [addLog],
  );

  const resolveAction = (overrideAction?: unknown) => {
    const actualOverride = typeof overrideAction === 'string' ? overrideAction : undefined;
    const currentAction = actualOverride || action || 'migrate';
    if (currentAction === 'restore') {
      const confirmed = confirm(
        '确定要从目标盘恢复数据到 C 盘吗？这将删除现有的目录联接并移回原始数据。',
      );
      if (!confirmed) return null;
    }
    return currentAction;
  };

  const handleStart = async (overrideAction?: unknown) => {
    if (!taskId || !task) return;

    const currentAction = resolveAction(overrideAction);
    if (!currentAction) return;

    resetTaskStatus(
      `${currentAction === 'restore' ? '初始化还原任务' : '初始化迁移任务'}: ${task.name}`,
    );

    try {
      await executeTaskAction(currentAction);
      setStatus('completed');
      setProgress(100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleMigrationError(msg);
    }
  };

  const retryWithKill = async () => {
    if (!lockingProcesses) return;
    try {
      addLog('正在尝试终止占用进程...', 'info');
      await killProcesses(lockingProcesses);
      setLockingProcesses(null);
      await handleStart(action || 'migrate');
    } catch (err) {
      addLog(`无法终止进程: ${err}`, 'error');
    }
  };

  return {
    task,
    status,
    currentStage,
    progress,
    logs,
    errorMsg,
    lockingProcesses,
    handleStart,
    retryWithKill,
  };
}
