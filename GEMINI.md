# C盘目录迁移工具 (C-Drive Mover) - 开发指南

本项目是一个基于 **Next.js 15** 与 **Tauri 2.0** 构建的桌面端工具，旨在安全地将 C 盘目录（如 AppData 缓存）迁移到其他盘符，并自动创建 Windows 目录联结 (Junction) 以保持软件引用路径有效。

## 项目概览

- **前端架构**: Next.js 15 (React 19), TailwindCSS 4.x, motion (framer-motion), Recharts.
- **后端架构**: Tauri 2.0 (Rust), 涉及 `sysinfo` (磁盘监控), `fs_extra` (原子化移动), `junction` (联结点管理).
- **设计规范**: 遵循 60-30-10 色彩原则，支持深色模式。
- **数据持久化**: 迁移任务存储在用户本地数据目录的 `c-drive-mover/tasks.json` 中。

## 关键命令

### 开发与构建
- **开发模式**: `pnpm tauri dev` (启动 Next.js 开发服务器并运行 Tauri 窗口)
- **生产构建**: `pnpm build` (触发 `tauri build`，会自动执行 `next build && next export`)
- **代码检查**: `pnpm lint` (使用 Biome 进行代码格式化与静态检查)

### 环境依赖
- **Node.js**: 建议使用 pnpm 管理依赖。
- **Rust**: 需安装 Rust 编译环境 (1.77.2+)。
- **OS**: 核心功能（目录联结）目前主要针对 **Windows** 系统。

## 目录结构说明

- `app/`: Next.js 路由与页面组件。
- `components/`: 通用 UI 组件（遵循 60-30-10 原则）。
- `lib/tauri-api.ts`: 前端与 Rust 后端的通信桥梁（Tauri Invoke 封装）。
- `src-tauri/`: Rust 后端源码。
    - `src/lib.rs`: 包含核心业务逻辑：磁盘扫描、目录迁移、联结创建及还原逻辑。
    - `tauri.conf.json`: Tauri 配置文件，定义了构建流程与窗口属性。
- `biome.json`: Biome 配置文件，替代了传统的 ESLint/Prettier。

## 开发规范

- **全流程中文**: 思考过程、代码注释、Git 提交信息均需使用中文。
- **代码风格**: 严格遵循 Biome 的规范，提交前运行 `pnpm lint`。
- **UI 色彩**:
    - **主色 (60%)**: `zinc-50` (浅色) / `zinc-950` (深色)
    - **辅助色 (30%)**: `white` (浅色) / `zinc-900` (深色)
    - **点缀色 (10%)**: `indigo-600` / `indigo-500`
- **后端指令 (Tauri Commands)**:
    - `get_disk_info`: 获取磁盘空间。
    - `scan_directory`: 扫描子目录。
    - `get_folder_size`: 异步计算目录大小。
    - `run_migration`: 执行原子化迁移与联结创建。
    - `restore_task`: 还原迁移操作。

## 注意事项
- 迁移操作具有系统级影响，修改 `src-tauri/src/lib.rs` 中的文件操作逻辑时需格外谨慎。
- 前端采用静态导出模式 (`output: 'export'`)，确保不使用任何依赖于 Node.js 运行时的 Next.js 特性（如 API Routes 或 SSR）。
