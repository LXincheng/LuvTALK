# Tech Notes

## 开发日志

### 2025-11-16

- DeepSeek 配置统一：读取 .env 中的 DS*AI*\_ / DEEPSEEK\_\_，强制 Base URL 为 https://api.deepseek.com/v1/chat/completions，记录请求日志并在 503 等异常时落回本地模板，避免错误抛到前端。
- Conversation 页面：语言切换入口移动到顶部导航，下拉菜单在亮/暗模式下均有清晰对比；发送按钮改为无底色圆角样式并加入 isSending 状态；消息、评分、收藏按钮行内展示，同时自动滚动到底部。
- Favorites 页面：卡片网格增加间距，压缩卡片留白，删除按钮与元信息同行；收藏时间仅显示日期。
- 文案与日志：清理旧版乱码文本，本日志记录新的规范；补充 docs/Realtime.md 说明实时交互方案，后端/前端同步落地 SSE 推送。

### 2025-11-16（续）

- 后端：ConversationService 增加 SSE 广播（@Sse）与会话 Subject 管理，DeepSeek 请求按标准 Base URL/模型发送，中文 fallback 改为 UTF-8。
- 前端：Zustand 引入乐观消息 + EventSource，发送更流畅；语言菜单在白天模式增加背景提示；收藏卡片按钮与元信息同行，减少空白。

### 2025-11-19

- 语音 Tutor 阶段一：新增 VoiceTutorModule（controller/service），暴露 POST /conversation/:conversationId/voice，使用 multer 内存存储与 MIME 校验，仅接受 webm/wav/m4a/mp4/mpeg，限制 5MB。
- 上传链路：校验会话存在后落盘到 mp/voice-uploads/<conversationId>/voice-op-<timestamp>-<uuid>.<ext>，返回 { operationId, status: "received" } 供后续追踪。
- 使用说明：客户端用 multipart/form-data 发送 audio 字段；缺文件/格式不符/超限返回 400，会话不存在返回 404。此阶段仅负责音频落盘，为后续语音识别和 AI 分析铺路。

### 2025-11-19（续）

- OpenAI 接入：env.config 新增 openai 配置段，读取 OPENAI_API_URL/KEY 与 OPENAI_TRANSCRIBE_MODEL，统一 GPT-4/5 系列模型。
- 自动转写：VoiceTutorService 落盘后异步调用 ranscribeWithOpenAi，成功后直接调用 ConversationService.processMessage，并在 meta.audioUrl 中写入 /api/conversation/:id/voice/:fileName 供前端播放。
- Voice → 文本：ConversationService.processMessage 新增 options.userMessageMeta，让语音消息保留音频引用；转写失败仅记录日志，不影响会话。
- 测试：上传成功可在服务器日志看到 “Stored voice upload...” 与 “OpenAI transcription” 输出；若配置缺失会提示“无法执行语音识别”。

### 2025-11-20

- 转写稳定性：VoiceTutorService 在请求 GPT 音频接口时改用
  esponse.text()，遇到空响应或非 JSON 输出会打印原始文本并跳过解析；移除
  esponse_format=verbose_json，以兼容 Yunwu 默认响应。
- 依赖声明：显式引入 undici、FormData 与 Node 原生 Blob，避免构造 multipart 请求时出现兼容问题。

### 2025-11-21

