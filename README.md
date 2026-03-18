# C盘目录迁移工具 (C-Drive Mover)

这是一个用于将 C 盘的特定目录（如 AppData 缓存、隐藏配置文件夹）安全迁移到其他盘符，并自动创建联结点 (Junction) 的系统级工具。

本项目基于 **Next.js 15** 与 **Tauri 2.0** 构建，利用 Rust 的高性能和安全性执行底层文件系统操作。

## 核心功能
- **磁盘状态监控**：实时获取 C 盘及其他磁盘的剩余空间。
- **智能目录扫描**：递归扫描 C 盘用户目录与程序目录，精准计算文件夹大小。
- **原子化迁移引擎**：
  1. 原子化移动文件夹数据。
  2. 在原路径自动创建 Windows Junction（目录联结），确保软件路径引用不失效。
  3. 支持迁移方案的持久化保存与管理。

## 技术栈
- **前端**: Next.js (React 19), TailwindCSS, Lucide React, Recharts.
- **后端**: Tauri 2.0 (Rust), sysinfo, fs_extra, junction.
- **UI 设计**: 严格遵循 60-30-10 色彩原则，支持完美的深色模式适配。

## 开发与运行

### 准备环境
确保您的系统中已安装：
- [Node.js](https://nodejs.org/) (建议使用 pnpm)
- [Rust 编译环境](https://www.rust-lang.org/)

### 运行开发版本
```bash
pnpm install
pnpm desktop
```

### 构建生产版本
```bash
pnpm desktop:build
```

## UI 设计规范 (60-30-10 Rule)
本项目严格遵循经典的 **60-30-10 UI 色彩比例原则**：
- **60% 主色 (Background)**：`bg-zinc-50` / `bg-zinc-950`
- **30% 辅助色 (Surface)**：`bg-white` / `bg-zinc-900`
- **10% 点缀色 (Accent)**：`indigo-600` / `indigo-500` (仅用于核心 CTA 按钮和进度条)

---
*本项目已完全从 Electron 迁移至 Tauri 架构。*
