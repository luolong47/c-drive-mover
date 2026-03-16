'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListTree, PlusCircle, Activity, Settings, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: '仪表盘', href: '/', icon: LayoutDashboard },
  { name: '方案管理', href: '/tasks', icon: ListTree },
  { name: '新建迁移', href: '/create', icon: PlusCircle },
  { name: '执行监控', href: '/monitor', icon: Activity },
  { name: '设置', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 flex flex-col h-full border-r border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="p-6 flex items-center gap-3 text-zinc-900 dark:text-zinc-100">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
          <HardDrive size={24} />
        </div>
        <div>
          <h1 className="font-semibold text-lg leading-tight">C-Drive Mover</h1>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">{process.env.NEXT_PUBLIC_BUILD_VERSION || 'v2.0.0-beta'}</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              <item.icon size={18} className={cn(isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500')} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 border border-zinc-200 dark:border-transparent transition-colors">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">C盘空间</span>
            <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300">480 / 500 GB</span>
          </div>
          <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 w-[96%]" />
          </div>
          <p className="text-[10px] text-red-500 dark:text-red-400 mt-2">空间不足，建议立即清理</p>
        </div>
      </div>
    </div>
  );
}
