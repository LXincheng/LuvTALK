# LuvTALK 语音 Tutor 接入与 OpenAI 语音分析方案

## 1. 背景与现状
- Web 前端 `apps/web/src/pages/Conversation/index.tsx` 已具备完整的文本会话体验，`handleMicrophone` 目前仅切换 `isRecording` 并注入占位文案，尚未真正采集音频或上传。
- `useAppStore` 维持会话状态，依赖 `conversationService` 的 REST API 以及 `createConversationStream` SSE 推送，已经能够即时刷新消息列表。
- 后端 NestJS `ConversationService` 以 DeepSeek 模型生成文本回应，并通过 Prisma 缓存会话，尚无语音上传、语音分析或音频存储链路。
- `.env` 中已预留 `OPENAI_API_URL=https://codex-api-slb.packycode.com/v1` 与 `OPENAI_API_KEY=*`，具备对 OpenAI 兼容网关的访问前提。

> 综上，文本链路稳定，可复用现有的会话模块；语音链路需新增采集、上传、转写、分析、回传和音频播放的完整闭环。

## 2. 目标
1. 在 Web 端实现真人对话式的语音录制、状态提示与播放体验。
2. 通过后端安全地将音频流发送到仅支持 GPT‑5/GPT‑5.1 序列模型的 OpenAI 兼容接口（`base_url=https://codex-api-slb.packycode.com/v1`）进行转写与语音 Tutor 分析。
3. 在既有 `ConversationSession` 中追加语音来源的消息，保留文本内容、打分、评语以及可回放的音频 URL，呈现一对一语音问答效果。
4. 在 GPT‑5/GPT‑5.1 接口不可用时，自动降级回当前 DeepSeek（DS）文本模块，保证最小可用能力。
5. 确保链路具备可观测性、超时/降级策略以及后续扩展（如移动端、批改历史）的空间。

## 3. 总体架构
### 3.1 数据流（文字版）
```
用户麦克风
   ↓ (MediaRecorder/PCM)
Web 端语音 Recorder Hook
   ↓ (multipart/form-data | /conversation/:id/voice)
VoiceTutorController (Nest)
   ↓
VoiceTutorService
   ├─(可选) S3/OSS 存储音频，生成受保护 URL
   ├─调用 OpenAI STT:  base_url/audio/transcriptions
   ├─调用 OpenAI Responses: base_url/responses，生成 Tutor 反馈
   └─将文本输入 ConversationService.processMessage，维持统一的消息与 SSE
   ↓
Prisma 持久化 + session stream.next()
   ↓
前端 SSE 订阅 → 渲染文本、评分、语音播放 → TTS 回复（可选）
```

### 3.2 关键模块
- **前端语音采集层**：封装 `navigator.mediaDevices.getUserMedia` 与 `MediaRecorder`，输出 `audio/webm;codecs=opus` Blob，附带录音状态机、剩余时间、音量指示等。
- **上传与状态反馈**：采用 `AbortController` + `fetch` 上传 FormData，后台返回 `operationId`，前端通过 SSE 中的 `meta.processingStatus` 展示 “转写中 / 分析中 / 回复中”。
- **后端语音接口层**：新增 `VoiceTutorModule` 暴露 `POST /conversation/:conversationId/voice`，负责存储音频、鉴权与连通 ConversationService。
- **OpenAI 语音分析层**：使用两个调用（模型仅限 GPT‑5/GPT‑5.1 序列，例如 `gpt-5.1-mini-transcribe`、`gpt-5.1-mini`，具体以接口可用列表为准）：
- `POST {OPENAI_API_URL}/audio/transcriptions`（模型如 `gpt-5.1-mini-transcribe`）输出 `transcript`。
  - `POST {OPENAI_API_URL}/responses` 或 `/chat/completions`，携带系统 Prompt（模拟真人 Tutor）+ 用户转写文本，输出补全、纠错、文化小贴士、打分等结构化 JSON。
- **可选语音回复层**：若需要 AI 语音回答，可调用 `POST {OPENAI_API_URL}/audio/speech`（例如 `gpt-5.1-mini-tts`）生成音频文件，推送到前端播放。

## 4. 实施步骤
### 阶段 0：准备与依赖
- 确认 `OPENAI_API_URL=https://codex-api-slb.packycode.com/v1` 与 `OPENAI_API_KEY` 在 server 进程可读取，新增 `OPENAI_SPEECH_MODEL`, `OPENAI_TRANSCRIBE_MODEL`, `OPENAI_TUTOR_MODEL` 配置项。
- 在 Web 端安装 `recordrtc` 或自行实现 Hook，仅需浏览器原生 API，避免额外依赖。
- 选择音频持久化方案：
  1. **本地开发**：`/tmp/voice` + `express.static` 供短期访问。
  2. **生产**：推荐 S3/OSS（MinIO/Cloudflare R2）并配合一次性签名，URL 写入 `message.meta.audioUrl`。

