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
- 语言调整：默认学习语言切换为粤语/普通话/英语。
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

### 2026-02-04

- 前端：发送文字/语音后立即回显用户消息，并追加 AI 导师加载态气泡，避免误判未发送。
- 前端：AI 回复自动调用 `/conversation/:id/tts` 补充音频播放，支持听说结合。
- 前端：输入区整合语音状态与语音草稿播放器，与文本框同卡片风格统一展示。
- 后端：TTS 默认音色切换为 shimmer（更柔和），保持可用性与兼容性。
- 前端：语音草稿与提示移入用户发送气泡内，输入区保持简洁；语音播放器样式统一为 glass 风格。
- 前端：重点词弹窗提高不透明度，避免遮挡读不清。
- 后端：Prompt 放宽 key_terms 输出，仅在确有重点词时返回（0-3），减少强行标注。
- 前端：TTS 采用“文字先显示、语音后补齐”策略，最新消息优先请求，旧消息空闲时补齐，提升响应速度。
- 前端：聊天文本支持换行与长文本自动换行，避免排版挤成一团。

### 2026-02-05

- Prisma datasource 增加 directUrl（env("DIRECT_URL")），以支持生产环境连接池 + 迁移直连拆分。
- 使用 Supabase Pooler 连接串尝试 migrate dev --create-only，报错 P1002：连接可达但无法获取 advisory lock（pg_advisory_lock 超时）。
- 按当前 .env（IPv4 + DIRECT_URL 指向 pooler）执行 prisma migrate dev --create-only，结果仍为 P1002（pg_advisory_lock 超时）。
- 结论：使用 pooler 作为 DIRECT_URL 无法完成 Prisma 迁移（锁不可用/超时）。
- 前端新增 Supabase Auth：提供游客登录、手机号验证码登录、验证码校验与退出登录，接入 Profile 页登录面板；新增 AuthProvider 统一维护会话状态与 access_token。
- API 请求自动附带 Supabase access_token（Authorization Bearer），以便后端识别用户并做数据归属。
- 后端鉴权调整：AuthService 增加 Supabase access_token 校验（调用 /auth/v1/user），支持游客与手机号用户；JwtAuthGuard 改为使用 AuthService 解析用户。
- 收藏持久化升级：FavoritesService 读取 DB（按 userId 过滤），创建收藏时写入 userId；无登录时保持默认演示数据。
- 复习持久化升级：新增 ReviewQueueItem / ReviewFeedback Prisma 模型与调度逻辑（简化 SM-2），支持持久化队列与反馈日志；无表时自动回退内存队列。
- Prisma schema 补充 Review 关系字段，并完成 prisma generate。
- 新增设计文档 docs/auth-review-design.md，记录 Supabase Auth 与复习调度算法与手动建表 SQL。

### 2026-02-06

- 前端新增 LoginPage（Supabase 匿名/手机号 OTP 登录）与 AchievementHallPage（成就/等级双标签页），路由增加 /login 和 /achievements。
- Prisma schema 增补 Achievement/UserAchievement/LevelDefinition/UserLevel 及 AchievementRarity 枚举。
- 后端新增成就/等级 API（/achievements、/achievements/levels、/achievements/summary），按用户返回进度与概览；抽离 achievement.types.ts 解决 TS4053。
- 会话持久化增加 Prisma 连接中断（P1001/P1002）自动降级内存存储，避免请求直接抛错。
- 成就殿堂国际化：LocaleContext 新增 60+ 翻译键，覆盖成就标题/描述、等级名称、稀有度标签、统计标签等；AchievementHallPage 全面使用 `t()` 替换硬编码文本。
- 常量集中化：新建 `constants/ui.ts`，收录 RARITY_COLORS/RARITY_GLOW、PREFERRED_AUDIO_MIMES/PREFERRED_RECORDING_MIMES、STAT_COLOR_CLASSES/PROGRESS_COLORS、DEFAULTS 等常量，各页面统一引用。
- LocaleContext 扩展通用标签：语言标签（languageCantonese 等）、收藏类型（favoriteTypePhrase 等）、分类筛选（categoryAll）、Profile 页全部文案（profileGuest/profileStatSessions/profileVocabulary 等 30+ 键）。
- ConversationPage 优化：语言切换标签改用 `t()` 函数，录音 MIME 类型改用 PREFERRED_RECORDING_MIMES 常量。
- FavoritesPage 优化：收藏类型标签和分类筛选"全部"改用 `t()` 函数，消除内联 locale 判断。
- ProfilePage 重构：所有内联 `locale === 'zh' ? ... : ...` 替换为 `t()` 调用，统计卡片颜色和进度条颜色改用 STAT_COLOR_CLASSES/PROGRESS_COLORS 常量，成就数据改用翻译键驱动。
- 语音播放 UI 升级：新建 AudioPlayer 组件（玻璃态透明背景、播放/暂停按钮、进度条点击跳转、时间显示），替换 MessageBubble 和 DailyReviewPage 中的原生 `<audio>` 元素，与文字气泡视觉风格统一。
- AuthProvider 拆分为 auth-context + AuthProvider，修复 eslint only-export-components 规则。
- 登录页游客登录跳转调整为 /chat；侧边栏底部头像改为跳转 /profile。
- 清理：ProfilePage 移除未使用引用，.gitignore 忽略 apps/server/tmp。
- 新增 docs/supabase-setup.md（完整配置指南）和 docs/achievement-level-design.md（成就/等级表结构与种子 SQL）。

