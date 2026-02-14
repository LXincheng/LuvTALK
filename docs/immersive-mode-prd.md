# LuvTALK Immersive Mode PRD / 沉浸式语音模式产品需求文档

## Context / 背景

LuvTALK 当前的语音管道采用 **录音-停止-等待** 循环：用户按下录音 → MediaRecorder 录制 → 上传到服务器 → Whisper STT → AI 生成回复 → TTS 合成 → AudioPlayer 播放。每一步都是独立的 HTTP 请求，延迟高、体验割裂。

**Immersive Mode** 使用 OpenAI Realtime API（通过 Yunwu API 提供），实现 **1-on-1 不间断实时语音对话**，消除录音-等待循环，提供类似 ChatGPT 实时语音的沉浸式体验。

---

## 0. Scope / 范围与前置假设

### 0.1 范围内 (In Scope)

- 基于 WebSocket 的实时语音对话（前端 → 后端 WS 代理 → Yunwu Realtime）
- 后端代理 WebSocket + 会话配置 + 对话记录落库
- 全屏沉浸 UI（字幕 + 音频可视化 + 控制栏）

### 0.2 非目标 (Out of Scope)

- 任何后端音频中继或流媒体转发
- 多人语音房间/群聊
- 离线语音识别（本地模型）

### 0.3 前置依赖 (Dependencies)

- Yunwu Realtime API 可用，支持 WebSocket 实时事件
- 现有 Conversation 模块可作为唯一对话存储源
- 前端已有 `motion/react`，可复用动画

> 若项目存在 `docs/plan.md / docs/goal.md / docs/architecture.md / docs/rules.md`，需先确认与本 PRD 一致。

---

## 1. Architecture / 架构方案

### 连接方式：WebSocket（推荐）

- 浏览器通过 WebSocket 连接后端代理，由后端直连 Yunwu Realtime API
- 后端仅负责转发事件与保存对话记录，**不中继音频**

### 关键设计决策

- **单一对话源**：所有转写最终写入 Conversation 会话，避免新建并行数据表
- **短周期保存**：仅在“转写完成事件”落库，进行中的字幕留在前端
- **统一模式状态**：前端沉浸模式与 `chatMode` 统一来源，避免双状态冲突
- **功能取舍**：Realtime 模式不做翻译/评分，仅提供自然对话与轻量纠错
- **安全优先**：WS 代理绑定用户与会话，并做频控

### 数据流

```
Browser                    LuvTALK Backend              Yunwu Realtime API
  |                              |                              |
  |== WebSocket /api/realtime/ws ==============================>|
  |                              |== WebSocket /v1/realtime ===>|
  |  audio/text events           |  audio/text events           |
  |  (append/commit/response)    |                              |
  |<=============================|<=============================|
  |                                                             |
  |-- (session ends) POST /api/realtime/transcript -->          |
  |                              |-- save to conversation DB    |
```

---

## 2. Backend Changes / 后端变更

### 2.1 配置 — `apps/server/src/common/config/env.config.ts`

在 `openai` 块中新增 `realtimeApiUrl` 与 `realtimeModel`：

```typescript
realtimeApiUrl: process.env.OPENAI_REALTIME_API_URL ?? "https://yunwu.ai/v1/realtime",
realtimeModel: process.env.OPENAI_REALTIME_MODEL ?? "gpt-4o-realtime-preview",
```

> 同步更新 `.env.example`，禁止在文档中硬编码真实 Key。

### 2.2 新模块 — `apps/server/src/modules/realtime/`

| 文件                                  | 用途                           |
| ------------------------------------- | ------------------------------ |
| `realtime.module.ts`                  | NestJS 模块定义                |
| `realtime.controller.ts`              | REST 端点                      |
| `realtime.service.ts`                 | Realtime 记录保存               |
| `realtime.ws.ts`                      | WebSocket 代理                  |
| `dto/save-realtime-transcript.dto.ts` | 保存记录请求验证               |

