# LuvTALK Immersive Mode

> 更新时间：2026-04-02
> 当前状态：已接入百炼 realtime 主链路，本文只保留当前有效设计与实现结论。

## 1. 模式定位

`immersive mode` 的目标不是做“全屏 chat”，而是做一对一、不断流、低解释密度的实时口语陪练。

- 对话中优先保证短句、自然、连续。
- 页面重心始终是实时状态、中央 live orb 和字幕，而不是教学卡片。

## 2. 当前模型与链路

### 2.1 主实时模型

- 主模型：`qwen3-omni-flash-realtime`
- 当前不使用 `omni 3.5 realtime` 系列，避免邀测模型进入正式链路。

### 2.2 当前字幕来源

当前 immersive 字幕**默认走 realtime 主模型事件本身**，不是独立 ASR 双通道。

- 用户字幕：读取 realtime 返回的 `conversation.item.input_audio_transcription.*`
- AI 字幕：读取 `response.audio_transcript.*` / `response.output_audio_transcript.*`
- 服务端仅在显式配置 `REALTIME_TRANSCRIBE_MODEL` 时，才会在 `session.update` 中附带 `input_audio_transcription.model`

这意味着：

- 默认情况下，字幕与主对话理解保持同一条链路，时延更短，链路更简单。
- 如果后续对复杂噪音环境下的字幕稳定性要求更高，再单独接 `qwen3-asr-flash-realtime` 做双通道字幕。
- 系统 prompt 已额外明确：按音频自动识别语种，逐字保留用户原语种，不把英文口语改写或翻译成中文。

## 3. 当前实现结论

### 3.1 UI / UX

本轮 immersive 视觉收口到更接近 GPT / Gemini live 的方向，但保持项目自身的苹果式克制语言：

- 中央主视觉固定为一个圆球，不再做悬浮 3D 小球。
- 中心气泡收口为蓝色主题的流体渐变呼吸球，不再使用石墨核、厚重描边或 3D 质感。
- 连接态、说话态、等待态只保留最少文本提示，不堆解释性文案。
- 字幕区保留近几条实时句子，风格更轻，避免变成聊天气泡列表。

### 3.2 Realtime 性能与稳定性

当前主要做了四类收口：

| 项目 | 当前策略 |
| --- | --- |
| 字幕刷新 | 前端字幕节流从 `120ms` 收紧到 `80ms`，减少拖影感 |
| 音频切片 | 采集 buffer 从 `4096` 降到 `2048`，降低首响前等待 |
| 采集约束 | 浏览器麦克风启用 `echoCancellation / noiseSuppression / autoGainControl / mono` |
| 防打断 | 上游 `server_vad` 阈值提高，静音收尾时长缩短；前端继续在 AI 播放期间抑制回声回灌，并增加极低幅度 noise gate |

### 3.3 当前瓶颈判断

当前 immersive 不是“纯视觉问题”，还存在这几个现实边界：

| 维度 | 现状 | 结论 |
| --- | --- | --- |
| 字幕准确率 | 默认跟随 realtime 主链路 | 混语与普通噪音场景已够用，但极端复杂噪音下不如独立 ASR |
| 字幕延迟 | 已做 UI 节流和 buffer 收紧 | 仍会受上游事件节奏影响，无法完全做到本地字幕级瞬时 |
| 抢话 / 打断 | 已开启 `interrupt_response`，并做本地回声抑制 | 对“快速接话”有利，但需要更高 VAD 阈值避免环境声误触发 |
| 噪音扰动 | 已启用浏览器降噪 + 本地 noise gate + server VAD | 能明显减轻轻微环境声影响，但还不是“极端噪音完全免疫” |

## 4. 当前推荐设计语言

视觉方向固定为：

> 蓝色流体渐变呼吸球 + 克制字幕层 + 极简控制区

设计原则：

- 一个中心球体，永远是视觉锚点。
- 动效更像球体内部的液态流动和外层呼吸晕染，而不是火焰或粒子喷发。
- 白天模式偏雾蓝、冰蓝、透白高光；暗黑模式偏深蓝、钴蓝、电光蓝。
- 不使用脏阴影、厚边框、花哨说明文案。
- 当前 orb 已继续减重为“单核球体 + 极轻流体晕染”，尽量避免可见环线、厚重描边和脏感特效堆叠。

## 5. 后续仍值得做的事

当前链路已经可用，但如果要继续往“更稳的 live 产品”走，优先级如下：

1. 接入 `qwen3-asr-flash-realtime` 作为独立字幕通道，只负责用户字幕，不干扰主对话链路。
2. 增加更细的本地输入门限，例如连续静音窗口、噪音拒识窗口、短脉冲过滤。
3. 将字幕区进一步做成“当前一句更强、历史逐渐淡出”的真正 live transcript，而不是轻消息列表。
4. 如果后续接视频，只做低频抽帧输入，不把首版 immersive 做成完整视频通话产品。

## 6. 本轮更新摘要

- 修正 realtime 转写配置：默认不再隐式回退到 `STT_MODEL`。
- 收紧 realtime prompt，明确“自动识别语种，原语种保留，不翻译不改写用户语音”。
- 重做中央 orb：收口为更纯粹的蓝色流体渐变球 + 低振幅呼吸动画。
- 收紧字幕刷新与音频切片参数，降低体感延迟。
- 增加浏览器麦克风降噪、回声消除、自动增益和单声道约束。
- 上调 realtime `server_vad` 阈值并缩短静音提交窗口，在保持识别正确率的前提下尽量减少噪音误触发。

## 7. 官方参考

- 阿里云百炼 Realtime：<https://help.aliyun.com/zh/model-studio/realtime>
- 阿里云百炼模型大全：<https://help.aliyun.com/zh/model-studio/models>
- 阿里云百炼 ASR Realtime 客户端事件：<https://help.aliyun.com/zh/model-studio/qwen-asr-realtime-client-events>

> 备注：文档中凡涉及“防噪音扰动、不轻易打断导师”的描述，当前都应理解为系统级工程目标，而不是单一模型原生承诺。