### 阶段 1：后端语音入口
1. 新增 `VoiceTutorModule`（导入 `ConversationModule` 与 `PrismaModule`），暴露 `VoiceTutorController`.
2. `POST /conversation/:id/voice`：
   - 使用 `@UseInterceptors(FileInterceptor('audio', ...))` 支持 `webm|wav|m4a`，限制 2 分钟以内。
   - 解析 query/body（目标语言、是否需要 AI 语音回复等）。
   - 将文件保存到临时目录，生成 `storageKey`。
3. `VoiceTutorService.handleUpload`：
   - 生成 `operationId`，立即返回 `{ operationId, status: "received" }`，保持前端响应迅速。
   - 异步执行 `transcribe -> analyze -> respond` 并在各阶段通过 `sessionStreams` 推送状态：
     ```ts
     stream.next({
       ...session,
       meta: { processingStatus: "transcribing", operationId }
     });
     ```

### 阶段 2：OpenAI 调用与消息落库
1. **转写**：构建 `FormData`，附 `model`, `response_format: "verbose_json"`，将录音文件 Buffer 作为 `file`。若 GPT‑5 序列模型返回 5xx 或超时，立即进入 DS 降级流程（详见第 10 节）。
2. **Tutor 分析**：
   - 构造系统 Prompt，涵盖场景（`session.scenarioId`）、目标语言以及用户母语，要求输出 JSON：
     ```json
     {
       "reply": "...",
       "score": 0-100,
       "scoreReason": "...",
       "correction": "...",
       "cultureNote": "...",
       "associativePhrases": ["..."]
     }
     ```
   - 使用 `responses` API，`input` 数组包含 system+user+转写文本。
   - 若 GPT‑5/GPT‑5.1 请求失败，则将转写文本（若无转写结果，可退化为占位提示）转交当前 `ConversationService` 的 DS 模型 `requestDsAi`，复用原有逻辑产出回复、打分与文化提示，确保体验可落地。
3. **写入 Conversation**：
   - 将转写文本以 `sender=user` 的消息形式注入（附 `meta.audioUrl` 指向用户音频）。
   - 复用 `ConversationService.buildMessage` 生成 AI 消息，`meta.translation` 继续通过 `TranslationService`。
   - 若存在 AI 语音回答，将生成的音频 URL 放入 AI 消息 `meta.audioUrl`.
   - 调用 `persistSession` + `streamSession`，前端即可收到两条消息（用户转写 + AI 回复）。

### 阶段 3：Web 端体验
1. 抽离 `useVoiceRecorder` Hook：
   - 状态：`idle | recording | uploading | transcribing | analyzing | responding`.
   - 提供 `start`, `stop`, `cancel`，内部利用 `MediaRecorder`。
   - 将生成的 `Blob` 包装为 `File`，用 `FormData` 上传 `/conversation/${session.id}/voice`.
2. `ConversationPage` 调整：
   - 将 `isRecording` 改为 `recorder.state`.
   - 上传后把 `operationId` 缓存在本地映射中，基于 SSE 消息里的 `meta.operationId` 更新对应气泡的 loading 状态。
   - 当 `message.meta.audioUrl` 存在时，展示播放/下载按钮，使用 `<audio>` 或自定义组件。
   - 为 AI 消息新增 “听发音” 按钮；当 `meta.translation` 回到 UI 时保持既有布局。
3. 无障碍与多语言：
   - 录音按钮增加 `aria-live`，提示 “开始录音/录音结束/上传中”。
   - 所有提示文案写入 `LocaleProvider` 的字典文件，确保中/英 UI 均可使用。

### 阶段 4：质量保障
- **自动化测试**：
  - 单元：Mock fetch，验证 `VoiceTutorService` 能在 transcription/analysis 失败时抛出自定义异常。
  - 集成：为 `VoiceTutorController` 编写 e2e 测试，使用 `supertest` 上传 fixture 音频。
  - 前端：使用 Cypress 模拟 `navigator.mediaDevices`，断言录音流程状态切换。
- **观测**：
  - 在服务端为每个 `operationId` 记录耗时、OpenAI 请求 ID、失败原因，输出到 `Logger`.
  - Prometheus/Grafana 可跟踪 `voice_transcription_duration_seconds`.