### 2026-02-06（聊天持久化与历史记录）

- 核心修复：ConversationPage 不再每次挂载创建新会话，改为调用 `POST /conversation/resume` 优先恢复已有活跃会话，仅在无活跃会话时创建新的。
- Prisma schema：Conversation 模型新增 `title`（自动生成标题）和 `status`（active/archived）字段，非破坏性迁移。
- 后端：ConversationService 新增 `resumeOrCreateSession()`（按 userId+语言查找活跃会话或按 conversationId 恢复）、`archiveConversation()`（归档会话）、`persistSessionPublic()`（供 VoiceTutorService 回写 TTS URL）。
- 后端：`startSession()` 创建新会话前自动归档同用户同语言的旧活跃会话；`processMessage()` 首条用户消息自动生成标题；`listUserHistory()` 返回 title/status/messageCount。
- 后端：ConversationController 新增 `POST /resume` 和 `POST /:id/archive` 端点；`GET /history` 移除强制鉴权，游客返回空数组。
- 后端：VoiceTutorService TTS 合成成功后自动将 audioUrl 写回对应 AI 消息的 meta.audioUrl 并重新持久化，恢复会话时无需重新生成 TTS。
- 前端：conversationService 新增 `resumeConversation()`、`fetchConversationHistory()`、`fetchConversationById()`、`archiveConversation()` API 函数。
- 前端：ConversationPage 初始化逻辑重写，从 localStorage 读取 activeConversationId 传给 resume 接口；成功后写回 localStorage。
- 前端：新增 ChatHistoryDrawer 组件（左侧滑出抽屉，glass-sidebar 风格，显示会话列表/标题/时间/消息数，支持选择历史会话和新建对话）。
- 前端：新增 ChatModeSwitcher 组件（分段控制器：语音/文字/沉浸三模式，沉浸模式禁用并显示"即将推出"）。
- 前端：VoiceInput 新增 hideVoice prop，文字模式下隐藏麦克风按钮。
- 前端：TTS 合成 effect 增加 chatMode 守卫，文字模式下跳过所有 TTS 请求。
- 前端：聊天头部改造——新增历史记录按钮、显示会话标题、模式切换器替代原沉浸模式按钮。
- 国际化：LocaleContext 新增 chatHistory/newChat/noHistory/noHistoryHint/chatModeVoice/chatModeText/chatModeImmersive/chatModeImmersiveDisabled 翻译键。
- 类型：ConversationSession 新增 title/status 字段；新增 ConversationHistorySummary 接口。
- 文档：新增 docs/chat-persistence-prd.md 记录持久化功能 PRD。

### 2026-02-06（聊天持久化 Bug 修复）

- 后端：修复 `GET /conversation/history` 路由被 `GET /:conversationId` 参数路由抢先匹配的问题，将 history 路由移到参数路由之前，历史记录接口恢复正常。
- 后端：`resumeOrCreateSession()` 新增 targetLanguage 校验——当 localStorage 中的 conversationId 对应的会话语言与请求语言不匹配时，跳过恢复并创建新会话，修复切换学习语言后 AI 仍用旧语言回复的问题。
- 后端：VoiceTutorService ffmpeg 路径解析增加系统 ffmpeg 回退检测（`where ffmpeg` / `which ffmpeg`），ffmpeg 不可用时跳过 webm→mp3 转换并直接发送 webm 给 Whisper API（Whisper 原生支持 webm），消除 ENOENT 报错。
- 前端：ChatModeSwitcher 改为 `inline-flex` + `flex-1` 等宽按钮布局，移动端居中显示，解决标签过宽问题。
- 后端：彻底移除 fluent-ffmpeg / ffmpeg-static 依赖，`ensureMp3()` 直接透传原始文件给 Whisper API（原生支持 webm/wav/mp3/m4a 等格式），根治 spawn EFTYPE 崩溃。
- 后端：历史记录接口从 `GET` 改为 `POST /conversation/history`，新增 `listByIds()` 方法——游客用户通过 body `{ ids: [...] }` 传入 localStorage 中保存的会话 ID 列表查询历史，认证用户仍按 userId 查询。
- 前端：新增 `getStoredConversationIds()` / `trackConversationId()` 工具函数，在 localStorage 维护 `conversationIds` 列表（去重、最多 50 条）；`loadHistory()` 将 ID 列表传给后端，游客用户也能看到历史记录。