**端点：**

> 说明：旧的 `/api/realtime/offer` 已弃用（Yunwu 不支持），仅保留历史兼容。

1. `WS /api/realtime/ws` — 代理 WebSocket
   - **参数**：`?conversationId=&voice=&accessToken=`
   - 服务端根据 `conversationId` 拉取会话，生成 system prompt + locale + target language
   - 服务端使用 API Key 连接 Yunwu Realtime（`wss://.../v1/realtime?model=...`）
   - 服务端发送 `session.update`（instructions / voice / turn_detection）
   - **权限**：校验 conversation 所属用户（游客只允许自己的本地会话）
   - **限流**：按 `userId/ip + conversationId` 做简单频控，避免滥用
   - **时长**：游客默认 3 分钟，登录用户默认 15 分钟

2. `POST /api/realtime/transcript` — 保存对话记录
   - 接收 `{ conversationId, messages: [{ role, text, timestamp }] }`
   - **仅存完成转写**（不存 partial）
   - 通过 `ConversationService` 构建 `ConversationMessage` 并持久化
   - 统一消息结构：`sender / language / senderName / avatar / meta`
   - 可选：写入 `meta.source = "realtime"` 方便后续分析

### 2.3 实时系统提示词 — `apps/server/src/common/config/prompt.config.ts`

新增 `buildRealtimeSystemPrompt()`，比现有 chat prompt 更简洁（无 JSON schema），专注口语对话：

- 主要使用目标语言对话
- 学习者困难时简短切换母语鼓励
- 保持简洁口语化
- 自然地纠正发音和语法

> 生成 prompt 时必须基于现有会话的 `targetLanguage / nativeLanguage / scenario`，避免前端自拼导致不一致。

### 2.4 模块注册 — `apps/server/src/app.module.ts`

将 `RealtimeModule` 加入 imports 数组。

---

## 3. Frontend Architecture / 前端架构

### 3.1 新文件

```
apps/web/src/
  components/immersive/
    ImmersiveMode.tsx          -- 全屏沉浸式容器
    AudioOrb.tsx               -- 渐变动画圆球（音频可视化）
    TranscriptSubtitles.tsx    -- 实时字幕显示
    ImmersiveControls.tsx      -- 静音、结束、设置按钮
  hooks/
    useRealtimeSession.ts      -- WebSocket 连接管理 Hook
  services/
    realtimeService.ts         -- Realtime API 调用
  types/
    realtime.ts                -- Realtime 事件类型定义
```

### 3.2 修改文件

| 文件                   | 变更                                                       |
| ---------------------- | ---------------------------------------------------------- |
| `ChatModeSwitcher.tsx` | 将 immersive `disabled: true` 改为 `false`                 |
| `ConversationPage.tsx` | 用 `chatMode === "immersive"` 作为唯一沉浸状态源           |
| `LocaleContext.tsx`    | 新增 immersive 相关 i18n 键                                |
| `constants/ui.ts`      | 新增 realtime voice 选项常量                               |
| `types/api.ts`         | 新增 realtime session 类型                                 |
| `index.css`            | 新增 orb 动画 keyframes                                    |

### 3.3 核心 Hook — `useRealtimeSession`

管理完整 WebSocket 生命周期：

```typescript
interface UseRealtimeSessionReturn {
  status:
    | "idle"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "ended"
    | "error";
  isMuted: boolean;
  isAiSpeaking: boolean;
  userTranscript: string; // 当前用户语音（进行中）
  aiTranscript: string; // 当前 AI 语音（进行中）
  fullTranscript: TranscriptEntry[];
  audioLevel: number; // 0-1，驱动圆球动画
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  lastError?: string; // 方便 UI 展示与埋点
}
```

### 3.4 WebSocket 连接流程

