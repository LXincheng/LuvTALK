# LuvTALK 技术架构与实现说明

> 本文从整体架构、后端模块、前端应用、语音 Tutor 流程、缓存与实时交互等维度，系统性说明当前实现细节与设计思路，突出技术能力与创新点。

## 1. 整体架构概览

- **形态**：Turborepo + pnpm 的 monorepo
  - `apps/server`：NestJS 11 + Prisma/PostgreSQL，提供 REST API、SSE 推送、AI 能力编排。
  - `apps/web`：React 19 + Ionic React 8 + Vite，PWA 形态前端，使用 Zustand 做状态管理。
- **AI 组合**
  - DeepSeek（OpenAI 兼容）作为稳定的文本 Tutor / 翻译引擎。
  - “Yunwu” OpenAI 兼容网关提供 GPT‑4/5 系列语音与高阶文本能力：STT（/audio/transcriptions）、TTS（/audio/speech）、GPT‑5.1 文本回复。
  - 所有 AI 输出通过 Zod schema 校验，避免“自由文本”破坏前端结构。
- **交互模型**
  - 发送消息：前端乐观更新 + 后端 DeepSeek/Yunwu 请求。
  - 推送结果：NestJS `@Sse` + RxJS Subject 广播 `ConversationSession`，前端 `EventSource` 订阅。
  - 语音链路：MediaRecorder 录音 → 后端落盘/转码 → Yunwu STT → 转为文本驱动既有会话逻辑。

### 1.1 核心设计原则

1. **单一会话模型**：不区分“语音会话”和“文本会话”，后端统一用 `ConversationSession` 和 `ConversationMessage` 表示，语音只是带 `meta.audioUrl` 的消息。
2. **AI 结果结构化**：所有 Tutor 回复经 `AiResponseSchema`（Zod）校验，始终提供 `reply/score/correction/cultureNote/associativePhrases` 等字段。
3. **渐进增强**：基础能力依赖 DeepSeek 文本模型；Yunwu GPT‑5/STT/TTS 作为增强层，任何增强失败必须优雅降级到文本路径。
4. **实时而可恢复**：SSE + 本地缓存 + 轻量服务器缓存保证“体验实时、状态可恢复”，即便网络抖动或进程重启，也不丢关键状态。

---

## 2. 后端架构（apps/server）

### Google OAuth 配置指南

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 创建项目，进入“OAuth 同意屏幕”配置应用名称、支持邮箱，并将测试用户添加为允许的帐号。
2. 在“凭据”中创建 **Web 应用**类型的 OAuth 2.0 Client。  
   - 授权的 JavaScript 来源：`http://localhost:5173`（或你的部署域名）。  
   - 授权的重定向 URI：`http://localhost:5173`（本地开发使用同一入口即可）。
3. 复制生成的 `Client ID` 和 `Client Secret`：
   - 服务端 `.env` 需要设置 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`。  
   - 前端 `.env`（或 `.env.local`）设置 `VITE_GOOGLE_CLIENT_ID`，以及可选的 `VITE_GOOGLE_REDIRECT_URI`（默认使用窗口 `origin`）。
4. 启动后，前端会使用 Google One Tap code flow，将返回的 `code`（配合 `redirectUri`）提交给 `POST /auth/google`，服务端再去 Google `https://oauth2.googleapis.com/token` 交换 `id_token`。若需在生产部署，请确保前后端使用同一重定向地址，并在 Google 控制台中添加对应域名。
5. 每次更新 env 后重启 server/web。若数据库未运行 `prisma migrate` 会导致用户字段缺失，可执行 `pnpm --filter server prisma:migrate` 应用最新 schema。

### 2.1 模块划分

- `app.module.ts`
  - 责任：汇总全局模块。
  - 关键导入：
    - `ConfigModule.forRoot({ isGlobal: true })`：统一读取 `.env`。
    - `CacheModule.register({ isGlobal: true, ttl: 0, max: 200 })`：内存缓存。
    - `AppCacheModule`：封装业务级缓存服务。
    - 业务模块：`ConversationModule`、`VoiceTutorModule`、`TranslationModule`、`CultureModule`、`FavoritesModule`、`HealthModule`。

- `core/prisma/*`
  - `PrismaModule` / `PrismaService`：所有 DB 访问统一入口，提供 `canUseDatabase()` 方便在 dev/无 DB 环境下降级到内存模式。

