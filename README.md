# C盘目录迁移工具 (C-Drive Mover)

这是一个用于将 C 盘的特定目录（如 AppData 缓存、隐藏配置文件夹）安全迁移到其他盘符，并自动创建软链接（Junction/Symlink）的系统级工具前端原型。

当前项目为高保真 Web 交互原型，完全按照设计方案实现了交互逻辑、路径计算算法和状态流转。

## UI 设计规范 (UI Design Guidelines: 60-30-10 Rule)

本项目严格遵循经典的 **60-30-10 UI 色彩比例原则**。**任何后续的 UI 变更、组件添加或页面重构，都必须符合此规范**，以确保整个应用视觉层级清晰、重点突出且不显得杂乱。

### 规范详情：

*   **60% 主色 (Primary/Background)**：用于应用的基础背景，提供干净、中性的画布。
    *   浅色模式：`bg-zinc-50`
    *   深色模式：`bg-zinc-950`
*   **30% 辅助色 (Secondary/Surface)**：用于区分内容区块（如卡片、侧边栏、输入框、次要文字），构建信息层级，不喧宾夺主。
    *   浅色模式：`bg-white`, `bg-zinc-100`, `text-zinc-500` 到 `text-zinc-900`
    *   深色模式：`bg-zinc-900`, `bg-zinc-800`, `text-zinc-400` 到 `text-zinc-100`
*   **10% 点缀色 (Accent/CTA)**：**严格限制使用范围**。仅用于引导用户进行最重要的操作（如“新建方案”、“保存”等 Primary Button）、活跃状态 (Active States) 或进度条等关键视觉焦点。
    *   浅色模式：`indigo-600` (如 `bg-indigo-600`, `text-indigo-600`)
    *   深色模式：`indigo-500` (如 `bg-indigo-500`, `text-indigo-500`)

**⚠️ 注意事项 (Do's & Don'ts)**：
1.  **禁止滥用点缀色**：不要将大面积的卡片背景或次要按钮设置为 `indigo`。如果一个页面上有多个按钮，只有最核心的那个（Primary Action）才应该使用实心的点缀色背景。
2.  **次要操作使用辅助色**：取消、返回、次要跳转等按钮，应使用 `bg-white` / `bg-zinc-900` 配合边框，或者使用透明背景加悬浮态 (`hover:bg-zinc-100`)。
3.  **保持深浅色模式的一致性**：在添加新样式时，务必同时编写 `dark:` 变体，并确保在两种模式下都符合 60-30-10 的比例。

---

## 下一步：Electron 接入建议 (Next Steps for Electron Integration)

当您将此项目打包为 Electron 应用时，需要将当前的模拟逻辑替换为真实的系统级调用。以下是具体的接入建议：

### 1. 替换文件系统读取 (File System Explorer)
在 `app/create/page.tsx` 中，当前的 `mockFileSystem` 是静态写死的模拟数据。
**接入方法**：
- 在 Electron 主进程 (Main Process) 中实现一个读取目录的 handler（建议使用异步懒加载，点击展开时再读取子目录）。
- 在渲染进程 (Renderer Process) 中，通过 IPC 调用获取真实目录结构：
  ```typescript
  // 渲染进程 (Renderer)
  const files = await window.ipcRenderer.invoke('read-dir', 'C:\\Users\\LuoLong');
  ```

### 2. 替换迁移执行与进度监控 (Migration & Monitoring)
在 `app/monitor/page.tsx` 中，当前的进度条、阶段切换和终端日志是通过 `useEffect` 和 `setTimeout` 模拟的。
**接入方法**：
- 在主进程中，使用 `child_process.spawn` 调用系统原生的高效复制工具（如 Windows 的 `robocopy` 或 Linux/macOS 的 `rsync`）。
- 主进程解析标准输出 (stdout)，并通过 IPC 将进度和日志流式推送到渲染进程：
  ```typescript
  // 渲染进程监听进度 (Renderer)
  window.ipcRenderer.on('migration-progress', (event, data) => {
    setProgress(data.overallProgress);
    setSubProgress(data.currentFileProgress);
    addLog(data.logMessage, data.logType);
  });
  ```

### 3. 实现原子化迁移核心逻辑 (Atomicity Core)
在主进程中，基于 Node.js 的 `fs` 模块实现真正的 4 阶段原子化操作（包含 Try-Catch-Rollback 机制）：
1. **检查与复制**：检查目标盘空间，执行多线程复制。
2. **重命名备份**：`fs.renameSync(source, source + '_backup')`
3. **创建软链接**：`fs.symlinkSync(target, source, 'junction')` 
   *(注：Windows 下强烈推荐使用 `junction` 类型，因为它通常不需要管理员权限即可创建目录联接；而 `dir` 类型的 Symlink 严格要求管理员权限)*。
4. **清理备份**：确认软链接可用后，异步执行 `fs.rmSync(source + '_backup', { recursive: true, force: true })`。

### 4. 权限与提权 (Privilege Elevation)
操作 `C:\Users\...\AppData` 等系统级目录时，经常会遇到权限拦截。
**接入方法**：
- 引入进程占用检测机制（如检测 File Lock）。
- 在 Electron 启动时，或在用户点击“开始执行”前，若检测到目标为受保护路径，可使用 `sudo-prompt` 等库请求 UAC 提权，确保主进程拥有足够的权限，避免中途抛出 `EPERM` (Operation not permitted) 错误。

### 5. 本地数据持久化 (Data Persistence)
在 `app/tasks/page.tsx` 中，任务列表 `initialTasks` 目前是写死的。
**接入方法**：
- 主进程中使用 `electron-store` 或直接读写本地的 `tasks.json` 文件。
- 渲染进程通过 `ipcRenderer.invoke('get-tasks')` 和 `ipcRenderer.invoke('save-task', taskData)` 来实现方案的增删改查。