### 2026-02-09（UI 优化与语音风格）

- 前端：VocabularyPopover 改用 `createPortal` + 固定定位，根据触发元素位置动态计算弹窗坐标，自动适配视口边界（上下翻转、左右夹紧），解决关键词弹窗被消息气泡遮挡的问题。
- 前端：游客模式聊天历史稳定性修复——会话初始化成功后自动预加载历史记录，`loadHistory()` 增加一次自动重试（800ms 延迟），避免瞬时网络抖动导致历史列表为空。
- 前端：侧边栏用户信息改为从 AuthProvider 读取，与 ProfilePage 保持一致——显示真实用户名/邮箱/手机号，游客显示"游客"，移除硬编码 "John Doe"。
- 前端：ProfilePage 统计卡片与进度条数据改用 `PROFILE_DEFAULT_STATS` / `PROFILE_DEFAULT_PROGRESS` 常量（默认值 "--" / "0%"），清除写死的 47/342/12/B1 等假数据，为后续接入后端统计 API 做准备。
- 前端：复习卡片 TTS 优化——移除 `handleSpeak` 中的 `new Audio().play()` 重复播放，改为设置 `audioUrl` 后由 AudioPlayer 组件统一播放（新增 `autoPlay` prop）；合并顶部发音按钮与翻译区 AudioPlayer 为单一入口，消除两个朗读按钮的问题。
- 前端：VoiceStyleSelector 精简为 3 种自然语音风格（柔和 shimmer / 活力 nova / 自然 alloy），移除机械感较强的 echo/fable/onyx；组件改为紧凑分段控制器样式，与 ChatModeSwitcher 视觉风格统一。
- 前端：ConversationPage 集成语音风格选择器，桌面端显示在模式切换器左侧，移动端显示在语言选择下方；文字模式下自动隐藏。
- 前端：修复同一会话内 TTS 语音不一致问题——`queueTtsForMessage` 使用 `ttsVoiceRef` 避免闭包捕获旧值，所有 TTS 请求统一携带用户选择的 voice 参数，确保同一会话内语音风格一致。
- 前端：聊天页顶部栏布局重构——移动端：标题行（历史/标题/模式切换）+ 控制行（语言分段 | 分隔线 | 语音分段），水平滚动不换行；桌面端：左侧标题区（历史按钮 + 标题 + 语言分段控制器）+ 右侧工具区（语音风格 + 模式切换），所有控件统一为圆角分段控制器风格。
- 国际化：LocaleContext 精简为 voiceStyle/voiceShimmer/voiceNova/voiceAlloy 翻译键。
- 常量：`constants/ui.ts` 新增 `TTS_VOICE_OPTIONS`（3 项）、`DEFAULT_TTS_VOICE`、`PROFILE_DEFAULT_STATS`、`PROFILE_DEFAULT_PROGRESS`。

### 2026-02-09（Bug 修复与数据接入）

- 前端：语音模式 turn-based 限制——录音/上传期间设置 `isSending=true`，阻止用户在上一条语音处理完成前发送新消息，防止并发覆盖；SSE 收到新消息或上传失败时自动解锁。
- 前端：语音文件 URL 解析修复——新增 `resolveAudioUrl()` 辅助函数，将后端返回的相对路径 `/api/conversation/...` 正确映射到 `API_BASE_URL`，修复开发环境下 Vite 代理 400 错误。
- 后端：游客历史记录修复——`listByIds()` 在数据库不可用时回退到内存缓存查找会话，游客创建新对话后可立即看到历史记录。
- 前端：VocabularyPopover 修复——将 `AnimatePresence` 移入 `createPortal` 内部（始终渲染 portal，内部条件渲染动画子元素），解决 AnimatePresence 包裹 portal 导致弹窗无法显示的问题；按钮点击增加 `stopPropagation` 防止事件冒泡。
- 前端：成就殿堂页接入后端 API——新建 `achievementService.ts`，AchievementHallPage 从 `GET /achievements`、`GET /achievements/levels`、`GET /achievements/summary` 获取真实数据，移除全部硬编码成就/等级/XP 数据；增加加载态。
- 前端：ProfilePage 接入后端成就 API——统计卡片（会话数/词汇量/成就数/等级）和进度条从 `fetchAchievementSummary()` 获取真实数据；最近成就列表从 `fetchAchievements()` 获取已解锁成就，移除硬编码假数据。
- 后端：AI Prompt 强化 key_terms 过滤——明确要求 key_terms 仅包含目标语言词汇，禁止包含教学元语言和母语词汇，减少系统提示语混入复习词库。
- 后端：ReviewService 过滤系统欢迎消息——`extractLowScoreCards()` 跳过首条 AI 消息（系统欢迎语），防止其被纳入低分复习卡片。
- 前端：`mapSessionToMessages` 跳过首条 AI 消息的 keyTerms 注解映射，避免欢迎语中的词汇被标注和收藏。
- 国际化：新增 `profileNoAchievements` 翻译键（中/英）。