- 语音输入前端：Conversation 页集成 MediaRecorder，支持一键开启/停止、语音草稿预览和放弃；上传时调用 POST /conversation/:id/voice 并展示进度/异常，成功后自动等待 Yunwu STT 写回。
- 语音播放：消息泡泡读取 meta.audioUrl 渲染 <audio> 控件，AI 回复新增“听发音”按钮（调用 POST /conversation/:id/tts），生成音频也会插入消息体供复播。
- Prompt 升级：auildConversationSystemPrompt 显式声明界面语言/目标语言/场景及上下文约束，引导 GPT-4o 维持目标语言对话并用母语解释评分。
- UI 调优：录音开始/结束提供 toast 提示，语音草稿 1:1 嵌入输入框，避免 composer 高度跳变，保持布局稳定。
- STT 降级：服务器默认使用 Yunwu gpt-4o-mini-transcribe；若转写失败会携带 meta.audioUrl 调用 ConversationService.processMessage，由 DeepSeek 返回文字并提示用户重试，前端始终显示导师等待泡泡。
- 录音格式：MediaRecorder 优先选择 audio/mpeg、audio/mp4，浏览器不支持时退回 audio/webm，确保 Yunwu STT 能接收 mp3/m4a 等常见格式。
- 微信式体验：麦克风采用按住讲话 + 半透明蒙版提示，松开结束录音；发送时预先显示导师加载泡泡，语音提示常量抽离到 shared/constants/voice-ui.ts，中文文案保持 UTF-8。

### 2025-11-21（语音链路强化）

- Yunwu API 配置确认：.env / env.config.ts 统一记录 OPENAI_API_URL/KEY，默认启用 GPT-5.1（导师）+ gpt-4o-transcribe + gpt-4o-mini-tts，缺失配置会在服务启动时告警。
- 语音上传链路：VoiceTutor 自动将 webm/m4a 转成 mp3，再用 Node 18 原生 FormData 调用 Yunwu /audio/transcriptions，避免第三方库导致 500。
- 文本 AI 逻辑：ConversationService 先请求 Yunwu GPT-5.1，失败再降级 DeepSeek，最后才回退到模板，统一解析器保证评分/翻译字段完整。
- UI 更新：Conversation 列表恢复滚动，composer 输入区填满宽度、语音草稿与文本输入同高；录音相关 toast/错误提示全部使用 UTF-8 中文。
- 测试提示：语音消息发送后立即显示导师占位泡泡；webm 上传会在服务器侧自动转码，可在网络面板看到 mp3 请求；文字消息优先触发 GPT-5.1，如 Yunwu 不可用可在日志中确认 DeepSeek 回退。

### 2025-11-26

- 轻量缓存基座：新增 AppCacheModule，接入 Nest CacheModule（内存存储）并封装 SessionCacheService（60s TTL）与 VoiceOperationCacheService（5 分钟 TTL），ConversationService 读取/落库时增加缓存读写，减少高并发下的重复查库。
- 语音状态跟踪：VoiceTutorService 在 `received -> transcribing -> responding -> completed/failed` 全流程写入 VoiceOperationCacheService，记录 audioUrl/transcript/error，支持转写失败后的 fallback 状态，避免多实例下操作丢失。
- 语音状态查询：VoiceTutorController 新增 `GET /conversation/:conversationId/voice-status/:operationId`，前端可轮询单次语音的实时状态；原 `/conversation/:conversationId/voice/:fileName` 流程不受影响。
- 前端语音 UI：Conversation 页面调用 `fetchVoiceOperationStatus` 轮询语音状态，在录音草稿与“等待导师”气泡中实时显示 received/transcribing/responding/failed 等阶段提示，并在失败时提示用户改用文本或重试。

### 2025-11-26（续）

- 认证模块脚手架：新增 AuthModule/AuthService/AuthController，接入 NestJS JwtModule，仅在 /auth/google 路由下处理 Google OAuth code → id_token → 本地 JWT 的转换，尚未落库用户数据，现有会话与收藏模块保持不变。
- Google OAuth 集成：根据官方 token 端点规范调用 https://oauth2.googleapis.com/token 交换 authorization_code 为 id_token，并解析其中的 sub/email/name/picture 构造用户 Profile；若 GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET 未配置，则优雅返回 ServiceUnavailable，不影响其他接口。
- PWA Service Worker：基于 vite-plugin-pwa 的 generateSW 能力新增 runtimeCaching，针对 `/api/conversation/history` 与 `/api/conversation/:id/voice/*` 路由使用 Stale-While-Revalidate/CacheFirst，允许离线时读取最近的历史列表和语音文件，同时保持 devOptions.enabled=false，开发环境仍不注册 SW。
- IndexedDB 缓存：引入 `idb` 并实现 `shared/storage/indexedDb.ts`，维护 `pendingVoices`（保存 operationId、Blob、状态、转写文本）及 `recentConversations`（最近 5 条会话概要）。ConversationPage 发送语音后会在 IDB 中持久化草稿，刷新页面时可重建 pending 语音 UI，并在语音状态变化时同步更新/清理缓存；Zustand 会在收到 SSE 更新后写入 recentConversations，为后续离线模式做准备。