- 业务模块：
  - `conversation`：会话、AI Tutor、SSE。
  - `voice-tutor`：语音上传、转写、TTS、音频流。
  - `translation`：短句翻译 + 小词典 + DeepSeek AI 翻译。
  - `culture`：文化卡片生成（GPT）。
  - `favorites`：收藏管理。
  - `health`：健康检查。

### 2.2 配置与 Prompt

- `common/config/env.config.ts`
  - `envConfig.deepseek`：DeepSeek API URL/Key/模型，默认 `https://api.deepseek.com/v1` + `deepseek-chat`。
  - `envConfig.openai`：Yunwu OpenAI 兼容配置，包含 `apiUrl/apiKey/transcribeModel/tutorModel/ttsModel`。
  - 设计点：统一封装，避免多个模块直接访问 `process.env`。

- `common/config/prompt.config.ts`
  - `buildConversationSystemPrompt`：
    - 根据 `LanguageCode` 和场景 label 生成系统 prompt。
    - 明确要求返回严格 JSON 结构（Tutor 回复 + 纠错 + 文化提示 + 评分），方便后端用 Zod 解析。
  - `buildCulturePrompt`：生成文化卡片 JSON，供文化模块使用。

### 2.3 数据模型（Prisma）

- `prisma/schema.prisma`
  - `Conversation`
    - `messages: Json`：存整个 `ConversationMessage[]`。
    - `score: Int?`：最近一次 AI 总评分。
  - `Favorite`
    - 通过 `conversationId` 与会话关联，可收藏词汇、文化卡片、句型等。
  - `TranslationRecord`：
    - 简化表，记录翻译历史；详细 variations 仅保存在内存（`TranslationService.history`）。

### 2.4 会话服务：ConversationService

文件：`modules/conversation/conversation.service.ts`

- **内存会话表 + SSE**
  - `sessions: Map<string, ConversationSession>`：进程内会话快照。
  - `sessionStreams: Map<string, Subject<ConversationSession>>`：每个会话 ID 对应一个 SSE 事件流。
  - `getOrCreateStream` / `broadcastSession`：在 `startSession`/`processMessage` 后广播最新 `ConversationSession`。

- **轻量缓存：SessionCacheService**
  - 注入自 `common/cache/session-cache.service.ts`。
  - `getSession`：
    1. 先查本地 `sessions`。
    2. 再查 `SessionCacheService`（CacheModule 内存缓存，TTL 60s）。
    3. 最后回退 Prisma `conversation.findUnique` 重建 Session。
  - `persistSession`：同时更新 `sessions` + SessionCache（再写数据库）。
  - 意义：高并发下减少 DB 读写，同时服务重启后仍以数据库为权威来源。

- **会话启动**
  - `startSession(dto: StartConversationDto)`
    - 构造欢迎消息（Tutor 介绍场景与目标语言）。
    - 生成新 `ConversationSession`，调用 `persistSession` & `broadcastSession`。

- **消息处理：processMessage**
  - 入参：`conversationId` + `SendMessageDto` + 可选 `userMessageMeta`（例如语音 audioUrl）。
  - 步骤：
    1. 查当前 Session（缓存/DB）。
    2. 规范化用户文本，生成 `user` 消息（带头像、时间）。
    3. 依次尝试：
       - `requestOpenAi`：Yunwu GPT‑5.1 文本 Tutor。
       - `requestDsAi`：DeepSeek 作为降级路径。
       - `composeAiResponse`：本地兜底模板。
    4. 将 AI 响应映射为 `ConversationMessage`（评分、纠错、文化说明写入 `coach` 和 `meta`）。
    5. 调用 `persistSession` 更新数据库与缓存。
    6. `broadcastSession` 通过 SSE 推送到前端。

- **AI 调用策略**
  - `requestOpenAi`：
    - 使用 `envConfig.openai` 组合 `/chat/completions` URL。
    - 传入 `buildConversationSystemPrompt` + 对话历史 + 当前用户句子。
    - 对返回 JSON 以 `AiResponseSchema` 进行 Zod 校验；失败则视为“该层不可用”，转入 DeepSeek。
  - `requestDsAi`：
    - 基于 DeepSeek 兼容 `/chat/completions` 接口。
    - 返回结果同样使用 `AiResponseSchema` 校验。
  - `composeAiResponse`：
    - 简单基于用户句长、场景生成一个合成结果（伪评分和提示），确保系统即使完全离线也能回复。

### 2.5 语音 Tutor：VoiceTutorService

文件：`modules/voice-tutor/voice-tutor.service.ts`

