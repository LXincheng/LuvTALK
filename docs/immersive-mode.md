# LuvTALK Immersive Mode

> 更新时间：2026-04-04
> 当前状态：immersive 已回到单一 `qwen3-omni-flash-realtime` 主链路，字幕与回复都跟随同一 realtime 会话。

## 1. 模式定位

`immersive mode` 不是全屏聊天页，而是一条尽量短路径的实时口语链路：

- 用户开口后尽快被捕捉。
- omni 直接理解语音并返回导师回复。
- 前端只做必要的状态展示、字幕拼接和音频播放。

> 当前策略是不再额外挂第二个字幕模型，优先减少卡顿、重连和多状态机竞争。

## 2. 当前模型与字幕链路

### 2.1 主模型

- 主模型：`qwen3-omni-flash-realtime`
- turn detection：使用上游 `server_vad`
- session 中保持 `create_response: true`，避免前端手动 `commit + response.create` 再造一层控制面

### 2.2 字幕来源

字幕直接消费 realtime 主链路事件：

- 用户字幕：`conversation.item.input_audio_transcription.*`
- AI 字幕：`response.audio_transcript.*` / `response.output_audio_transcript.*`

这代表当前实现遵循“一个会话完成识别、理解、回复”的主线，不再默认挂载独立 ASR 通道。

## 3. 当前实现结论

### 3.1 灵敏度与稳定性

| 项目 | 当前策略 |
| --- | --- |
| 音频切片 | 前端采集 buffer 收紧到 `1024`，减少首句等待 |
| 字幕刷新 | 节流保持 `80ms`，优先保证实时感 |
| 采集约束 | 浏览器启用 `echoCancellation / noiseSuppression / autoGainControl / channelCount: 1` |
| 系统限制 | 移除本地额外 VAD 状态机与手动提交编排，尽量减少系统层干预 |
| 防打断 | 仅保留必要的播放抑制与 noise gate，避免回声回灌误触发 |

### 3.2 UI / UX

当前 immersive 页面继续往更克制的 live room 方向收口：

- 中央保留单核 orb，弱化厚阴影和装饰线框。
- 字幕区做轻量 live transcript，不做聊天气泡堆叠。
- 控制区只保留麦克风、字幕、结束、设置等核心操作。
- 文案尽量短，不在主界面堆教学解释。

## 4. 当前边界判断

| 维度 | 现状 | 结论 |
| --- | --- | --- |
| 字幕准确率 | 跟随 omni 主链路 | 足够简单直接，但最终上限仍受 realtime 返回质量影响 |
| 首句响应 | 通过更小 buffer 和更少前端控制改善 | 体感已更灵敏，但仍依赖上游事件节奏 |
| 重连稳定性 | 去掉额外字幕模型后更简单 | 能明显减少反复重连和双链路竞争 |
| 极端噪音 | 主要靠浏览器采集约束和轻量 noise gate | 可减轻干扰，但不是强噪音专用 ASR 产品 |

## 5. 后续优化方向

1. 继续调优单链路字幕拼接与事件去抖，优先把“字幕怪异感”压下去。
2. 让字幕层更像 live transcript：当前句更亮，历史更轻，过渡更柔和。
3. 继续简化 orb 和控制区的视觉重量，保持苹果式克制感。
4. 只有在单链路被验证无法满足需求时，才重新评估是否引入额外字幕模型。

## 6. 本轮收口

- 去掉默认独立字幕模型挂载，回到官方 realtime 主路径。
- 移除前端本地 `commit / response.create` 编排，减少多状态机竞争。
- 保留 omni 原生字幕事件作为 immersive 字幕来源。
- 页面视觉继续减重，降低阴影、模糊和厚描边。

## 7. 官方参考

- 阿里云百炼 Realtime：<https://help.aliyun.com/zh/model-studio/realtime>
- 阿里云百炼模型大全：<https://help.aliyun.com/zh/model-studio/models>

> 备注：当前文档只记录现网主链路，不再把独立 ASR 双通道写成默认方案。