### 2026-02-09（发音评估与性能优化）

- 后端：对话标题自动生成修复——`processMessage()` 改为在首条用户消息时始终替换默认场景标题（原逻辑因 `startSession` 已设置标题导致 `!session.title` 永远为 false），用户首句话自动成为对话标题。
- 后端：发音评估系统重新设计——Prompt 新增详细评分规则：非目标语言 10-30 分、无意义输入 0-15 分、目标语言按语法(40%)+词汇(30%)+自然度(30%)评分；新增 `pronunciationTip` 字段，AI 每次回复附带一句简短的发音/表达建议。
- 后端：AiResponseSchema 新增 `pronunciationTip: z.string().optional()`；ConversationMessage.meta 新增 `pronunciationTip` 字段；`processMessage()` 将 AI 返回的 pronunciationTip 写入消息 meta。
- 前端：Message 类型新增 `pronunciationTip` 字段；`mapSessionToMessages` 将 AI 消息的 pronunciationTip 映射到对应用户消息；MessageBubble 在评分徽章下方显示发音建议文本。
- 前端：SWR 缓存机制——`apiClient.ts` 新增 `cachedGet()` 和 `invalidateCache()` 工具函数，实现 stale-while-revalidate 模式：首次访问正常加载，后续访问立即显示缓存数据并在后台刷新。
- 前端：achievementService/reviewService/favoritesService 各新增 `*Cached()` 版本，AchievementHallPage/DailyReviewPage/FavoritesPage/ProfilePage 全部改用缓存版本，二次访问页面即时渲染。
- 前端：三个页面的加载态从纯文本/spinner 升级为骨架屏（animate-pulse），提升感知加载速度。
- 前端：FavoritesService 在 `createFavorite`/`removeFavorite` 时自动 `invalidateCache('favorites')`，确保修改后下次访问获取最新数据。
- 后端：ReviewService 新增 `isQualityInput()` 质量过滤——`extractLowScoreCards()` 跳过纯数字、重复字符、过短输入（<2字符）、低字符多样性等无意义用户消息，防止 "1111"、"asdf" 等垃圾输入进入复习词库。

### 2026-02-14（沉浸模式修复与 UI 重设计）

- 后端 WS 代理修复：`resolveRealtimeWsUrl()` 强制使用 `wss://` 协议（原逻辑将 `http://` 转为 `ws://`，导致 yunwu API 拒绝非 TLS 连接）。
- 后端 session.update 修复：`input_audio_transcription.model` 从 `gpt-4o-mini-transcribe` 改为 `whisper-1`（Realtime API 标准模型），消除因模型不支持导致的静默失败。
- 后端 server_vad 配置完善：`REALTIME_DEFAULT_TURN_DETECTION` 新增 `threshold: 0.5`、`prefix_padding_ms: 300`、`silence_duration_ms: 500`，让服务端 VAD 更精准地检测语音起止。
- 后端上游事件日志：upstream `message` 处理器新增 `session.created`、`session.updated`、`error` 事件的日志输出，方便排查连接问题。
- 后端事件白名单：新增 `conversation.item.create` 到 CLIENT_EVENT_ALLOWLIST。
- 前端 VAD 冲突修复：移除 `useRealtimeSession` 中的客户端 VAD 逻辑（speakingRef/lastSpeechAtRef/speechStartAtRef/hasAudioRef），改为持续流式发送所有音频数据，由服务端 server_vad 统一处理语音检测与响应触发，消除客户端手动 `commit` + `response.create` 与服务端 VAD 的冲突。
- 前端新增 `sessionReadyRef` 追踪 `session.created`/`session.updated` 事件，确保会话就绪。
- 沉浸模式 UI 重设计：
  - ImmersiveMode：深色渐变背景（`immersive-bg`）+ 环境光晕层 + framer-motion 动画过渡，顶栏极简化（pill 形退出按钮 + 模式标签），底部控制栏改为 pill 形容器。
  - AudioOrb：多层设计（外环 + 内环 + 主球体 + 高光层 + 中心点），音量驱动缩放/光晕/环形扩展，AI 说话时渐变色切换（indigo→violet/fuchsia/pink）。
  - TranscriptSubtitles：blur 进出动画，用户消息 indigo 半透明背景，AI 消息白色半透明背景，草稿条目带脉冲光标。
  - ImmersiveControls：pill 形控制栏（backdrop-blur），静音按钮带红色边框指示，结束按钮红色圆形 + 阴影，设置按钮高亮状态。
