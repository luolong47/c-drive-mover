'use client';

import {
  Edit2,
  FolderOpen,
  Loader2,
  Lock,
  Moon,
  Plus,
  Settings2,
  ShieldAlert,
  Sun,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { getSettings, saveSettings, selectDirectory } from '@/lib/tauri-api';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [defaultTargetBase, setDefaultTargetBase] = useState('D:\\Cdrive-Mover');
  const [silentCheck, setSilentCheck] = useState(true);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(true);
  const [selectedBlacklistIndex, setSelectedBlacklistIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const settings = await getSettings();
        setDefaultTargetBase(settings.default_target_base);
        setSilentCheck(settings.silent_check);
        setBlacklist(settings.blacklist || []);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
        setMounted(true);
      }
    };
    init();
  }, []);

  const handleSave = async (updates: {
    default_target_base?: string;
    silent_check?: boolean;
    blacklist?: string[];
  }) => {
    const newBase = updates.default_target_base ?? defaultTargetBase;
    const newCheck = updates.silent_check ?? silentCheck;
    const newBlacklist = updates.blacklist ?? blacklist;

    setDefaultTargetBase(newBase);
    setSilentCheck(newCheck);
    setBlacklist(newBlacklist);

    try {
      await saveSettings({
        default_target_base: newBase,
        silent_check: newCheck,
        blacklist: newBlacklist,
      });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleBrowse = async () => {
    try {
      const selected = await selectDirectory();
      if (selected) {
        handleSave({ default_target_base: selected });
      }
    } catch (err) {
      console.error('Browse error:', err);
    }
  };

  const handleAddBlacklist = async () => {
    const selected = await selectDirectory();
    if (selected && !blacklist.includes(selected)) {
      handleSave({ blacklist: [...blacklist, selected] });
    }
  };

  const handleDeleteBlacklist = () => {
    if (selectedBlacklistIndex !== null) {
      const newList = blacklist.filter((_, i) => i !== selectedBlacklistIndex);
      handleSave({ blacklist: newList });
      setSelectedBlacklistIndex(null);
    }
  };

  const handleEditBlacklist = async () => {
    if (selectedBlacklistIndex !== null) {
      const selected = await selectDirectory();
      if (selected) {
        const newList = [...blacklist];
        newList[selectedBlacklistIndex] = selected;
        handleSave({ blacklist: newList });
      }
    }
  };

  if (!mounted || isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-zinc-300" />
      </div>
    );
  }

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
                默认目标基础路径
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                新建迁移方案时默认使用的目标基础路径
              </p>
              <div className="flex gap-2 max-w-md">
                <input
                  id="target-drive"
                  type="text"
                  value={defaultTargetBase}
                  onChange={(e) => handleSave({ default_target_base: e.target.value })}
                  className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 font-mono transition-colors"
                />
                <button
                  type="button"
                  onClick={handleBrowse}
                  className="p-2.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-md transition-all flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-sm active:scale-95 shrink-0"
                  title="选择目录"
                >
                  <FolderOpen size={18} />
                </button>
              </div>
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
                <input
                  id="silent-check"
                  type="checkbox"
                  className="sr-only peer"
                  checked={silentCheck}
                  onChange={(e) => handleSave({ silent_check: e.target.checked })}
                />
                <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 dark:after:border-zinc-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500" />
              </label>
            </div>
          </div>
        </section>

        {/* Security Settings */}
        <section className="bg-zinc-200/60 dark:bg-zinc-800/60 rounded-2xl p-2 transition-colors">
          <div className="px-3 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-amber-500" />
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">高级保护策略</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsLocked(!isLocked)}
              className={`p-1.5 rounded-md transition-all flex items-center gap-1.5 text-xs font-medium ${isLocked ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shadow-sm'}`}
              title={isLocked ? '点击解锁以编辑' : '点击锁定'}
            >
              {isLocked ? (
                <>
                  <Lock size={14} /> 锁定
                </>
              ) : (
                <>
                  <Unlock size={14} /> 已解锁
                </>
              )}
            </button>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 space-y-6 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  自定义黑名单路径
                </div>
                {!isLocked && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddBlacklist}
                      className="p-1.5 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors"
                      title="新建"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleEditBlacklist}
                      disabled={selectedBlacklistIndex === null}
                      className="p-1.5 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="编辑"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteBlacklist}
                      disabled={selectedBlacklistIndex === null}
                      className="p-1.5 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div
                className={`w-full min-h-32 bg-zinc-50 dark:bg-zinc-800 border ${isLocked ? 'border-zinc-100 dark:border-zinc-700/50' : 'border-indigo-500/30 ring-2 ring-indigo-500/5'} rounded-lg transition-all overflow-hidden`}
              >
                <div className="h-48 overflow-y-auto custom-scrollbar">
                  {blacklist.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-zinc-400 dark:text-zinc-600 italic text-xs">
                      暂无黑名单路径
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                      {blacklist.map((path, index) => (
                        <button
                          key={path}
                          type="button"
                          onClick={() => !isLocked && setSelectedBlacklistIndex(index)}
                          className={`w-full text-left px-4 py-2 text-sm font-mono truncate transition-colors ${selectedBlacklistIndex === index ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-700/30'}`}
                        >
                          {path}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2">
                处于黑名单中的目录将被禁止迁移。内置规则不可修改。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
