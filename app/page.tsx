'use client';

import { ArrowRight, HardDrive, Zap, CheckCircle2, AlertTriangle, PlusCircle, ListTree } from 'lucide-react';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const diskData = [
    { name: '已用空间', value: 480, color: '#ef4444' }, // red-500
    { name: '可用空间', value: 20, color: mounted && resolvedTheme === 'dark' ? '#3f3f46' : '#e4e4e7' }, // zinc-700 / zinc-200
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">仪表盘</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">系统存储状态与迁移概览</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Storage Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800 col-span-1 flex flex-col items-center justify-center transition-colors">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 self-start mb-4">C盘使用率</h2>
          <div className="h-48 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={diskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  {diskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`${value} GB`, '']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: mounted && resolvedTheme === 'dark' ? '#18181b' : '#fff', color: mounted && resolvedTheme === 'dark' ? '#f4f4f5' : '#18181b' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-light text-red-500">96%</span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">已满</span>
            </div>
          </div>
          <div className="flex justify-between w-full mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-zinc-600 dark:text-zinc-300">已用 480 GB</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${mounted && resolvedTheme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
              <span className="text-zinc-600 dark:text-zinc-300">剩余 20 GB</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between transition-colors">
            <div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-4">
                <Zap className="text-emerald-500 dark:text-emerald-400" size={20} />
              </div>
              <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">累计释放空间</h2>
              <p className="text-4xl font-light text-zinc-900 dark:text-zinc-100 mt-2">124.5 <span className="text-lg text-zinc-400 dark:text-zinc-500">GB</span></p>
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-4">
              <CheckCircle2 size={14} /> 相当于节省了 25% 的 C 盘空间
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between transition-colors">
            <div>
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-4">
                <HardDrive className="text-indigo-500 dark:text-indigo-400" size={20} />
              </div>
              <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">历史成功任务</h2>
              <p className="text-4xl font-light text-zinc-900 dark:text-zinc-100 mt-2">12 <span className="text-lg text-zinc-400 dark:text-zinc-500">次</span></p>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-4">
              最近一次迁移: 2026-03-10
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">快捷操作</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/create" className="group bg-white dark:bg-zinc-900 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <PlusCircle size={20} className="text-indigo-600 dark:text-indigo-400" /> 新建迁移方案
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">选择 C 盘目录并将其安全迁移到其他磁盘</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors">
            <ArrowRight size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
        </Link>

        <Link href="/tasks" className="group bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm">
          <div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ListTree size={20} className="text-zinc-500 dark:text-zinc-400" /> 查看全部方案
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">管理、执行或还原已有的迁移任务</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800 transition-colors">
            <ArrowRight size={20} className="text-zinc-500 dark:text-zinc-400" />
          </div>
        </Link>
      </div>
      
      {/* Warning Banner */}
      <div className="mt-8 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex items-start gap-3 transition-colors">
        <AlertTriangle className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">环境提示</h4>
          <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
            当前运行在 Web 预览环境中。由于浏览器沙盒限制，无法直接调用 Node.js 的 <code>fs</code> 模块或执行系统级提权操作。
            此界面为高保真前端交互原型，完全按照设计方案实现了交互逻辑、路径计算和状态流转，可直接作为 Electron 渲染进程代码使用。
          </p>
        </div>
      </div>
    </div>
  );
}