1. 建立 WebSocket `ws://<host>/api/realtime/ws`
2. `getUserMedia` 获取麦克风，创建 `AudioContext`（24k PCM16）
3. 前端做轻量 VAD（静音阈值），将语音段编码为 base64 PCM16
4. 语音段发送 `input_audio_buffer.append`，静音后发送 `input_audio_buffer.commit` + `response.create`
5. 通过 WS 接收事件：
   - `conversation.item.input_audio_transcription.completed` → 用户转写
   - `response.audio_transcript.delta` → AI 实时字幕
   - `response.audio.delta` → AI 音频输出（播放）
6. 会话结束时保存记录到后端

### 3.5 状态统一与资源释放

- **状态源**：只使用 `chatMode` 控制沉浸模式 UI，避免 `isImmersiveMode` 与 `chatMode` 冲突
- **资源释放**：`WebSocket / MediaStream / AudioContext` 在 `disconnect` 中全部关闭
- **可见性处理**：页面隐藏时先静音，超过 30s 自动断开；回到前台可一键重连

### 3.6 WebSocket 兼容与设备策略

- **浏览器限制**：浏览器 WebSocket 无法自定义 Header（Authorization），必须由后端代理
- **音频编码**：统一 PCM16 24k，前端需做采样率对齐与 base64 编码
- **自动播放**：AI 音频播放需用户手势触发 AudioContext
- **并发会话**：同会话仅允许一个连接；新连接建立时关闭旧连接

---

## 4. UI/UX Design / 界面设计

### 4.1 布局

```
+--------------------------------------------------+
|  [X 退出]                          [设置]         |  ← 顶栏
|                                                    |
|                    +---------+                     |
|                   /  渐变圆球  \                    |
|                  |  (脉动动画)  |                   |  ← AudioOrb
|                   \           /                    |
|                    +---------+                     |
|              "AI 正在聆听..."                       |  ← 状态文字
|                                                    |
|  ┌──────────────────────────────────────────────┐  |
|  │  你: 你好，我想练习粤语                        │  |  ← 实时字幕
|  │  AI: 好呀！你想聊咩话题呢？                    │  |    (最近 3-4 条)
|  └──────────────────────────────────────────────┘  |
|        [静音]        [结束通话]        [...]       |  ← 控制栏
+--------------------------------------------------+
```

### 4.2 AudioOrb 设计

- **尺寸**: 160px (mobile) / 200px (desktop)
- **渐变**: indigo-500 → purple-500 → pink-500（匹配 app 主题）
- **Phase 1（简化版）**：
  - 连接中：轻微脉动 + 文案“连接中…”
  - 已连接：圆球大小随 audioLevel 变化
  - AI 说话：颜色轻微变化（不做旋转）
- **Phase 5（增强版）**：加入旋转/光晕等高级动画
- 使用 inline style 由 `audioLevel` (0-1) 驱动 transform 和 box-shadow

### 4.3 TranscriptSubtitles

- 显示最近 3-4 条转写记录
- 用户消息右对齐，AI 消息左对齐
- 进行中的文字带闪烁光标效果
- 使用 `motion/react`（项目已有）做平滑进出动画

### 4.4 ImmersiveControls

- **静音/取消静音** — `Mic` / `MicOff` 图标
- **结束通话** — 红色按钮，`PhoneOff` 图标
- **设置** — 语音选择弹窗，`Settings` 图标

### 4.5 可访问性与可用性

- 遵循 `prefers-reduced-motion` 关闭过度动画
- 控制按钮具备 `aria-label`，支持键盘操作
- 弱网提示与重连状态明确可见
- 视觉风格与当前玻璃态组件一致（颜色/圆角/阴影/字体）

---

## 5. Error Handling / 错误处理