- CSS 新增：`immersive-bg`（深色渐变）、`safe-area-inset-top`、`scrollbar-none`（隐藏滚动条）、优化 `orbPulse` 动画参数。
- 聊天页导航栏修复：移动端第一行减小间距（gap-1.5, px-2），标题 `flex-1 min-w-0 truncate` 确保不挤压模式切换器；第二行语言标签减小内边距（px-2 py-1），VoiceStyleSelector 包裹 `shrink-0` 防止被压缩；ChatModeSwitcher 移动端按钮内边距从 `px-2.5 py-2` 减为 `px-2 py-1.5`。

### 2026-02-14（沉浸模式关键 Bug 修复）

- **[Critical] 二进制帧转发 Bug**：`ws` 库从 yunwu 上游收到的消息为 `Buffer` 类型，`client.send(buffer)` 会以 WebSocket binary frame 发送；浏览器端 `onmessage` 收到 binary frame 时 `event.data` 为 `Blob`（非 string），前端 `typeof event.data !== 'string'` 判断直接丢弃所有上游事件——导致前端从未收到任何 `session.created`、`response.audio.delta`、`response.audio_transcript.delta` 等事件，表现为"有连接无回复"。修复：新增 `toTextMessage()` 辅助函数将 `Buffer`/`Buffer[]` 转为 UTF-8 字符串，`client.send(text)` 以 text frame 发送，浏览器正常接收。
- **WS 协议回退**：第一轮修复错误地将 yunwu URL 强制转为 `wss://`，但 yunwu Realtime API 实际使用 `ws://`（参考官方 Python 示例 `ws://yunwu.ai/v1/realtime`）。回退 `resolveRealtimeWsUrl()` 为协议感知映射（ws/wss 保持原样，http→ws，https→wss），`env.config.ts` 默认值改为 `ws://yunwu.ai/v1/realtime`。
- 下游消息同样使用 `toTextMessage()` 统一处理，确保客户端发送的文本帧在转发给上游时也正确解析。

### 2026-02-14（沉浸模式体验优化）

- **重复 AI 回复修复**：`silence_duration_ms` 从 500ms 提升至 1200ms，`threshold` 从 0.5 提升至 0.6，避免用户自然停顿（换气、思考）被误判为语音结束而触发多次 AI 回复。
- **useEffect 稳定化**：ImmersiveMode 的 connect/disconnect 改用 `useRef` 存储，useEffect 依赖数组为空，避免回调身份变化导致反复断连重连。
- **错误提示修复**：`handleRealtimeEvent` 在收到 `session.created`/`session.updated` 时清除 `lastError`，避免连接成功后仍显示旧错误信息。
- **TTS 重复调用修复**：新增 `ttsBaselineRef` 记录进入沉浸模式时的消息数量，退出后 TTS effect 仅处理 baseline 之后的新消息，避免对沉浸模式期间的对话重复调用 TTS/STT 服务。
- **沉浸模式 UI 重设计 v2**：
  - ImmersiveMode：更深的背景渐变（`#06060c`→`#0e0a1a`），三层非对称环境光晕，顶栏极简化为单个返回箭头 + 右侧错误提示，fade-in 入场动画。
  - AudioOrb：单环设计（去掉多余内环），更柔和的 violet 系光晕，glass overlay 层增加深度感，cubic-bezier 缓动曲线更自然。
  - TranscriptSubtitles：去掉用户消息的彩色背景和边框，用户消息改为极淡白色背景，AI 消息无背景纯文字，更大的 blur 进出动画。
  - ImmersiveControls：去掉 pill 容器背景，三个按钮直接排列，更大间距（gap-5），静音状态用红色图标而非红色边框，整体更通透。
  - CSS：orbPulse 动画改用 violet 色调，周期延长至 2.8s 更沉稳。