- **降级策略**：
  - 任一阶段失败时 fallback 为文本输入提示（如提示用户改用键盘），并保留错误 toast。
  - 当 OpenAI 超时 >10s，可自动重试一次或切换到现有 DeepSeek 文本模型（仅缺少语音分析）。

## 5. API 设计
### 5.1 上传接口
```
POST /conversation/:conversationId/voice
Content-Type: multipart/form-data
Fields:
  - audio (File, 必填): audio/webm|audio/wav|audio/m4a
  - targetLanguage (可选): 默认沿用 session.targetLanguage
  - needAiSpeech (optional boolean)
Response 202:
{
  "operationId": "voice-op-1731916123",
  "status": "received"
}
```

### 5.2 SSE 状态扩展
- 在 `ConversationSession` 的 `messages` 之外，增加可选 `pendingVoice` 节点：
  ```json
  {
    "pendingVoice": {
      "operationId": "voice-op-1731916123",
      "status": "analyzing",
      "transcript": "（可选，供前端预览）"
    }
  }
  ```
- 一旦 AI 回复落库，清除该状态，前端即可移除 loading。

### 5.3 音频访问
- `GET /assets/voice/:key` 通过带签名的短链接或 JWT 鉴权返回二进制音频，或直接暴露对象存储 CDN URL（需设置过期策略）。

## 6. 配置与安全

## 7. 风险与应对
- **网络波动导致录音上传失败**：在前端加入自动重试（指数退避 2 次）与 “转为文本输入” 的 fallback CTA。
- **OpenAI 兼容网关变更**：封装 `OpenAIClient`，集中管理 `base_url` 及 `headers`，便于在 GPT‑5 序列不可用时快速切换备份节点或启动 DS 降级。
- **音频格式兼容性**：优先 webm/opus；iOS Safari 仍倾向 m4a/aac，可通过 `ffmpeg` 转码或请求 `MediaRecorder` 生成 `audio/mp4`。
- **隐私合规**：上传请求添加 `X-Session-Id`，在日志中脱敏 userId，仅保留散列。

## 8. 里程碑（建议）
| 周次 | 里程碑 | 产出 |
| --- | --- | --- |
| 第 1 周 | 语音 API 雏形 | 上传接口 + OpenAI 转写成功，SSE 推送状态 |
| 第 2 周 | Tutor 分析闭环 | 转写结果驱动 ConversationService，前端收到文本回复 |
| 第 3 周 | 语音播放体验 | Web 端录音/播放 UI、美化 loading、异常提示 |
| 第 4 周 | 可选语音回复 & QA | AI 语音播报、自动化测试、监控告警接入 |

## 9. 下一步建议
1. 按阶段建立跟踪 issue / PR，优先完成后端 API 以便前端对接。
2. 预先准备 2-3 段测试音频（英文/粤语/普通话）纳入 CI，以避免回归。
3. 若需要移动端/H5 内嵌，可复用该 API，只需补充 RN/Capacitor 的录音封装。

完成以上步骤后，即可在现有的文本会话基础上提供稳定、自然的一对一语音 Tutor 体验，并通过 GPT‑5/GPT‑5.1 语音能力获得实时分析与纠错；在高阶模型不可用时，系统仍可回落至 DeepSeek 文本方案保持可用性。

## 10. GPT‑5 限制与 DS 降级评估
- **支持范围**：`https://codex-api-slb.packycode.com/v1` 只接受 GPT‑5/GPT‑5.1 序列模型。需要在配置层强制校验，防止误用旧模型造成 4xx。
- **可行性**：当前 `ConversationService` 已内置 DeepSeek (`requestDsAi`) 流程，输入为纯文本；因此当语音链路无法得到 GPT‑5 分析结果时，只需保证转写阶段返回的文本（或用户原始音频附带的“请改用文本”提示）传递给 `requestDsAi` 即可。
- **实现方式**：
  1. `VoiceTutorService` 在调用 GPT‑5 失败后，记录错误并将 `analysisEngine` 标记为 `ds-fallback`。
  2. 将转写文本交给 `ConversationService.processMessage`，设置 `meta.analysisSource`，以便前端展示 “已自动使用 DeepSeek 生成回复” 的提示。
  3. SSE 推送中附带 `meta.analysisEngine`，使前端可在 UI 中渲染降级标识。
- **影响评估**：DS 回复已在现网场景验证，降级不会破坏既有体验；唯一差异是无法提供 GPT‑5 独占的语音纠错维度，可在消息 meta 中提示“当前为文本级反馈”。
- **测试建议**：新增集成测试模拟 GPT‑5 API 超时，断言服务端进入 DS 流程并成功返回消息；前端 Cypress 用 fixture 断开网络后检查 UI 提示。
