# 📝 luvTALK 开发日志 (Development Log)

## 版本说明
- **v1.0 (2025-11-14)**：完成 React + Ionic MVP，对话页可展示静态示例信息，并设置基础路由与 Cypress 冒烟用例。
- **v1.2 (2025-11-14)**：引入 `ThemeProvider` + `ThemeToggle`，支持系统/手动暗黑模式切换。
- **v1.3 (2025-11-15)**：搭建 NestJS + Prisma 后端模块，新增 Conversation / Translation / Favorites / Health API，配置全局 `ValidationPipe` 与 PrismaService。PWA 侧添加 AppDock、Translator/Favorites/Conversation 页面；Zustand 存储拆分 Translator / Conversation / Favorites 切片；Vite 集成 `vite-plugin-pwa`。
- **v1.5 (2025-11-16)**：参考 Apple 式布局重构对话与收藏 UI，引入 cartoon avatar、统一圆角/透明度/程序员字体。Conversation API 降级调用 DS-AI（DeepSeek）模型，KEY 来自 `DS_AI_API_KEY`（用户可设置为 `sk-284a750c74484f01b14a473f98d3c612`）；服务端新增 JSON Prompt 校验，并为未来接入 `nestjs-i18n` 预留 `describeLanguage/Scenario`。收藏夹提供默认样例数据，Dock 固定在底部，新增语音按钮状态与语言 Chip 选择。

## 当前待办
1. 将后端静态文案迁移至 `nestjs-i18n`，统一语言包与前端语言 Chips 选项。
2. 将 mock favorites/session 废除，改为数据库种子或 Onboarding 引导。
3. 接入真实语音转写/朗读能力，并将 `mic` 按钮与 ASR 管线打通。
4. 根据设计规范继续收敛字体大小（JetBrains Mono）与圆角变量，以便组件库复用。