- **上传与落盘**
  - `handleUpload(conversationId, file: VoiceUploadFile)`
    - 校验文件存在与大小（5MB 以内）。
    - 通过 `ConversationService.getSession` 确认会话存在。
    - 生成 `operationId: voice-op-<timestamp>-<uuid>`。
    - 以 `tmp/voice-uploads/<conversationId>/<operationId>.<ext>` 形式写入磁盘。
    - 调用 `ensureMp3` 对 webm 等格式转码成 mp3（`fluent-ffmpeg` + `ffmpeg-static`）。
    - 使用 `VoiceOperationCacheService.mergeSnapshot` 记录 `status: received` + audioUrl。
    - 启动异步 `processVoiceUpload`，立即返回 `{ operationId, status: "received" }`。

- **状态流转（创新点：语音操作快照）**
  - `VoiceOperationCacheService`（`common/cache/voice-operation-cache.service.ts`）：
    - 结构：`voice-op:{operationId}` → `VoiceOperationSnapshot`：
      ```ts
      {
        operationId,
        conversationId,
        status: "received" | "transcribing" | "responding" | "completed" | "failed",
        audioUrl?: string,
        transcript?: string,
        error?: string,
        updatedAt: string
      }
      ```
    - TTL 5 分钟，避免旧状态长期占用内存。
  - `processVoiceUpload` 状态流：
    1. 标记 `transcribing`，调用 Yunwu `/audio/transcriptions`：
       - Node 18 `Blob` + `FormData` 原生能力构造 multipart。
       - 携带 `prompt` 和 `language` 提高转写质量（不同语言有不同 prompt）。
    2. 若 STT 失败：
       - 标记 `failed` + `error: "TRANSCRIPTION_FAILED"`。
       - 生成中文/英文 fallback 文案（解释语音转写失败，请继续以文本对话）。
       - 调用 `ConversationService.processMessage` 把 fallback 文案写入会话（带 `meta.audioUrl`，方便用户回放自己的语音）。
       - 最终将快照标记为 `completed`（有错误码）。
    3. STT 成功：
       - 标记 `responding` + `transcript`，并调用 `forwardTranscript`：
         - 转写文本作为用户消息，通过 `processMessage` 驱动 AI Tutor。
         - `userMessageMeta.audioUrl` 保留原始音频链接。
       - AI 回复完成后将快照标记为 `completed` + `transcript`。
    4. 捕获任意异常时：
       - 标记 `failed` + `error: "PROCESSING_ERROR"`。
       - 同样通过 fallback 文案维持对话连续性。

- **TTS 音频合成**
  - `synthesizeSpeech(conversationId, text, voice?)`：
    - 使用 Yunwu `/audio/speech` 接口，模型取自 `envConfig.openai.ttsModel`。
    - 按 targetLanguage 选择不同的 `ttsVoice`（如粤语用 `fable`，普通话/英语用 `alloy`）。
    - 将生成的 mp3 落盘到 `tmp/voice-uploads/<conversationId>/tts-*.mp3` 并生成 audioUrl。
  - `openAudioStream`：
    - 根据 `conversationId/fileName` 打开本地文件流，并推断 mimeType（mp3/wav/webm/mp4）。

- **控制器：VoiceTutorController**
  - `POST /conversation/:conversationId/voice`：
    - `FileInterceptor("audio") + memoryStorage`，并对 MIME 类型白名单校验。
  - `POST /conversation/:conversationId/tts`：
    - 校验文本非空；调用 `synthesizeSpeech`。
  - `GET /conversation/:conversationId/voice/:fileName`：
    - 以流形式返回音频数据。
  - `GET /conversation/:conversationId/voice-status/:operationId`（新）：
    - 查询 `VoiceOperationCacheService`，返回该语音操作的最新快照，供前端轮询。

### 2.6 翻译与文化模块

- `TranslationService`
  - 内置小词典（“你好”“谢谢”等）用以生成多种语言变体、罗马字与文化提示。
  - 未命中词典时，通过 DeepSeek 进行简单机器翻译。
  - 所有翻译操作都会维护内存中的最近 8 条记录供前端查询。

- `CultureModule`
  - 使用 `buildCulturePrompt` + GPT 生成结构化文化卡片，返回标题/场景/表达/解释/建议。

---

## 3. 前端架构（apps/web）

### 3.1 技术栈与结构

- React 19 + Ionic React 8：移动友好 UI + 原生组件动效。
- Zustand：轻量状态管理（`useAppStore`）。
- Vite + `@vite-pwa`：提供 PWA 能力（后续计划扩展 Service Worker 缓存）。

目录（部分）：

