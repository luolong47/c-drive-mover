'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { Play, Square, RotateCcw, CheckCircle2, AlertCircle, Terminal, HardDrive } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatBytes } from '@/lib/utils';

// Mock execution stages
const STAGES = [
  { id: 'precheck', name: '迁移前检查 (Pre-check)' },
  { id: 'copy', name: '原子化复制 (Atomicity Copy)' },
  { id: 'rename', name: '重命名备份 (Rename Backup)' },
  { id: 'link', name: '创建软链接 (Create Junction)' },
  { id: 'cleanup', name: '清理备份 (Cleanup)' },
];

// Mock data (shared with tasks page for prototype)
const mockTasks = [
  {
    id: '1769590899250',
    name: 'antigravity',
    targetBase: 'D:\\Cdata',
    totalSize: 1024 * 1024 * 1024 * 15.4,
    sources: [{ originalPath: 'C:\\Users\\LuoLong\\.antigravity', size: 1024 * 1024 * 500 }]
  },
  {
    id: '1769590899251',
    name: 'docker-data',
    targetBase: 'E:\\DockerData',
    totalSize: 1024 * 1024 * 1024 * 45.2,
    sources: [{ originalPath: 'C:\\ProgramData\\Docker', size: 1024 * 1024 * 1024 * 45.2 }]
  },
  {
    id: '1769590899252',
    name: 'npm-cache',
    targetBase: 'D:\\DevCache',
    totalSize: 1024 * 1024 * 1024 * 2.1,
    sources: [{ originalPath: 'C:\\Users\\LuoLong\\AppData\\Local\\npm-cache', size: 1024 * 1024 * 1024 * 2.1 }]
  }
];

function MonitorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams.get('taskId');
  
  // Find task or use fallback
  const task = mockTasks.find(t => t.id === taskId) || mockTasks[0];

  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'error' | 'rolling_back'>('idle');
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [subProgress, setSubProgress] = useState(0);
  const [logs, setLogs] = useState<{ time: string, msg: string, type: 'info' | 'warn' | 'error' | 'success' }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    setLogs(prev => [...prev, { time, msg, type }]);
  };

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Simulation logic
  useEffect(() => {
    if (status !== 'running') return;
    
    let isCancelled = false;

    const runStage = async () => {
      if (currentStage === 0) {
        addLog('开始执行迁移前检查...', 'info');
        await new Promise(r => setTimeout(r, 800));
        if (isCancelled) return;
        addLog(`检查目标盘空间: 充足 (剩余 100GB > 需求 ${formatBytes(task.totalSize)})`, 'success');
        await new Promise(r => setTimeout(r, 500));
        if (isCancelled) return;
        addLog('检查目标文件系统: NTFS (支持 Junction)', 'success');
        await new Promise(r => setTimeout(r, 500));
        if (isCancelled) return;
        addLog('进程占用检测: 未发现文件锁定 (File Lock)', 'success');
        setCurrentStage(1);
        setProgress(10);
      } 
      else if (currentStage === 1) {
        addLog('开始原子化复制阶段...', 'info');
        const sourcePath = task.sources[0]?.originalPath || 'C:\\Source';
        const targetPath = `${task.targetBase}\\${task.name}`;
        addLog(`执行系统原生命令: robocopy ${sourcePath} ${targetPath} /E /COPYALL /MT:8`, 'info');
        
        // Simulate progress
        let p = 0;
        const interval = setInterval(() => {
          if (isCancelled) {
            clearInterval(interval);
            return;
          }
          p += Math.random() * 15;
          if (p >= 100) {
            clearInterval(interval);
            setSubProgress(100);
            setProgress(60);
            addLog(`复制完成: ${formatBytes(task.totalSize)}, 耗时 4.2s`, 'success');
            setTimeout(() => {
              if (isCancelled) return;
              setCurrentStage(2);
              setSubProgress(0);
            }, 1000);
          } else {
            setSubProgress(p);
            setProgress(10 + (p * 0.5)); // 10% to 60%
            if (Math.random() > 0.7) {
              addLog(`[robocopy] 正在复制: cache/data_${Math.floor(Math.random() * 1000)}.bin ...`, 'info');
            }
          }
        }, 300);
      }
      else if (currentStage === 2) {
        addLog('开始重命名源目录为备份...', 'info');
        await new Promise(r => setTimeout(r, 1000));
        if (isCancelled) return;
        const sourcePath = task.sources[0]?.originalPath || 'C:\\Source';
        addLog(`重命名: ${sourcePath} -> ${sourcePath}_backup`, 'success');
        setProgress(70);
        setCurrentStage(3);
      }
      else if (currentStage === 3) {
        addLog('开始创建跨平台软链接...', 'info');
        await new Promise(r => setTimeout(r, 1000));
        if (isCancelled) return;
        const sourcePath = task.sources[0]?.originalPath || 'C:\\Source';
        const targetPath = `${task.targetBase}\\${task.name}`;
        addLog(`执行: fs.symlinkSync("${targetPath}", "${sourcePath}", "junction")`, 'info');
        await new Promise(r => setTimeout(r, 800));
        if (isCancelled) return;
        addLog('Junction 创建成功', 'success');
        setProgress(85);
        setCurrentStage(4);
      }
      else if (currentStage === 4) {
        addLog('开始异步清理备份文件...', 'info');
        await new Promise(r => setTimeout(r, 1500));
        if (isCancelled) return;
        const sourcePath = task.sources[0]?.originalPath || 'C:\\Source';
        addLog(`删除: ${sourcePath}_backup`, 'success');
        setProgress(100);
        setStatus('completed');
        addLog('迁移任务全部完成！', 'success');
      }
    };

    runStage();

    return () => { isCancelled = true; };
  }, [status, currentStage, task]);

  const handleStart = () => {
    if (status === 'idle') {
      setStatus('running');
      setLogs([]);
      setCurrentStage(0);
      setProgress(0);
      setSubProgress(0);
      addLog(`初始化迁移任务: ${task.name}`, 'info');
    }
  };

  const handleRollback = () => {
    setStatus('rolling_back');
    addLog('触发安全回滚通道...', 'warn');
    setTimeout(() => {
      addLog('正在删除目标盘临时碎片文件...', 'info');
      setTimeout(() => {
        addLog('恢复原盘备份文件夹名称...', 'info');
        setTimeout(() => {
          addLog('回滚完成，系统已恢复原状。', 'success');
          setStatus('idle');
          setProgress(0);
          setSubProgress(0);
          setCurrentStage(0);
        }, 1000);
      }, 1000);
    }, 1000);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
      <header className="mb-6 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">执行监控</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">实时监控迁移进度与底层日志</p>
        </div>
        <div className="flex gap-3">
          {status === 'running' && (
            <button 
              onClick={handleRollback}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2 border border-red-200 dark:border-red-500/20"
            >
              <RotateCcw size={16} /> 中止并回滚
            </button>
          )}
          {status === 'idle' && (
            <button 
              onClick={handleStart}
              className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <Play size={16} /> 开始执行
            </button>
          )}
          {status === 'completed' && (
            <button 
              onClick={() => router.push('/tasks')}
              className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <CheckCircle2 size={16} /> 返回方案列表
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left Column: Status & Progress */}
        <div className="lg:col-span-1 flex flex-col gap-6 min-h-0">
          {/* Task Info */}
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
                <span className="text-zinc-500 dark:text-zinc-400">目标路径</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">{task.targetBase}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">总计大小</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatBytes(task.totalSize)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400">当前状态</span>
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
                  ${status === 'idle' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700' : ''}
                  ${status === 'running' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20 animate-pulse' : ''}
                  ${status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : ''}
                  ${status === 'rolling_back' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' : ''}
                `}>
                  {status === 'idle' && '等待执行'}
                  {status === 'running' && '迁移中...'}
                  {status === 'completed' && '执行成功'}
                  {status === 'rolling_back' && '回滚中...'}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm flex-1 flex flex-col transition-colors">
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4">实时进度</h2>
            
            <div className="space-y-6">
              {/* Main Progress */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">总体进度</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{Math.floor(progress)}%</span>
                </div>
                <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden transition-colors">
                  <div 
                    className="h-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Sub Progress */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-500 dark:text-zinc-400">当前阶段: {STAGES[currentStage]?.name || '完成'}</span>
                  <span className="font-mono text-zinc-500 dark:text-zinc-400">{Math.floor(subProgress)}%</span>
                </div>
                <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden transition-colors">
                  <div 
                    className="h-full bg-blue-400 dark:bg-blue-500 transition-all duration-200 ease-out"
                    style={{ width: `${subProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Stages Stepper */}
            <div className="mt-8 space-y-4">
              {STAGES.map((stage, idx) => {
                const isCompleted = currentStage > idx || status === 'completed';
                const isCurrent = currentStage === idx && status === 'running';
                
                return (
                  <div key={stage.id} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors
                      ${isCompleted ? 'bg-emerald-500 dark:bg-emerald-600 border-emerald-500 dark:border-emerald-600 text-white' : 
                        isCurrent ? 'border-indigo-500 dark:border-indigo-400 text-indigo-500 dark:text-indigo-400' : 'border-zinc-200 dark:border-zinc-700 text-zinc-300 dark:text-zinc-600'}
                    `}>
                      {isCompleted ? <CheckCircle2 size={14} /> : <span className="text-[10px] font-bold">{idx + 1}</span>}
                    </div>
                    <span className={`text-sm transition-colors ${isCompleted ? 'text-zinc-900 dark:text-zinc-100' : isCurrent ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-zinc-400 dark:text-zinc-600'}`}>
                      {stage.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Terminal Logs */}
        <div className="lg:col-span-2 bg-[#151619] rounded-xl border border-zinc-800 flex flex-col shadow-xl overflow-hidden min-h-0">
          <div className="bg-[#1e1e24] px-4 py-3 border-b border-zinc-800 flex items-center gap-2 shrink-0">
            <Terminal size={16} className="text-zinc-400" />
            <span className="text-xs font-mono text-zinc-300">极客日志控制台 (Log Terminal)</span>
            <div className="ml-auto flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
          </div>
          
          <div className="p-4 overflow-y-auto flex-1 font-mono text-xs leading-relaxed custom-scrollbar">
            {logs.length === 0 ? (
              <div className="text-zinc-600 italic">等待执行...</div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3 hover:bg-white/5 px-1 -mx-1 rounded">
                    <span className="text-zinc-500 shrink-0">[{log.time}]</span>
                    <span className={`
                      ${log.type === 'info' ? 'text-zinc-300' : ''}
                      ${log.type === 'success' ? 'text-emerald-400' : ''}
                      ${log.type === 'warn' ? 'text-amber-400' : ''}
                      ${log.type === 'error' ? 'text-red-400' : ''}
                      break-all
                    `}>
                      {log.msg}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MonitorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500">Loading monitor...</div>}>
      <MonitorContent />
    </Suspense>
  );
}
