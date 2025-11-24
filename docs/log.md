# Tech Notes

## 开发日志
### 2025-11-16
- DeepSeek 配置统一：读取 .env 中的 DS_AI_* / DEEPSEEK_*，强制 Base URL 为 https://api.deepseek.com/v1/chat/completions，记录请求日志并在 503 等异常时落回本地模板，避免错误抛到前端。
- Conversation 页面：语言切换入口移动到顶部导航，下拉菜单在亮/暗模式下均有清晰对比；发送按钮改为无底色圆角样式并加入 isSending 状态；消息、评分、收藏按钮行内展示，同时自动滚动到底部。
- Favorites 页面：卡片网格增加间距，压缩卡片留白，删除按钮与元信息同行；收藏时间仅显示日期。
- 文案与日志：清理旧版乱码文本，本日志记录新的规范；补充 docs/Realtime.md 说明实时交互方案，后端/前端同步落地 SSE 推送。

### 2025-11-16（续）
- 后端：ConversationService 增加 SSE 广播（@Sse）与会话 Subject 管理，DeepSeek 请求按标准 Base URL/模型发送，中文 fallback 改为 UTF-8。
- 前端：Zustand 引入乐观消息 + EventSource，发送更流畅；语言菜单在白天模式增加背景提示；收藏卡片按钮与元信息同行，减少空白。

### 2025-11-19
- 语音 Tutor 阶段一：新增 VoiceTutorModule（controller/service），暴露 POST /conversation/:conversationId/voice，使用 multer 内存存储与 MIME 校验，仅接受 webm/wav/m4a/mp4/mpeg，限制 5MB。
- 上传链路：校验会话存在后落盘到 	mp/voice-uploads/<conversationId>/voice-op-<timestamp>-<uuid>.<ext>，返回 { operationId, status: "received" } 供后续追踪。
- 使用说明：客户端用 multipart/form-data 发送 audio 字段；缺文件/格式不符/超限返回 400，会话不存在返回 404。此阶段仅负责音频落盘，为后续语音识别和 AI 分析铺路。

### 2025-11-19（续）
- OpenAI 接入：env.config 新增 openai 配置段，读取 OPENAI_API_URL/KEY 与 OPENAI_TRANSCRIBE_MODEL，统一 GPT-4/5 系列模型。
- 自动转写：VoiceTutorService 落盘后异步调用 	ranscribeWithOpenAi，成功后直接调用 ConversationService.processMessage，并在 meta.audioUrl 中写入 /api/conversation/:id/voice/:fileName 供前端播放。
- Voice → 文本：ConversationService.processMessage 新增 options.userMessageMeta，让语音消息保留音频引用；转写失败仅记录日志，不影响会话。
- 测试：上传成功可在服务器日志看到 “Stored voice upload...” 与 “OpenAI transcription” 输出；若配置缺失会提示“无法执行语音识别”。

### 2025-11-20
- 转写稳定性：VoiceTutorService 在请求 GPT 音频接口时改用 esponse.text()，遇到空响应或非 JSON 输出会打印原始文本并跳过解析；移除 esponse_format=verbose_json，以兼容 Yunwu 默认响应。
- 依赖声明：显式引入 undici、FormData 与 Node 原生 Blob，避免构造 multipart 请求时出现兼容问题。

### 2025-11-21
- 语音输入前端：Conversation 页集成 MediaRecorder，支持一键开启/停止、语音草稿预览和放弃；上传时调用 POST /conversation/:id/voice 并展示进度/异常，成功后自动等待 Yunwu STT 写回。
- 语音播放：消息泡泡读取 meta.audioUrl 渲染 <audio> 控件，AI 回复新增“听发音”按钮（调用 POST /conversation/:id/tts），生成音频也会插入消息体供复播。
- Prompt 升级：uildConversationSystemPrompt 显式声明界面语言/目标语言/场景及上下文约束，引导 GPT-4o 维持目标语言对话并用母语解释评分。
- UI 调优：录音开始/结束提供 toast 提示，语音草稿 1:1 嵌入输入框，避免 composer 高度跳变，保持布局稳定。
- STT 降级：服务器默认使用 Yunwu gpt-4o-mini-transcribe；若转写失败会携带 meta.audioUrl 调用 ConversationService.processMessage，由 DeepSeek 返回文字并提示用户重试，前端始终显示导师等待泡泡。
- 录音格式：MediaRecorder 优先选择 udio/mpeg、udio/mp4，浏览器不支持时退回 udio/webm，确保 Yunwu STT 能接收 mp3/m4a 等常见格式。
- 微信式体验：麦克风采用按住讲话 + 半透明蒙版提示，松开结束录音；发送时预先显示导师加载泡泡，语音提示常量抽离到 shared/constants/voice-ui.ts，中文文案保持 UTF-8。

