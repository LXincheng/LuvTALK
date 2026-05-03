# LuvTALK 模型服务方案

> 更新时间：2026-05-03

## 1. 结论

| 项目 | 结论 |
| --- | --- |
| 是否可直接只用一个 `qwen3.5-omni` 覆盖全系统 | **不可以** |
| 主要原因 | `realtime` 与非实时 Omni 是不同模型；普通 Omni 要求 `stream=true`；`Qwen3.5-Omni` 官方标注**不支持深度思考** |
| 当前建议 | 保持 **Qwen 分模块接入**：文本、翻译、STT、TTS 分开；`realtime` 单独升级到 `qwen3.5-omni-plus-realtime` |
| 最后一级兜底 | 保留 `deepseek-chat` |

## 1.1 当前配置原则

| 原则 | 说明 |
| --- | --- |
| 单一事实源 | 模型路由只看根目录 `.env`；不要再维护重复 env 变量 |
| 严格串行回退 | 对话链路固定 `qwen3.6-plus -> qwen3.5-flash -> deepseek-chat`，逐级超时，不竞争返回 |
| 音色服务端收口 | 音色目录由服务端 `voice-config` 提供，前端不再维护独立 `TTS_VOICE_*` 配置 |
| 混合语言识别 | STT 不强制指定单一识别语言，兼容英语、普通话、粤语混说 |
| Scenario 角色约束 | 场景 prompt 统一由服务端 scenario 配置生成，强调角色扮演、任务推进与收尾条件 |

## 2. 官方调研结论

### 2.1 为什么不能直接收口成一个模型

| 需求 | 官方能力情况 | 结论 |
| --- | --- | --- |
| 普通文本/图像/音频/视频理解 | `qwen3.5-omni-plus` 支持 | 可覆盖 |
| 实时音视频对话 | 使用 `qwen3.5-omni-plus-realtime` | 已作为 immersive 主链路 |
| 深度思考 | `Qwen3.5-Omni` 官方表中为“不支持” | **不能满足当前深度思考按钮需求** |
| 非流式 JSON 接口 | `Qwen3.5-Omni` 官方要求 `stream` 必须为 `true` | **与当前大量非流式接口不兼容** |
| 独立 STT/TTS 服务 | Omni 家族偏“多模态对话一体化”；当前系统是独立 STT、TTS、Report、Culture 服务 | 需要协议级重构 |

### 2.2 对当前系统的直接影响

| 模块 | 当前实现方式 | 若切到单一 Omni 的改动面 |
| --- | --- | --- |
| `conversation` | 非流式 `chat.completions` + JSON 输出 | 需要改为流式消费与增量解析 |
| `report` | 非流式结构化 JSON 报告 | 需要重做流式聚合与超时策略 |
| `translation` | 独立短文本翻译服务 | 需要改成 Omni 多模态对话式调用 |
| `culture` | 独立卡片生成服务 | 需要重做流式 JSON 聚合 |
| `stt` | 独立 ASR 服务 | 可被 Omni 替代，但当前接口要重构 |
| `tts` | 独立 TTS 文件生成服务 | 可被 Omni 部分替代，但音色/文件流策略要重构 |
| `realtime` | 单独 WS 协议 | 仍然需要单独 `realtime` 模型与协议适配 |

## 3. 当前保留方案

| 模块 | 当前模型 | 状态 | 备注 |
| --- | --- | --- | --- |
| 普通聊天 / 场景对话 | `qwen3.6-plus` → `qwen3.5-flash` → `deepseek-chat` | 已接入、已实测 | 默认开启 session 上下文；严格串行超时回退，不再竞争返回 |
| 场景反馈 | `qwen3.5-flash` → `qwen3.5-plus` → `deepseek-chat` | 已接入、已实测 | 轻量快反馈 |
| 报告 | `qwen3.6-plus` → `qwen3.5-flash` → `deepseek-chat` | 已接入、已实测 | 默认关闭深度思考，保持结果稳定 |
| 翻译 | `qwen-mt-flash` | 已接入、已实测 | 已按官方兼容格式修正请求体 |
| 文化卡片 | `qwen3.5-flash` | 已接入、已实测 | 保留本地兜底 |
| STT | `qwen3-asr-flash` | 已接入、已实测 | 混合语言语音默认不再强绑单一语言，避免英文/普通话/粤语夹杂时误识别 |
| TTS | `qwen3-tts-instruct-flash`，`Jennifer / Aiden / Kiki / Rocky` 自动走 `qwen3-tts-flash` | 已接入、已实测 | 英文/普通话/粤语均已跑通；音色由服务端 `voice-config` 单点下发 |
| Chat 图像理解 | `qwen3.6-plus`（主） → `qwen3.5-flash`（补位） | 已接入、已实测 | 支持图片上传、预览、识别与语言教学解释 |
| Realtime | `qwen3.5-omni-plus-realtime` | 已接入、已完成上游音频烟测 | 使用官方 WS 协议、`server_vad` 与 session 内字幕转写 |

## 3.3 Scenario 当前规则

| 项目 | 当前要求 |
| --- | --- |
| 主回复 | 保持目标语言，不把母语提示塞进场景主回复 |
| 角色感 | AI 先是场景角色，再是教学者 |
| 反馈输入 | 报告与评分尽量基于整段场景对话，而不是只看尾部片段 |
| 英语模式 | 前端消息气泡不再额外显示中文翻译，避免干扰沉浸感 |