### 2026-01-23

- 前端：创建 `apps/web` (Vite + React + TS)，接入 Tailwind 与 `lucide-react`，完成 MainLayout/Sidebar/BottomTabBar 与 Chat/Favorites/Review/Profile UI。
- 登录：新增 LoginPage 并接入 Supabase Auth Google 登录，新增 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY` 占位说明。
- 路由：引入 React Router v6，补齐登录守卫与基础页面路由。
- 配置：新增 `apps/web/vercel.json`（API 代理占位）、Tailwind/PostCSS 配置与基础样式。
- 后端：新增 `apps/server/Dockerfile` 与 `.dockerignore`，包含 `apt-get install ffmpeg`。
- 部署：新增 `.github/workflows/ci.yml` 与 `docs/deploy.md`，补充 CI/CD 与 Railway/Vercel 配置说明。
- 数据库：执行 `prisma db push`（使用当前 `.env` 的 DATABASE_URL）。
- 环境：新增 `.env.example` 供部署时填充。

### 2026-01-24

- Phase 3 起步：新前端接入现有后端会话/语音/收藏接口，移除 Supabase 登录逻辑与旧版前端代码。
- 精简：更新 `dev` 启动脚本与 Vite 代理，删除旧版前端内容，聚焦 `apps/web`。

### 2026-01-24（UI 对齐 Figma）

- 新样式：同步 `figma-proto/styles/globals.css` 的玻璃态与暗黑模式变量，统一 glass-card/sidebar/input/button 风格。
- 主题与语言：新增 Theme/Locale Context，侧边栏支持暗黑切换与中英文界面切换。
- 聊天体验：对话页加入沉浸式全屏模式、AI 注解词汇 + 弹窗收藏（motion 动画）。
- 语言调整：去除西语示例，默认学习语言切换为粤语/普通话/英语。
- 重命名：`apps/web-new` 调整为 `apps/web`，同步脚本/CI/文档引用。
- 收藏页修复：补齐收藏卡片分类标签与复制/删除提示的中英文文案，日期按界面语言格式化显示。
- 构建适配：tsconfig 补充 React 类型引用，消息映射显式类型，注解组件使用 ReactNode，移除 `outline-ring/50` 以兼容 Tailwind v3 构建。

### 2026-02-01

- 后端：AiResponseSchema 新增 keyTerms；Prompt 强化 key_terms 输出；ConversationService 归一化并落库 `meta.keyTerms`，仅保留 reply 中出现的术语。
- 后端：修复 keyTerms 归一化的 TypeScript 类型谓词错误，改用 null 过滤并保持 type 可选字段一致性。
- 后端：新增 ReviewModule（`/review/daily` + `/review/feedback`），聚合收藏 + 低分表达（score < 60）；反馈暂记录到内存日志，便于 Phase 3.2 迁移。
- 后端：收藏创建支持携带 `conversationId`，Review 卡片可复用 `/conversation/:id/tts`。
- 前端：ConversationPage 由后端 `keyTerms` 驱动高亮注解；VocabularyPopover 透传类型并保存到收藏。
- 前端：DailyReviewPage 接入 `/review/daily`、`/review/feedback`，增加一键发音（TTS）按钮与错误状态；新增 reviewService 与多语言文案。
- 文档：新增 `docs/phase3-review-vocab.md` 记录每日复习联动、词汇卡片与高亮逻辑方案。