### 2025-11-21（语音链路强化）
- Yunwu API 配置确认：.env / env.config.ts 统一记录 OPENAI_API_URL/KEY，默认启用 GPT-5.1（导师）+ gpt-4o-transcribe + gpt-4o-mini-tts，缺失配置会在服务启动时告警。
- 语音上传链路：VoiceTutor 自动将 webm/m4a 转成 mp3，再用 Node 18 原生 FormData 调用 Yunwu /audio/transcriptions，避免第三方库导致 500。
- 文本 AI 逻辑：ConversationService 先请求 Yunwu GPT-5.1，失败再降级 DeepSeek，最后才回退到模板，统一解析器保证评分/翻译字段完整。
- UI 更新：Conversation 列表恢复滚动，composer 输入区填满宽度、语音草稿与文本输入同高；录音相关 toast/错误提示全部使用 UTF-8 中文。
- 测试提示：语音消息发送后立即显示导师占位泡泡；webm 上传会在服务器侧自动转码，可在网络面板看到 mp3 请求；文字消息优先触发 GPT-5.1，如 Yunwu 不可用可在日志中确认 DeepSeek 回退。

## 项目概况
LuvTALK 面向粤语/英语学习者，提供实时对话、AI 纠错、收藏和文化提示。前端为 React 19 + Ionic React 8，后端为 NestJS 11 + Prisma，AI 能力对接 DeepSeek。

## 核心技术栈
- **Monorepo**：Turborepo + pnpm
- **前端**：React 19、Ionic React 8、Vite、Zustand、ite-plugin-pwa
- **后端**：NestJS 11、Prisma、PostgreSQL
- **AI**：DeepSeek API（OpenAI 兼容），输出使用 AiResponseSchema 校验

## 统一约束
- TypeScript 全量启用严格模式；前后端共享类型需保持 .ts/.tsx。
- Lint/Format：pnpm lint + 项目内 ESLint/Prettier。
- API 输入需 DTO + class-validator 校验；AI 响应必须通过 Zod 校验后返回。
- 数据模型唯一来源 pps/server/prisma/schema.prisma，迁移用 prisma migrate。

## 前端约定
- 页面组件包裹 <IonPage>，路由使用 <IonReactRouter> + <IonRouterOutlet>。
- 样式放于同名 .css，主题变量集中在 	heme/variables.css。
- 目录结构：components/、pages/Conversation|Favorites、services/、shared/、store/、	heme/、	ypes/。
- API 调用集中在 services/*Service.ts，状态存放在 store/useAppStore.ts。

## 后端约定
- Controller 负责路由和 DTO，Service 处理业务逻辑，PrismaService 负责数据库。
- conversation.service.ts 通过 DeepSeek + fallback 组合输出，Prompt 统一在 prompt.config.ts。
- AI 输出结构化对象，不直接返回字符串。

## 数据库 / Prisma
- Schema：pps/server/prisma/schema.prisma，包含 Conversation、Favorite、TranslationRecord 等模型和 FavoriteType 枚举。
- 常用命令：
  - pnpm --filter server prisma:migrate dev
  - pnpm --filter server prisma:generate

## 常用脚本
- 根目录：pnpm dev / build / lint
- 前端：pnpm --filter web dev|build|preview
- 后端：pnpm --filter server dev|build|start:prod|test

---
如需补充新规范或遇到兼容问题，请在本文件下追加日志说明（UTF-8）。
