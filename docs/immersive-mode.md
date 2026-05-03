# LuvTALK Immersive Mode

> 更新时间：2026-05-03
> 当前状态：immersive 使用单一 `qwen3.5-omni-plus-realtime` 主链路，回复语言跟随实时语音链路自适应，并提供当前学习语言下的官方自然音色选择。

## 1. 模式定位

`immersive mode` 不是全屏聊天页，而是一条尽量短路径的实时口语链路：

- 用户开口后稳定被捕捉，不因为半句停顿就被导师抢答。
- omni 直接理解语音并返回导师回复。
- 前端只做必要的状态展示、字幕拼接和音频播放。

> 当前策略是不再额外挂第二个字幕模型，优先减少卡顿、重连和多状态机竞争。

## 2. 当前模型与字幕链路

### 2.1 主模型

- 主模型：`qwen3.5-omni-plus-realtime`
- turn detection：使用上游 `server_vad`
- session 中不再发送前端手动 `commit + response.create`，避免再造一层控制面

### 2.2 字幕来源

字幕直接消费 realtime 主链路事件：

- 用户字幕：`conversation.item.input_audio_transcription.*`
- AI 字幕：`response.audio_transcript.*` / `response.output_audio_transcript.*`

这代表当前实现遵循“一个会话完成识别、理解、回复”的主线，不再默认挂载独立 ASR WebSocket。用户字幕通过 session 内 `input_audio_transcription.model = qwen3-asr-flash-realtime` 开启。

## 3. 当前实现结论

### 3.1 灵敏度与稳定性

| 项目 | 当前策略 |
| --- | --- |
| 音频切片 | 前端采集 buffer 保持 `1024`，兼顾实时感与稳定性 |
| 字幕刷新 | 节流保持 `80ms`，优先保证实时感 |
| 采集约束 | 浏览器启用 `echoCancellation / noiseSuppression / autoGainControl / channelCount: 1` |
| 系统限制 | 不额外挂独立 ASR WebSocket，不再加本地 VAD 状态机，尽量减少系统层干预 |
| turn detection | 使用官方 `server_vad`，参数为 `threshold=0.5 / silence_duration_ms=900`，在不抢话和句尾响应之间取平衡 |
| 防打断 | 仅保留必要的播放抑制与真实转写长度阈值；前端不再在 `speech_started` 就立刻硬打断导师，只有收到足够长度的真实转写后才取消当前回复 |
| 音频上行 | Qwen3.5 Omni Realtime 输入按官方 16kHz / 16-bit / mono PCM 上行；前端不再用本地 noise gate 截断低音量/句尾静音帧 |
| 音色策略 | immersive 使用独立 Realtime 音色目录；普通话 `Serena/Ethan`、粤语 `Rocky/Wil`、英语 `Aiden/Jennifer`，不复用普通 TTS 的 `Kiki` |

### 3.2 UI / UX

当前 immersive 页面继续往更克制的 live room 方向收口：

- 中央保留单核流体 orb，增加更轻的呼吸与流动层，但去掉脏阴影和厚重描边。
- 字幕区做轻量 live transcript，不做聊天气泡堆叠，也不再叠加解释性提示小字。
- 控制区保留麦克风、字幕、官方音色、结束等核心操作，不再提供额外语言切换按钮。
- 文案尽量短，不在主界面堆教学解释。

> 当前实现判断：omni realtime 仍然需要音频输出音色参数，因此没有完全删除 `voice`；但 immersive 已收敛为系统自动管理，不再给用户一个会打乱体验的手动入口。

## 4. 当前边界判断

| 维度 | 现状 | 结论 |
| --- | --- | --- |
| 字幕准确率 | 跟随 omni 主链路 | 足够简单直接，但最终上限仍受 realtime 返回质量影响 |
| 首句响应 | 通过更小 buffer 和更少前端控制改善 | 体感已更灵敏，但仍依赖上游事件节奏 |
| 重连稳定性 | 去掉额外字幕模型后更简单 | 能明显减少反复重连和双链路竞争 |
| 极端噪音 | 主要靠浏览器采集约束与上游 `server_vad` | 可减轻干扰，但不是强噪音专用 ASR 产品 |

## 5. 生命周期埋点

为排查“已显示 connected 但首响仍慢”的偶发卡顿，当前链路新增两层量化观测：

- 前端本地调试：`useRealtimeSession` 会记录 `wsOpenMs / audioCaptureReadyMs / sessionReadyMs / firstUserTranscriptMs / firstAiTranscriptMs / firstAiAudioMs`，开发态输出到浏览器 console，并缓存到 `window.__luvtalkRealtimeDebug`。
- 服务端聚合：`GET /api/realtime/metrics` 新增 `lifecycleDurationMs` 聚合字段，统计：
  - `acceptedToUpstreamOpen`
  - `acceptedToSessionReady`
  - `acceptedToFirstClientAudio`
  - `acceptedToSpeechStarted`
  - `acceptedToSpeechStopped`
  - `acceptedToResponseCreated`
  - `acceptedToFirstUserTranscript`
  - `acceptedToFirstAiTranscript`
  - `acceptedToFirstAiAudio`

当前代码复盘得到的第一结论：

- 之前前端在 `WebSocket.onopen + startAudioCapture()` 成功后就把状态切到 `connected`，这会早于 `session.created/session.updated`。
- 同时 turn detection 曾使用 `0.58 / 480 / 900` 的更保守参数，本身就会把首个可响应窗口再向后推。
- 因此“connected 先出现，但还要等一段时间才能真正稳定输出”并不一定是网络卡顿，也可能是状态语义过早叠加保守 VAD 造成的体感延迟。

### 5.1 当前真实样本

