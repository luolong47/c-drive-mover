'use client';

import {
  Cloud,
  CloudDownload,
  CloudUpload,
  Edit2,
  Eye,
  EyeOff,
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
import {
  AppSettings,
  getSettings,
  saveSettings,
  selectDirectory,
  testWebdavConnection,
  webdavBackup,
  webdavRestore,
} from '@/lib/tauri-api';

interface WebDAVSectionProps {
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavFolder: string;
  isBackupLoading: boolean;
  isRestoreLoading: boolean;
  defaultTargetBase: string;
  silentCheck: boolean;
  blacklist: string[];
  onSave: (updates: Partial<AppSettings>) => Promise<void>;
  onBackup: (settings: AppSettings) => Promise<void>;
  onRestore: () => Promise<void>;
}

function WebDAVSection({
  webdavUrl,
  webdavUsername,
  webdavPassword,
  webdavFolder,
  isBackupLoading,
  isRestoreLoading,
  defaultTargetBase,
  silentCheck,
  blacklist,
  onSave,
  onBackup,
  onRestore,
}: WebDAVSectionProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);

  const getCurrentSettings = (): AppSettings => ({
    default_target_base: defaultTargetBase,
    silent_check: silentCheck,
    blacklist: blacklist,
    webdav_url: webdavUrl,
    webdav_username: webdavUsername,
    webdav_password: webdavPassword,
    webdav_folder: webdavFolder,
  });

  const handleTestConnection = async () => {
    if (!webdavUrl || !webdavUsername || !webdavPassword) {
      alert('请先填写服务器地址、用户名和密码');
      return;
    }
    setIsTestLoading(true);
    try {
      await testWebdavConnection(getCurrentSettings());
      alert('连接测试成功！远程目录已就绪。');
    } catch (err) {
      console.error('Test connection error:', err);
      alert(`连接测试失败:\n${err}`);
    } finally {
      setIsTestLoading(false);
    }
  };

  return (
    <section className="bg-zinc-200/60 dark:bg-zinc-800/60 rounded-2xl p-2 transition-colors">
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud size={18} className="text-zinc-600 dark:text-zinc-400" />
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">云备份 (WebDAV)</h2>
        </div>
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTestLoading || isBackupLoading || isRestoreLoading}
          className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-md text-xs font-medium transition-all border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 shadow-sm active:scale-95"
        >
          {isTestLoading ? <Loader2 size={12} className="animate-spin" /> : <Settings2 size={12} />}
          测试连接
        </button>
      </div>
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 space-y-6 transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label
              htmlFor="webdav-url"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1"
            >
              服务器地址
            </label>
            <input
              id="webdav-url"
              type="text"
              placeholder="https://dav.jianguoyun.com/dav"
              value={webdavUrl}
              onChange={(e) => onSave({ webdav_url: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="webdav-username"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1"
            >
              用户名
            </label>
            <input
              id="webdav-username"
              type="text"
              value={webdavUsername}
              onChange={(e) => onSave({ webdav_username: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="webdav-password"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1"
            >
              密码/令牌
            </label>
            <div className="relative">
              <input
                id="webdav-password"
                type={showPassword ? 'text' : 'password'}
                value={webdavPassword}
                onChange={(e) => onSave({ webdav_password: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="md:col-span-2">
            <label
              htmlFor="webdav-folder"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1"
            >
              远程文件夹名称 (可选)
            </label>
            <input
              id="webdav-folder"
              type="text"
              placeholder="例如: CDriveBackups"
              value={webdavFolder}
              onChange={(e) => onSave({ webdav_folder: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 transition-colors"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => onBackup(getCurrentSettings())}
            disabled={isBackupLoading || isRestoreLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-400 text-white rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95"
          >
            {isBackupLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CloudUpload size={16} />
            )}
            备份到远程
          </button>
          <button
            type="button"
            onClick={onRestore}
            disabled={isBackupLoading || isRestoreLoading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm font-medium transition-all border border-zinc-200 dark:border-zinc-700 shadow-sm active:scale-95"
          >
            {isRestoreLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CloudDownload size={16} />
            )}
            从远程恢复
          </button>
        </div>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          备份功能将上传当前的 sqlite 数据库文件。恢复功能将从云端拉取并覆盖本地数据库。
        </p>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [defaultTargetBase, setDefaultTargetBase] = useState('D:\\Cdrive-Mover');
  const [silentCheck, setSilentCheck] = useState(true);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUsername, setWebdavUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  const [webdavFolder, setWebdavFolder] = useState('c-drive-mover');

  const [isLocked, setIsLocked] = useState(true);
  const [selectedBlacklistIndex, setSelectedBlacklistIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isRestoreLoading, setIsRestoreLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const settings = await getSettings();
        setDefaultTargetBase(settings.default_target_base);
        setSilentCheck(settings.silent_check);
        setBlacklist(settings.blacklist || []);
        setWebdavUrl(settings.webdav_url || '');
        setWebdavUsername(settings.webdav_username || '');
        setWebdavPassword(settings.webdav_password || '');
        setWebdavFolder(settings.webdav_folder || 'c-drive-mover');
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
        setMounted(true);
      }
    };
    init();
  }, []);

  const handleSave = async (updates: Partial<AppSettings>) => {
    const newBase = updates.default_target_base ?? defaultTargetBase;
    const newCheck = updates.silent_check ?? silentCheck;
    const newBlacklist = updates.blacklist ?? blacklist;
    const newWebdavUrl = updates.webdav_url ?? webdavUrl;
    const newWebdavUsername = updates.webdav_username ?? webdavUsername;
    const newWebdavPassword = updates.webdav_password ?? webdavPassword;
    const newWebdavFolder = updates.webdav_folder ?? webdavFolder;

    setDefaultTargetBase(newBase);
    setSilentCheck(newCheck);
    setBlacklist(newBlacklist);
    setWebdavUrl(newWebdavUrl);
    setWebdavUsername(newWebdavUsername);
    setWebdavPassword(newWebdavPassword);
    setWebdavFolder(newWebdavFolder);

    try {
      await saveSettings({
        default_target_base: newBase,
        silent_check: newCheck,
        blacklist: newBlacklist,
        webdav_url: newWebdavUrl,
        webdav_username: newWebdavUsername,
        webdav_password: newWebdavPassword,
        webdav_folder: newWebdavFolder,
      });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleWebdavBackup = async (settings: AppSettings) => {
    if (!webdavUrl || !webdavUsername || !webdavPassword) {
      alert('请先配置 WebDAV 信息');
      return;
    }
    setIsBackupLoading(true);
    try {
      await webdavBackup(settings);
      alert('备份成功');
    } catch (err) {
      console.error('Backup error:', err);
      alert(`备份失败:\n${err}`);
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleWebdavRestore = async () => {
    if (!webdavUrl || !webdavUsername || !webdavPassword) {
      alert('请先配置 WebDAV 信息');
      return;
    }
    if (!confirm('恢复备份将覆盖本地所有任务数据并自动重启应用，是否继续？')) {
      return;
    }
    setIsRestoreLoading(true);
    try {
      await webdavRestore();
      // 成功后应用会重启
    } catch (err) {
      console.error('Restore error:', err);
      alert(`恢复失败:\n${err}`);
      setIsRestoreLoading(false);
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

        {/* WebDAV Settings */}
        <WebDAVSection
          webdavUrl={webdavUrl}
          webdavUsername={webdavUsername}
          webdavPassword={webdavPassword}
          webdavFolder={webdavFolder}
          isBackupLoading={isBackupLoading}
          isRestoreLoading={isRestoreLoading}
          defaultTargetBase={defaultTargetBase}
          silentCheck={silentCheck}
          blacklist={blacklist}
          onSave={handleSave}
          onBackup={handleWebdavBackup}
          onRestore={handleWebdavRestore}
        />

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