- `src/App.tsx`：路由与主题/i18n 装配。
- `src/pages/Conversation`：主对话页。
- `src/pages/Favorites`：收藏页。
- `src/store/useAppStore.ts`：会话与收藏状态。
- `src/services/*`：API 客户端、会话服务、SSE 封装。
- `src/hooks/useVoiceRecorder.ts`：语音录制。
- `src/shared/i18n/LocaleProvider.tsx`：中英双语文案。
- `src/shared/constants/voice-ui.ts`：语音 UI 文案 key。

### 3.2 状态管理：useAppStore

文件：`apps/web/src/store/useAppStore.ts`

- `conversation` slice：
  - `session?: ConversationSession`：当前会话快照，完全由 SSE 驱动。
  - `start`：
    - 调用后端 `startConversation`，更新 `session`。
    - 打开 SSE：`createConversationStream(session.id, onUpdate)`。
  - `send`：
    - 先在本地追加一条 user 消息（乐观 UI），再发 REST 请求。
    - 请求完成或 SSE 推送后，以最新 `ConversationSession` 覆盖本地。
  - `sendVoice(audio: Blob): Promise<string | undefined>`：
    - 调用 `uploadConversationVoice`，返回 `operationId`（用于后续轮询状态）。
  - `reset`：关闭 SSE，清空 `session`。

- `favorites` slice：
  - `load/add/remove` 均围绕 REST API，带乐观更新与回滚逻辑。

### 3.3 实时会话：conversationStream

文件：`apps/web/src/services/conversationStream.ts`

- 基于浏览器原生 `EventSource`：
  - `GET /conversation/:id/events`。
  - 服务端会将 `ConversationSession` 序列化后推送，前端按事件更新整个 `session`。
  - 网络断线时 EventSource 自动重连，保证长连接韧性。

### 3.4 语音录制与上传：useVoiceRecorder + ConversationPage

- `useVoiceRecorder`（`hooks/useVoiceRecorder.ts`）
  - 封装 `navigator.mediaDevices.getUserMedia` + `MediaRecorder`。
  - 自动选取最佳 mimeType（mp3/mp4/webm）。
  - 在 `stop()` 时拼接 `Blob[]`，得到 `VoiceMemo`：
    ```ts
    interface VoiceMemo {
      blob: Blob;
      url: string;
      durationMs: number;
    }
    ```
  - 自动释放旧 `ObjectURL`，避免内存泄漏。

- `ConversationPage` 中的语音体验
  - 按住/点击麦克风按钮开始录音，再次操作停止录音并生成草稿。
  - 草稿区显示录音时长和一个可播放的 `<audio>` 控件。
  - 点击发送时：
    1. 调用 `conversation.sendVoice(voiceMemo.blob)`。
    2. 显示“语音已发送” toast。
    3. 在消息列表中预插入“语音草稿”气泡（用户侧）。
    4. 由 SSE 推送真正的“用户语音文本 + AI 回答”消息后，用户可看到正常气泡与评分。

### 3.5 语音处理状态 UI（与 /voice-status 集成）

文件：`pages/Conversation/index.tsx`

- 本地状态：
  - `voiceUploadStatus: "idle" | "uploading"`：控制录音按钮/发送按钮可用性。
  - `pendingVoicePreview`：记录草稿音频 URL 与时间戳。
  - `voiceProcessingState: VoiceOperationSnapshot | null`：
    - 反映服务端 VoiceTutor 状态（received / transcribing / responding / completed / failed）。

- 调用链：
  - 发送语音后：
    ```ts
    const operationId = await conversation.sendVoice(voiceMemo.blob);
    if (operationId && sessionId) {
      setVoiceProcessingState({
        operationId,
        conversationId: sessionId,
        status: "received",
        updatedAt: new Date().toISOString(),
      });
    }
    ```
  - `useEffect` 定时轮询：
    ```ts
    fetchVoiceOperationStatus(sessionId, operationId)
    ```
    每 1.5–2s 拉取最新状态，直到 `status` 为 `completed` 或 `failed`。

- 文案呈现：
  - Locale 中为不同阶段定义了中/英文提示：
    - `conversationVoiceStatusReceived`
    - `conversationVoiceStatusTranscribing`
    - `conversationVoiceStatusResponding`
    - `conversationVoiceStatusCompleted`
    - `conversationVoiceStatusFailed`
  - 在语音草稿区与“待回复”气泡中展示相应的状态提示 + loading spinner。
  - 若 `status === "failed"`，额外弹出 `conversationVoiceProcessingFailed` toast，提醒用户改用文本或重试。