| 场景              | 处理方式                                   |
| ----------------- | ------------------------------------------ |
| WS 连接失败       | 显示错误 toast，留在当前模式               |
| WebSocket 连接失败 | 重试一次（指数退避），失败则显示错误       |
| 连接中断          | 显示"重新连接"状态，重新建立 WS 连接       |
| 重连失败          | 保存已有记录，退出到普通模式               |
| 浏览器不支持      | 检测 `WebSocket`，不支持则禁用按钮 |
| 麦克风权限拒绝    | 复用现有 voice mode 的权限处理逻辑         |
| AI 说话时用户打断 | Realtime API 原生 VAD 处理，自动中断 AI    |
| 429 限流          | 指数退避重试一次，提示用户稍后再试         |
| 多标签并发        | 仅保留最后一个连接，其余连接断开并提示     |

### 5.1 数据一致性策略

- **保存时机**：只在 `completed` 事件时落库，避免脏数据
- **意外断线**：前端缓存 `fullTranscript`，重连成功后补偿提交
- **写入失败**：重试一次，仍失败时提示用户可稍后在文本模式继续
- **不做评分/翻译**：Realtime 模式不生成 `pronunciationTip/score/translation`

---

## 6. Implementation Phases / 实施阶段

### Phase 1: Backend 基础

1. `env.config.ts` 添加 `realtimeApiUrl` 与 `realtimeModel`
2. 创建 `RealtimeModule`（controller + service + DTOs）
3. `prompt.config.ts` 添加 `buildRealtimeSystemPrompt`
4. 注册模块到 `app.module.ts`
5. 增加 WS 频控与权限校验

### Phase 2: Frontend 核心连接

1. 创建 `realtimeService.ts`（API 调用）
2. 创建 `types/realtime.ts`（类型定义）
3. 实现 `useRealtimeSession` Hook（WebSocket 全流程）
4. 统一 `chatMode` 状态驱动沉浸模式

### Phase 3: UI 组件

1. 创建 `AudioOrb.tsx`（简化动画圆球）
2. 创建 `TranscriptSubtitles.tsx`（实时字幕）
3. 创建 `ImmersiveControls.tsx`（控制按钮）
4. 创建 `ImmersiveMode.tsx`（组合容器）
5. 添加 CSS 动画到 `index.css`

### Phase 4: 集成

1. `ChatModeSwitcher.tsx` 启用 immersive 按钮
2. `ConversationPage.tsx` 替换占位 UI
3. `LocaleContext.tsx` 添加 i18n 键
4. 会话结束时保存记录到 conversation 系统

### Phase 5: 打磨

1. 错误处理和重连逻辑
2. 浏览器兼容性检测
3. 移动端适配
4. 更新 `docs/log.md`
5. AudioOrb 高级动画与光效优化

---

## 7. 风险与对策 / Risks & Mitigations

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| 沉浸状态与聊天模式冲突 | UI 无法进入或卡死 | 单一状态源（`chatMode`）驱动沉浸模式 |
| 转写数据结构不一致 | 历史/评分/翻译异常 | 统一通过 `ConversationService` 落库 |
| 断线导致对话丢失 | 用户体验下降 | completed 才落库 + 前端缓存补偿提交 |
| WS 滥用 | 成本与安全风险 | 基于 userId/ip 频控 + 会话绑定 |
| 资源泄漏 | 移动端发热/耗电 | 严格 teardown + 可见性策略 |
| ICE/网络穿透失败 | 连接率下降 | 预留 TURN 配置或使用 Yunwu ICE |
| 多标签并发 | 音频冲突/卡顿 | 单连接策略 + 明确提示 |

---

## 8. Verification / 验证方式

1. **后端**: 启动服务器，`WS /api/realtime/ws` 可成功建立连接
2. **前端连接**: 点击 immersive 模式，应看到圆球动画和"连接中"状态
3. **语音对话**: 说话后应听到 AI 实时回复，字幕同步显示
4. **会话保存**: 结束通话后，对话记录应出现在聊天历史中
5. **错误恢复**: 断网后应显示重连状态，恢复后继续对话
6. **浏览器检测**: 在不支持 WebSocket 的环境中，immersive 按钮应保持禁用
7. **内存/资源**: 结束通话后麦克风灯熄灭、AudioContext 释放