### 2026-02-14（体验优化与 Toast 统一）

- **沉浸模式连接提示**：连接中状态显示"正在连接导师..."，1.2s 后淡入"首次连接可能需要几秒钟"提示，避免用户误以为是 Bug。
- **用户实时字幕修复**：`buildSessionUpdate` 的 `input_audio_transcription.model` 改为使用 `transcribeModel` 参数（而非硬编码 `whisper-1`），确保 yunwu 代理正确配置转写模型。
- **对话标题优化**：新增 `summarizeTitle()` 方法，根据首条用户消息智能生成标题——CJK 文本截取 15 字符，英文按词边界截取 28 字符，去除标点符号，替代原来的直接复制。
- **游客历史限制**：localStorage 中的 `conversationIds` 列表从最多 50 条缩减为最多 5 条，避免游客模式下历史记录无限增长。
- **沉浸模式通话时长**：游客从 180s 缩减为 120s（2 分钟），认证用户从 900s 缩减为 180s（3 分钟），控制 API 消耗。
- **Toast 通知统一**：引入 `sonner` 库，在 `main.tsx` 添加全局 `<Toaster>` 组件（暗色玻璃态风格，顶部居中），ConversationPage/FavoritesPage/DailyReviewPage 的所有 `setErrorMessage` 替换为 `toast.error()`，移除内联错误 div，统一通知风格。
- **状态文案优化**：沉浸模式状态标签去掉省略号（"正在聆听"而非"正在聆听..."），更简洁。

### 2026-02-14（沉浸模式卡顿修复与 UI v3）

- **[Critical] 回声反馈修复**：新增 `isAiSpeakingRef`，在 `onaudioprocess` 中当 AI 正在播放音频时抑制麦克风输入（`setAudioLevel(0); return`），防止 AI 音频被麦克风拾取后发送给服务端 VAD，导致状态在"聆听/说话"间反复跳跃、AI 音频卡顿、以及触发重复回复。
- **VAD 灵敏度回调**：`silence_duration_ms` 从 1200ms 降回 800ms——之前的重复回复根因是回声反馈而非静默时间过短，1200ms 反而增加了不必要的响应延迟。
- **10s 响应延迟说明**：服务器日志显示 yunwu API 首次连接耗时约 10s（16:00:53→16:01:03），属于上游代理冷启动延迟，非应用层问题；`do_request_failed` 错误为 yunwu 代理侧问题。
- **沉浸模式 UI v3**：
  - ImmersiveMode：纯黑背景（`#000`），去掉渐变和环境光晕层，X 关闭按钮替代返回箭头，更极简的布局。
  - AudioOrb：缩小尺寸（w-28/h-28 → w-36/h-36），新增 ambient glow 层（blur-3xl），AI 说话时切换为更亮的紫色光晕（rgba(168,130,255)），去掉多余的外环和内环。
- TranscriptSubtitles：居中对齐布局，去掉左右对齐和背景色，用户消息 white/40、AI 消息 white/80，更简洁的字幕风格。
- ImmersiveControls：去掉外层容器，按钮改为固定尺寸（w-12/h-12，结束按钮 w-14/h-14），静音状态用 red-500/20 背景 + red-400 图标。
- CSS：orbPulse 动画改用蓝紫色调（rgba(120,100,255)），周期延长至 3s，增加 scale 变化；移除未使用的 `immersive-bg` 类。

### 2026-02-28（下一阶段开发计划）

- 新增 `docs/plan.md`，沉淀下一阶段统一执行路线图，围绕 **稳定性、易用性、趣味性、学习效果** 四个维度给出 90 天目标和 KPI。
- 在计划中明确 P0/P1/P2 需求分层、4 个 Sprint 里程碑、可验收标准与近期两周可直接开工的任务清单。
- 增加文档维护约定：里程碑勾选、日志同步、环境变量变更同步 `.env.example`，用于约束后续协作流程。

### 2026-02-28（P0 开工：Realtime 错误码与恢复链路）

- 后端：新增 `realtime-error.types.ts`，定义统一 `server.error` 协议（`BAD_REQUEST / PERMISSION_DENIED / RATE_LIMITED / SERVICE_UNAVAILABLE / UPSTREAM_ERROR / INTERNAL_ERROR`）。
- 后端：`realtime.ws.ts` 中连接前置校验、频控、上游关闭/异常、客户端异常均改为“先发送结构化错误，再关闭连接”，便于前端精确感知错误原因。
- 前端：`useRealtimeSession` 增加服务端错误码解析与映射，新增 `RATE_LIMITED / SERVICE_UNAVAILABLE / INVALID_REQUEST` 客户端错误类型；通过 ref + state 同步写入，修复 `server.error` 与 `onclose` 竞态覆盖问题。
- 前端：沉浸模式错误提示升级为玻璃态 pill，错误态新增“切换到文字模式”按钮，连接不可恢复错误时不再显示误导性的重连按钮。
- i18n：新增中英文错误文案（限流、服务不可用、参数无效）及回退文案，保持双语体验一致。

