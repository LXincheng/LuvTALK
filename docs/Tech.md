# Tech Notes

## 开发日志
### 2025-11-16
- DeepSeek 配置整理：统一读取 `.env` 中的 `DS_AI_*`/`DEEPSEEK_*`，标准化 baseURL 为 `https://api.deepseek.com/v1/chat/completions`，请求前记录日志，失败时回退到本地模板回复，避免 503 直接抛到前端。
- Conversation 页面：语言切换入口移至顶部导航，下拉菜单在明暗模式下都有清晰的背景/文字；发送按钮改为无底色圆角样式并增加 `isSending` 状态；消息、评分和收藏按钮行内展示，自动滚动到底部。
- Favorites 页面：卡片网格增加外边距，内容压缩留白，删除按钮和信息同列展示，时间改为仅显示年月日。
- 文案与日志：清理历史乱码文本，本文档记录最新规范与变更。
- 新增实时交互方案评估记录（见 `docs/Realtime.md`），并在后端/前端落地 SSE 推送，提升消息响应体验。

### 2025-11-16（续）
- 后端：`ConversationService` 增加 SSE 广播（`@Sse`）、会话 Subject 管理，DeepSeek 请求按标准 baseURL/模型发送，中文 fallback 文案恢复为 UTF-8。
- 前端：Zustand 增加乐观消息+EventSource 订阅，避免发送时卡顿；语言菜单未选中项在白天模式增加可见背景；收藏卡片的操作按钮与元信息同行，减少空白。

## 项目概况
LuvTALK 是面向粤语/英语学习者的语言练习 PWA，提供实时对话、AI 纠错、收藏和文化提示。前端为 React 19 + Ionic React 8，后端为 NestJS 11 + Prisma，AI 能力对接 DeepSeek。

## 核心技术栈
- **Monorepo**：Turborepo + pnpm
- **前端**：React 19、Ionic React 8、Vite、Zustand、`vite-plugin-pwa`
- **后端**：NestJS 11、Prisma、PostgreSQL
- **AI**：DeepSeek API（OpenAI 兼容），输出使用 `AiResponseSchema` 校验

## 统一约束
- TypeScript 全量启用严格模式；前后端共享类型时保持 `.ts/.tsx`。
- Lint/Format 由 `pnpm lint` + 项目内 ESLint/Prettier 负责。
- API 输入需 DTO + `class-validator` 校验；AI 响应必须通过 Zod 校验后返回。
- 数据模型唯一来源 `apps/server/prisma/schema.prisma`，迁移用 `prisma migrate`。

## 前端约定
- 页面组件包裹 `<IonPage>`，路由使用 `<IonReactRouter>` + `<IonRouterOutlet>`。
- 组件样式放于同名 `.css`，主题变量集中在 `theme/variables.css`。
- 目录结构：`components/`、`pages/Conversation|Favorites`、`services/`、`shared/`、`store/`、`theme/`、`types/`。
- API 调用集中在 `services/*Service.ts`，状态在 `store/useAppStore.ts`。

## 后端约定
- 模块化：Controller 只处理路由和 DTO，Service 写业务逻辑，PrismaService 负责 DB。
- `conversation.service.ts` 通过 DeepSeek + fallback 组合输出，Prompt 统一在 `prompt.config.ts`。
- AI 输出结构化对象，不直接返回字符串。

## 数据层 / Prisma
- Schema：`apps/server/prisma/schema.prisma`，模型包括 `Conversation`、`Favorite`、`TranslationRecord` 及 `FavoriteType` 枚举。
- 常用命令：
  - `pnpm --filter server prisma:migrate dev`
  - `pnpm --filter server prisma:generate`

## 常用脚本
- 根目录：`pnpm dev / build / lint`
- 前端：`pnpm --filter web dev|build|preview`
- 后端：`pnpm --filter server dev|build|start:prod|test`

---
如需补充新规范或遇到兼容问题，请在本文件下追加日期+说明（UTF-8）。***
