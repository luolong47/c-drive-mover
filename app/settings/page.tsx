'use client';

import { Moon, Settings2, ShieldAlert, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          设置
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">配置应用偏好与安全策略</p>
      </header>

      <div className="space-y-6">
        {/* General Settings */}
        <section className="bg-zinc-200/60 dark:bg-zinc-800/60 rounded-2xl p-2 transition-colors">
          <div className="px-3 py-2.5 flex items-center gap-2">
            <Settings2 size={18} className="text-zinc-600 dark:text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">常规设置</h2>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 space-y-8 transition-colors">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">外观模式</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">切换深色或浅色主题</p>
              </div>
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200/50 dark:border-zinc-700/50">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all ${theme === 'light' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                >
                  <Sun size={14} /> 浅色
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all ${theme === 'dark' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                >
                  <Moon size={14} /> 深色
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="target-drive"
                className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1"
              >
                默认目标盘符
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                新建迁移方案时默认使用的目标基础路径
              </p>
              <input
                id="target-drive"
                type="text"
                defaultValue="D:\Cdata"
                className="w-full max-w-md px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 font-mono transition-colors"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  静默检测软链接状态
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  启动应用时自动扫描是否有失效的 Junction 链接
                </p>
              </div>
              <label
                htmlFor="silent-check"
                className="relative inline-flex items-center cursor-pointer"
              >
                <input id="silent-check" type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 dark:after:border-zinc-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500" />
              </label>
            </div>
          </div>
        </section>

        {/* Security Settings */}
        <section className="bg-zinc-200/60 dark:bg-zinc-800/60 rounded-2xl p-2 transition-colors">
          <div className="px-3 py-2.5 flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-500" />
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">高级保护策略</h2>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 space-y-8 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  系统核心目录黑名单保护
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  禁止迁移 C:\Windows, C:\Program Files 等核心路径，防止系统崩溃
                </p>
              </div>
              <label
                htmlFor="core-protect"
                className="relative inline-flex items-center cursor-not-allowed opacity-70"
              >
                <input
                  id="core-protect"
                  type="checkbox"
                  className="sr-only peer"
                  checked
                  disabled
                />
                <div className="w-11 h-6 bg-emerald-400 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
              </label>
            </div>

            <div>
              <label
                htmlFor="blacklist-paths"
                className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3"
              >
                自定义黑名单路径
              </label>
              <textarea
                id="blacklist-paths"
                rows={3}
                defaultValue="C:\Windows&#10;C:\Program Files&#10;C:\Program Files (x86)"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-lg text-sm focus:outline-none font-mono text-zinc-600 dark:text-zinc-400 resize-none transition-colors"
                disabled
              />
              <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-2">
                内置保护规则不可修改
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