基于 2026-04-05 01:14 的一条真实 immersive 日志，当前量化结果如下：

| 阶段 | 耗时 |
| --- | --- |
| `accepted -> upstream connected` | `234ms` |
| `accepted -> session ready` | `244ms` |
| `accepted -> first client audio` | `1122ms` |
| `accepted -> first AI transcript` | `2924ms` |
| `accepted -> first user transcript` | `2995ms` |
| `accepted -> first AI audio` | `3191ms` |

从这组数据可以先得到两个结论：

1. 握手不是主瓶颈。
当前上游连接和 session ready 都在 `250ms` 内，说明 WS 建连和上游 session 初始化是健康的。

2. 慢点主要在 turn handoff，而不是模型开口。
`first user transcript -> first AI audio` 只有约 `196ms`，说明模型生成和音频首包都不慢；真正拖长体感的是 `first client audio -> first user transcript` 这一段，也就是用户说话结束、VAD 判定、转写稳定和回复触发之间的窗口。

基于 2026-04-05 01:18 的第二条真实 immersive 日志，新的量化结果如下：

| 阶段 | 耗时 |
| --- | --- |
| `accepted -> upstream connected` | `993ms` |
| `accepted -> session ready` | `1000ms` |
| `accepted -> first client audio` | `1313ms` |
| `accepted -> first user transcript` | `3274ms` |
| `accepted -> first AI transcript` | `3285ms` |
| `accepted -> first AI audio` | `3544ms` |

与上一条样本相比：

- 握手阶段从 `234ms / 244ms` 上升到 `993ms / 1000ms`，说明上游网络或当时服务端调度存在波动。
- `first client audio -> first user transcript` 仍然是最长的一段，从约 `1873ms` 增加到约 `1961ms`，继续指向 turn handoff，而不是模型生成。
- `first user transcript -> first AI audio` 约 `270ms`，依然不算慢，说明“AI 真正开始说话”本身不是当前主瓶颈。

因此当前结论更新为：

1. 连接阶段存在波动，但不是唯一主因。
第二条样本说明上游握手并非总能稳定在 `250ms` 内，不过即使握手变慢，最大的时间仍然落在 handoff 段。

2. 英语切粤语场景下，时序竞争更像“交接 + 音色更新重叠”，不是“模型不会切语种”。
这也是为什么本轮把音色自适应前移到转写增量事件，而不是继续等完整文本。

### 5.2 本轮针对性优化

- Realtime 主模型切到 `qwen3.5-omni-plus-realtime`，turn detection 使用官方 `server_vad`。
- 字幕在同一条 session 内启用 `qwen3-asr-flash-realtime`，不再维护额外 `REALTIME_TRANSCRIBE_MODEL`。
- 前端输入音频按官方要求重采样到 16kHz，输出播放保持 24kHz；同时不再用本地 noise gate 截断句尾静音帧。
- 粤语 immersive 音色从普通 TTS 的 `Kiki` 切到 Realtime 已验证可用的 `Rocky/Wil`，避免上游生成阶段 400 后循环重连。
- 前端 connected 状态继续保持“`audio capture ready + session ready` 双条件”才能亮起，避免把还在等待 VAD / 转写的阶段误呈现为已经随时可响应。

### 5.3 当前局限性

- 这组数据仍然无法单独拆出“用户真实说话时长”，因此 `first client audio -> first user transcript` 里既包含模型等待，也包含用户自己正在说话的时长。
- 在本轮补充埋点之前，没有单独记录 `speech_stopped -> response.created` 的耗时；新版本上线后，下一轮日志才可以把“VAD 收口时间”和“上游生成启动时间”继续拆细。
- 音色自适应仍依赖实时转写事件，而不是直接读取音频语种标签；这已经比等完整文本更快，但还不是完全零延迟。

## 6. 后续优化方向

1. 继续调优单链路字幕拼接与事件去抖，优先把“字幕怪异感”压下去。
2. 让字幕层更像 live transcript：当前句更亮，历史更轻，过渡更柔和。
3. 继续优化多语种自动音色策略，必要时再引入更细的语言脚本识别。
4. 继续观察快速重连场景，避免前端短时重挂载被服务端冷却策略误伤。
5. 只有在单链路被验证无法满足需求时，才重新评估是否引入额外字幕模型。

## 7. 本轮收口

- 聊天主模型切到 `qwen3.6-plus`，与最新官方模型表保持一致。
- immersive 删除语言切换按钮，改为按实时语音内容自适应回复语言，并允许用户选择当前语言的官方音色。
- realtime 主模型切到 `qwen3.5-omni-plus-realtime`，turn detection 使用官方 `server_vad`。
- 前端持续发送句尾静音帧给上游，避免本地 noise gate 让模型误以为用户还没完成一轮输入。
- 前端只在真实转写达到最小长度后才中断导师回复，避免噪音或吸气触发误打断。
- 前端只有在 `audio capture ready + session ready` 同时满足后才显示真正可说话状态，不再过早显示 connected。
- 音色自适应前移到转写增量阶段，减少英语切粤语时还沿用旧音色的窗口。
- 英语默认 immersive 音色切换到 `Aiden`，优先走更克制自然的官方英语音色。
- 新增 immersive 生命周期量化埋点，前端本地和服务端聚合都能看见每一阶段耗时。
- 页面视觉继续减重，降低脏阴影，强化单球呼吸与流体层次。

## 8. 官方参考

- 阿里云百炼 Realtime：<https://help.aliyun.com/zh/model-studio/realtime>
- 阿里云百炼模型大全：<https://help.aliyun.com/document_detail/2840914.html>

> 备注：当前文档只记录现网主链路，不再把独立 ASR 双通道写成默认方案。