## 3.1 当前推荐 `.env` 路由

> 文本、翻译、STT、TTS 继续走已经验证过的分模块方案，不要再在代码里写第二套路由规则。

| 变量 | 推荐值 | 用途 |
| --- | --- | --- |
| `PRIMARY_MODEL` | `qwen3.6-plus` | 主聊天 / 主报告模型 |
| `SECONDARY_MODEL` | `qwen3.5-flash` | 快速补位与轻量回退 |
| `THIRD_MODEL` | `deepseek-chat` | 最后一级兜底 |
| `STT_MODEL` | `qwen3-asr-flash` | 语音识别 |
| `TTS_MODEL` | `qwen3-tts-instruct-flash` | 语音合成 |
| `REALTIME_MODEL` | `qwen3.5-omni-plus-realtime` | 沉浸模式实时语音对话 |
| `TRANSLATION_MODEL` | `qwen-mt-flash` | 翻译 |

> Realtime 字幕不再通过额外 `REALTIME_TRANSCRIBE_MODEL` 配置；当前在同一条 session 内启用官方 `input_audio_transcription.model = qwen3-asr-flash-realtime`，避免双链路 ASR 带来的重连、卡顿和状态竞争。

## 3.2 官方音色映射

| 语言 | 默认音色 | 推荐候选 |
| --- | --- | --- |
| 普通话 | `Serena` | `Serena, Ethan` |
| 粤语 | `Kiki` | `Kiki, Rocky` |
| 英语 | `Jennifer` | `Jennifer, Aiden` |

> 现在以服务端固定映射为唯一音色事实源。英语已移除用户反馈不自然的 `Cherry`；聊天页只展示当前学习语言下的两种自然音色，并用简短特征词按钮展示；场景页不再提供音色切换。

## 3.2.1 Realtime 专用音色映射

| 语言 | 默认音色 | 推荐候选 |
| --- | --- | --- |
| 普通话 | `Serena` | `Serena, Ethan` |
| 粤语 | `Rocky` | `Rocky, Wil` |
| 英语 | `Aiden` | `Aiden, Jennifer` |

> `Kiki` 可继续作为普通 TTS 粤语音色，但在 `qwen3.5-omni-plus-realtime` 生成阶段会返回 `Voice 'Kiki' is not supported`，所以 immersive 不再展示或透传该音色。

## 4. 运行结论

### 4.1 2026-04-01 最新有效数据

| 模块 | 实测结果 | 耗时 |
| --- | --- | --- |
| `start_session` | 成功 | `517ms` |
| `chat_normal` | 成功 | `3672ms` |
| `translation` | 成功，返回 `Could I please have a cup of oat milk latte?` | `558ms` |
| `culture` | 成功，返回 `3` 张卡片 | `3210ms` |
| `scenario_feedback` | 成功 | `2254ms` |
| `report` | 成功 | `12582ms` |
| `tts_english` | 成功 | `1879ms` |
| `stt_english` | 成功，返回 `Hello. I would like a latte with oat milk, please.` | `12067ms` |
| `tts_mandarin` | 成功 | `1205ms` |
| `tts_cantonese` | 成功 | `979ms` |
| `stt_cantonese` | 成功，返回 `你好啊，今日我哋練習日常對話。` | `7239ms` |

## 5. 本轮关键修复

| 修复项 | 结果 |
| --- | --- |
| 非深度思考链路显式关闭 Qwen thinking | 降低无效推理开销 |
| STT 按官方 `qwen3-asr-flash` 兼容格式改写 | 语音识别恢复可用 |
| Translation 按官方 `qwen-mt-flash` 兼容格式改写 | 翻译恢复可用 |
| 删除游客报告 mock 数据 | 报告页不再混入假样本 |
| 聊天图片问答改走 `qwen3.6-plus` 视觉理解 | 图片识别、命名、读法、用法可直接教学 |
| 音色映射固定到服务端 | 避免英语出现普通话音色、普通话出现英语音色 |

## 6. 当前代码结论

| 项目 | 结论 |
| --- | --- |
| 是否现在切单一 Omni | **不建议** |
| 是否可以后续做成“单一 Omni 家族” | **可以评估**，但至少仍要区分 `qwen3.5-omni-plus` 与 `qwen3.5-omni-plus-realtime` |
| 当前最稳方案 | 非实时能力继续分模块；immersive 单独使用 `qwen3.5-omni-plus-realtime` |
| 下一步 | 若未来要上 Omni，单独做流式协议重构，不要在现有非流式接口上硬替换 |

## 7. 官方参考

- Qwen Omni 官方文档：<https://help.aliyun.com/zh/model-studio/qwen-omni>
- Realtime 官方文档：<https://help.aliyun.com/zh/model-studio/realtime>
- 百炼模型大全（含 `qwen3.6-plus`）：<https://help.aliyun.com/document_detail/2840914.html>
- Qwen ASR 官方文档：<https://help.aliyun.com/zh/model-studio/qwen-asr-api-reference>
- Qwen TTS 官方文档：<https://help.aliyun.com/zh/model-studio/qwen-tts>
- 机器翻译官方文档：<https://help.aliyun.com/zh/model-studio/user-guide/machine-translation>