### 3.6 多语言与主题

- `LocaleProvider`：
  - 管理 `uiLanguage: "zh" | "en"`，基于浏览器语言 + localStorage 决定初始值。
  - 所有 UI 文案通过 `t(key, params)` 访问，确保日后扩展语言时只需补字典。

- `useTheme`：
  - 封装深浅色主题，给 Ionic/IonApp 统一注入 className。

---

## 4. 实现原理与关键创新点

### 4.1 “文本为核心，语音为附加维度”的会话抽象

传统语音聊天系统往往单独建一套“语音会话模型”；LuvTALK 则坚持：

- 所有会话都归一到 `ConversationSession + ConversationMessage`。
- 语音仅通过 `meta.audioUrl` 和后端 VoiceTutor 补充的结构化信息（转写文本、评分等）体现。
- 优势：
  - 避免两套会话模型导致的 UI 分裂。
  - 任意消息都可以被收藏、翻译、作为文化素材二次利用。

### 4.2 双引擎 Tutor：Yunwu GPT‑5.1 + DeepSeek 降级

通过 `ConversationService` 的 AI 调用链实现：

1. Yunwu GPT‑5.1：高阶 Tutor，擅长结构化 JSON 输出和复杂语境。
2. DeepSeek：已在线上验证的稳定文本模型，作为可靠兜底。
3. 本地模板：极端情况下仍能生成一个合理的“伪 AI 回答”，避免系统“沉默”。

所有路径输出统一被 `AiResponseSchema` 校验为同一结构，大幅降低前端逻辑复杂度。

### 4.3 语音处理的“操作快照”模式

语音上传在云服务链路中通常经历多个阶段，LuvTALK 抽象为 `VoiceOperationSnapshot`：

- 每个 `operationId` 独立维护状态机：
  - `received → transcribing → responding → completed/failed`
- 每次状态变更，都会写入 `VoiceOperationCacheService`：
  - 允许**多进程/多实例**间共享语音处理进度（后续接入 Redis 时只需替换 Cache store）。
  - 前端可以安全轮询而不必依赖 SSE 顺序。
- 这一模式可复用到将来的长音频处理、离线批改等场景。

### 4.4 SSE + 乐观 UI + 轻量缓存的组合

整条文本/语音链路实现了“即发即显 + 稳定回写”：

- 乐观 UI：发送文本时先插入本地 user 消息，避免用户等待空白。
- SSE：后端生成最终 `ConversationSession` 后通过 `Subject` 广播，前端据此同步所有状态（文本、评分、翻译、收藏标记等）。
- 轻量缓存：
  - `SessionCacheService` 降低 Prisma 压力。
  - `VoiceOperationCacheService` 保证语音处理中间状态可见。
  - 均基于内存实现，无额外基础设施成本，后续可以平滑替换为 Redis。

### 4.5 可扩展的 PWA 设计（规划中）

虽然当前尚未实现完整 Service Worker，但架构已经为 PWA 做了预留：

- Vite PWA 插件已集成，后续可按 `docs/voice-tutor-plan.md` 中的方案：
  - 对 `GET /conversation/history`、`/conversation/:id/history`、`/assets/voice/*` 使用 Workbox `stale-while-revalidate`。
  - 在 IndexedDB 中持久化 `recentConversations` 与 `pendingVoices`，配合 `VoiceOperationSnapshot` 做离线态提示。

---

## 5. 后续演进方向

1. **PWA Service Worker 与离线会话**
   - 实现 Workbox 路由与缓存策略。
   - 在离线时优先展示本地缓存的最近会话与语音草稿。
2. **Google OAuth 与历史会话**
   - 引入 `AuthModule` + Google OAuth2（GIS Web Server Flow + NestJS Passport）。
   - `Conversation`/`Favorite` 增加 `userId` 维度，提供 `/conversation/history` 与 `/conversation/:id/history`。
   - 保留匿名模式；登录后自动挂接历史记录。
3. **语音分片 + 流式回复**
   - 一旦后端支持流式 STT/Tutor API，可扩展现有 SSE 通道，将长音频拆片分段转写并即时显示。
4. **更细粒度的监控与告警**
   - 为每个 `operationId` 记录完整的处理耗时链路（STT、Tutor、DB），便于做体验优化与成本分析。

以上设计在保持实现可落地、代码简洁的前提下，尽量将**结构化 AI 输出、语音操作快照、轻量缓存与 SSE** 组合起来，为未来扩展（PWA、OAuth、多端接入）打好了基础。**
