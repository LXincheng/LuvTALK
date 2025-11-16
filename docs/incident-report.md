# LuvTALK 本次联调问题复盘

## 触发的主要问题

1. **Vite 代理大量 `ECONNREFUSED`**  
   - 前端在 `pnpm dev` 启动后，vite-plugin-pwa 的 Service Worker 会立刻预取 `/api/conversation/session`、`/api/favorites`。  
   - 同一个终端里，NestJS 仍在 bootstrap，`127.0.0.1:3000` 端口尚未监听。  
   - PWA 请求被 Vite 代理到尚未启用的端口，导致大量 `ECONNREFUSED`，HMR 也被阻塞，页面卡死。

2. **Zustand `useEffect` 依赖误用造成的无限请求**  
   - 为响应 ESLint `react-hooks/exhaustive-deps` 提示，Effect 依赖数组被改成 `[conversation]` / `[favorites]`。  
   - Zustand slice 对象在任意状态更新时都会变，Effect 也会不断重跑，结果是重复调用 `conversation.start()` / `favorites.load()`，再次打满代理。

3. **引入 Service Worker 后的优化需求冲突**  
   - “发送后立即替换头像”的优化会在代理异常时叠加额外渲染逻辑，排查难度提升。  
   - 为快速恢复稳定环境，先撤回该乐观图像逻辑，待基础设施稳定后再逐步恢复。

## 解决思路与最终方案

1. **串联前后端启动顺序**  
   - 在根目录新增 `scripts/dev.js`，`pnpm dev` 改为：  
     1. `pnpm --filter server dev` 先启动 NestJS；  
     2. 轮询 `http://127.0.0.1:3000/api/health`；  
     3. 健康检查成功后再 `pnpm --filter web dev`。  
   - 捕获 Ctrl+C / SIGTERM，统一关闭子进程，避免僵尸实例。  
   - 这样前端不会在后端未 ready 时发请求，也无需手动记住启动顺序。

2. **禁用开发环境的 Service Worker**  
   - `vite-plugin-pwa` 的 `devOptions.enabled` 设为 `false`，开发阶段不再注册 SW，杜绝了 SW 预取引发的代理雪崩。  
   - 生产构建仍保持 PWA 能力，不影响线上行为。

3. **恢复正确的 Hooks 依赖与加载逻辑**  
   - `ConversationPage` 和 `FavoritesPage` 的 `useEffect` 重新使用具体依赖值（场景、语言等），并对 ESLint emit 的 `react-hooks/exhaustive-deps` 进行注解静音。  
   - 保证启动请求只在真正需要时触发，不再因 store 对象变动而循环发送。

4. **可选优化项暂缓**  
   - “发送后即时换头像”恢复为后端返回的头像，确保排查过程中没有额外的副作用点。等代理/启动流程稳定后，再重新实现并验证。

## 目前的操作指南

1. `pnpm dev` 会自动完成“后台先起、健康检查、再起前端”，无需手动分步骤。  
2. 如果想单独运行，可显式执行：
   ```bash
   pnpm run dev:server   # NestJS
   pnpm run dev:web      # Vite（前提是 API 已监听）
   ```
3. 开发环境不会注册 SW，刷新即可；生产构建依然具备完整的 PWA 功能。  
4. 当需要新的优化（如乐观头像、缓存等）时，先确认不会破坏上述启动顺序和请求节奏，再逐步上线。