### 2026-02-28（P0 继续：Realtime 可观测埋点）

- 后端：新增 `RealtimeMetricsService`（内存指标聚合），覆盖连接接入数、连接成功数、失败数、疑似重连次数、连接耗时（avg/min/max/count）、transcript 保存成功/失败计数。
- 后端：`RealtimeWsProxy` 接入指标埋点，记录关键失败错误码与 WebSocket close code 分布，并保留最近失败事件列表（含是否可重试）。
- 后端：新增 `GET /api/realtime/metrics` 查询接口，支持开发与运维快速查看实时链路健康度（无需改动数据库）。
- 文档：`docs/plan.md` 勾选完成“WS/REST 关键埋点接入（成功率、耗时、错误）”。

### 2026-02-28（回归修复：沉浸模式无回复 / Toast 残留 / TTS 不触发）

- 后端 Realtime 会话配置修复：`buildSessionUpdate()` 改为使用 `transcribeModel`（默认 `gpt-4o-mini-transcribe`），不再硬编码 `whisper-1`；同时显式开启 `turn_detection.create_response=true` 与 `interrupt_response=true`，避免“有收音无回复”。
- 后端 WS 关闭码修复：上游异常关闭返回 `1006` 时不再透传给 `client.close(1006)`（保留码），统一映射为可发送的 `1011`，避免客户端状态异常。
- 前端 Realtime 兜底触发：新增 `speech_stopped -> 延迟检测 -> response.create` 兜底机制（若短时间内无 AI 输出），缓解上游 VAD 偶发未触发回复的问题。
- 前端 Toast 刷新修复：`Toaster` 增加默认 `duration`，并在会话/SSE 恢复后主动 `toast.dismiss` 对应错误提示，避免顶部错误提示长期停留。
- 前端 TTS 触发修复：TTS 自动合成从“仅 voice 模式”调整为“非 immersive 模式均可触发”；退出沉浸模式时 baseline 由 `MAX_SAFE_INTEGER` 改为当前消息长度，确保后续新增文本回复可正常生成导师语音。

### 2026-02-28（沉浸模式回归修复收尾：转写完整性 / TTS 复用 / 状态同步 / UI）

- 前端转写完整性：`useRealtimeSession` 扩展事件覆盖（`conversation.item.completed`、`response.output_item.done`），并增强 transcript 提取器，支持 `payload/item/content/formatted` 多种字段结构，修复“用户有收音但无文本回显”的漏识别路径。
- 前端字幕可读性：沉浸字幕升级为左右分栏玻璃气泡（用户在右、导师在左），用户文本不再低对比隐藏，草稿态保留动态光标，减少“只有导师有 transcript”的感知误差。
- 前端状态同步：聊天页 SSE `onerror` 不再主动 `close()`，恢复浏览器原生重连；新增 `online/offline` 事件联动 `toast.dismiss/error`，并在模式切换和卸载时清理 `stream` toast，避免网络错误提示长期滞留。
- 沉浸模式提示生命周期：`immersive-status` toast 增加组件卸载清理，消除退出沉浸后残留错误提示。
- 后端 TTS 复用增强：`VoiceTutorService` 复用同会话同文本同音色的历史音频时，新增文件存在性校验（`access`），命中脏链接时自动回退到新合成，避免前端拿到失效音频 URL。
- 沉浸模式 UI 收尾：控制区改为统一玻璃容器（圆角、边框、阴影、自适应尺寸），按钮状态层级更清晰；底部字幕卡片限制最大宽度并移动端自适应，整体视觉更简约一致。

### 2026-02-28（沉浸模式连接崩溃兜底：上游握手 400）

- 复现确认：沉浸模式断连并非前端链路本身，后端直连上游 Realtime 握手返回 `400 Bad Request`，响应体包含 `type=new_api_panic`（上游网关异常），会导致连接阶段直接失败。
- 后端：`realtime.ws.ts` 新增 `upstream.unexpected-response` 处理，读取并记录响应体摘要（status + body 片段），不再只看到 `Unexpected server response: 400` 的黑盒日志。
- 后端：握手被拒绝时统一下发 `server.error(SERVICE_UNAVAILABLE, retriable=false)` 并停止同一连接重复 close/error 处理，避免前端误判和重试风暴。
- 前端：Realtime 限流(`1013`)改为自动走重连分支；`REALTIME_RECONNECT_DELAY_MS` 从 `800ms` 调整到 `1800ms`，显式超过服务端 `1500ms` cooldown，减少“刚重连就再被限流”的失败循环。
- 前端：沉浸失败回退按钮文案改为“切换到语音模式”，并直接回退到 `voice` 模式，保证在上游 Realtime 不可用时仍可继续语音学习对话。

