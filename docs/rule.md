# LuvTALK 开发规则（每次开发前请阅读）

1. **启动顺序**
   - 默认使用 `pnpm dev`，它会先跑 NestJS，再在健康检查通过后启动 Web。
   - 如需手动运行，务必先执行 `pnpm run dev:server`，待看到 “API listening …/api/health” 后，再运行 `pnpm run dev:web`。

2. **Service Worker / PWA**
   - 开发环境禁止启用 SW（`vite-plugin-pwa` 的 `devOptions.enabled` 必须为 `false`）。
   - 只有在确认 API 稳定且与 QA 沟通过后，才可以修改该配置；否则会再次出现 `ECONNREFUSED` 抢跑问题。

3. **Vite 代理与健康检查**
   - `VITE_PROXY_API` 默认指向 `http://127.0.0.1:3000`。如需改动，需同步更新 `scripts/dev.js` 的健康检查 URL，并在 MR 中说明。
   - 任何自动化脚本或调试脚本，都必须在 API 监听后再发 `/api/*` 请求。

4. **Zustand + React Hooks 依赖**
   - `useEffect` / `useMemo` 不要直接把 Zustand store 对象 (`conversation`, `favorites`) 放到依赖数组，避免无限循环。
   - 使用具体的状态字段或业务参数（如 `activeScenario`、`learningLanguage`），必要时用 `// eslint-disable-next-line react-hooks/exhaustive-deps` 静音。

5. **前端网络请求**
   - 页面加载时允许的接口只有：`/conversation/session` 初始化、`/favorites` 首次加载。新增接口必须懒加载或基于用户操作触发，避免首屏雪崩。
   - 乐观 UI（例如头像、消息）必须具备失败回退逻辑，且在代理/后端异常时不会引发额外请求。

6. **国际化与编码**
   - 所有中文文案、常量、响应内容一律使用 UTF-8 存储，禁止出现乱码。
   - 修改 locale、语言常量后，要同步更新 `LocaleProvider`、`types/language.ts` 以及 server 端（如欢迎语）。

7. **文档与规则**
   - 遇到跨端联调、代理、性能等问题时，必须更新 `docs/incident-report.md`，记录原因与解决方案。
   - 本 `docs/rule.md` 必须在每次大改动（启动方式、PWA 策略、网络策略等）后同步更新，并在 PR 描述中提醒审核者查阅。

遵循以上规则可以避免再次出现 “前端先发请求、后端未就绪” 及相关卡死问题，确保代理、PWA 与状态管理始终处于可控范围。