### 2026-02-28（沉浸模式连接体验增强：加载态 + 超时重连 + 延迟报错）

- 前端连接策略调整：Realtime 从“首次失败立即报错”改为“连接超时后自动重连、达到阈值才报错”。
- 新增连接超时控制：`REALTIME_CONNECT_TIMEOUT_MS=10000`，10 秒未完成握手自动关闭当前 socket 并进入重连流程，避免长时间卡死在假连接。
- 重连策略升级：`REALTIME_RECONNECT_MAX_ATTEMPTS` 从 `1` 提升到 `4`，并使用退避延迟（`1.8s * attempt`，上限 8s），减少瞬时故障导致的误报。
- 限流处理优化：`1013` 不再立即 error 结束，优先自动重连（延迟超过服务端 cooldown），仅在重试耗尽后展示错误。
- 上游业务错误降噪：对 `response_cancel_not_active`、`conversation_already_has_active_response` 不再映射为网络错误 toast，避免“可正常使用时仍显示网络错误”。

### 2026-02-28（P0 子模块完成：沉浸模式失败恢复 UI 标准化）

- 新增连接恢复元数据：`useRealtimeSession` 输出 `reconnectAttempt`、`reconnectMaxAttempts`、`nextRetryAt`，让 UI 可展示明确的恢复过程，而不是只显示“网络错误”。
- 新增组件：`ImmersiveConnectionStatus`（玻璃态），统一展示连接中/重连中状态、当前重试轮次、下一次重试倒计时，弱化“立即失败”的负反馈。
- 重连体验升级：连接成功后自动清空重连元数据；重试耗尽后才落最终错误，保证“先恢复、后报错”的交互节奏。
- 文本同步修复：退出沉浸模式立即 `fetchConversationById` 拉取会话快照，避免必须切换 tab 才看到最新文本。

#### 反思（本轮）

- 失败提示不能只基于单个 `onerror` 事件：实时链路天然抖动，需要“状态机 + 退避 + 可视化恢复”一体化设计。
- 业务级 realtime error 与网络 error 必须分离：`response_cancel_not_active` 这类提示不应污染网络状态，否则会误导用户与排障方向。
- 可维护性关键在于“UI 不推断底层细节”：连接/重连指标由 Hook 统一提供，组件只做展示，后续扩展（更多模式复用）成本更低。

### 2026-02-28（P0 完整推进：恢复 UI 标准化 + 状态机边界收敛 + 关键路径测试）

- `P0-1 失败恢复 UI 标准化（语音/文字模式）`
  - 新增 `ConversationRecoveryBanner` 组件，统一展示 `initializing / recovering / error` 三态，并提供可操作 `Retry` CTA。
  - `ConversationPage` 接入统一恢复状态：会话初始化、SSE 断流恢复、发送失败、语音上传失败均归一到同一状态层，不再仅依赖离散 toast。
  - SSE 恢复流程增加 12s 升级策略：先显示“自动恢复中”，超时后再进入“可重试错误态”，降低误报与焦虑感。

- `P0-2 状态机边界收敛（Realtime）`
  - `useRealtimeSession` 增加 `responseInFlight` 门控：仅在存在活跃响应时发送 `response.cancel`，避免无效 cancel 请求污染日志。
  - `response.create` 发送增加并发保护（仅在 `!responseInFlight` 下触发），并对 `response_cancel_not_active`、`conversation_already_has_active_response` 做业务级降噪，不再映射为网络错误。
  - 重连元数据标准化输出：`reconnectAttempt / reconnectMaxAttempts / nextRetryAt`，沉浸模式可展示“第几次重连 + 倒计时”。

- `P0-3 Realtime 关键路径测试`
  - 新增 `realtime.ws.helpers.ts`，将 WS 关键状态映射逻辑抽离为可测试纯函数（提升可维护性）。
  - 新增 `realtime.ws.helpers.spec.ts`，覆盖 9 条关键路径：session.update 构造、transcribe 模型回退、close code 映射、保留 close code 安全转换。
  - 测试通过：`pnpm --filter server test --runInBand`（9/9 passed）。
