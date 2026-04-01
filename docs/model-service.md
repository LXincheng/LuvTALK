# LuvTALK 模型服务方案

> 更新时间：2026-04-01
> 结论先行：**当前不建议把全系统直接收口为单一 `qwen3.5-omni` 模型 ID。**

## 1. 结论

| 项目 | 结论 |
| --- | --- |
| 是否可直接只用一个 `qwen3.5-omni` 覆盖全系统 | **不可以** |
| 主要原因 | `realtime` 与非实时 Omni 是不同模型；普通 Omni 要求 `stream=true`；`Qwen3.5-Omni` 官方标注**不支持深度思考** |
| 当前建议 | 保持 **Qwen 分模块接入**：文本、翻译、STT、TTS 分开，`realtime` 暂不改 |
| 最后一级兜底 | 保留 `deepseek-chat` |

## 2. 官方调研结论

### 2.1 为什么不能直接收口成一个模型

| 需求 | 官方能力情况 | 结论 |
| --- | --- | --- |
| 普通文本/图像/音频/视频理解 | `qwen3.5-omni-plus` 支持 | 可覆盖 |
| 实时音视频对话 | 使用 `qwen3.5-omni-plus-realtime` | **不是同一个模型 ID** |
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
| 普通聊天 / 场景对话 | `qwen3.5-plus` → `qwen3.5-flash` → `deepseek-chat` | 已接入、已实测 | 默认开启 session 上下文，支持深度思考开关 |
| 场景反馈 | `qwen3.5-flash` → `qwen3.5-plus` → `deepseek-chat` | 已接入、已实测 | 轻量快反馈 |
| 报告 | `qwen3.5-plus` → `qwen3.5-flash` → `deepseek-chat` | 已接入、已实测 | 深度思考开启时优先走 `plus` |
| 翻译 | `qwen-mt-flash` | 已接入、已实测 | 已按官方兼容格式修正请求体 |
| 文化卡片 | `qwen3.5-flash` | 已接入、已实测 | 保留本地兜底 |
| STT | `qwen3-asr-flash` | 已接入、已实测 | 已按官方 ASR 兼容格式修正 |
| TTS | `qwen3-tts-instruct-flash`，粤语音色自动走 `qwen3-tts-flash` | 已接入、已实测 | 英文/普通话/粤语均已跑通 |
| Realtime | 现有方案保留 | **本轮不改** | 不迁到 Omni Realtime |

## 4. 当前实测数据

### 4.1 2026-04-01 最新有效数据

| 模块 | 实测结果 | 耗时 |
| --- | --- | --- |
| `start_session` | 成功 | `517ms` |
| `chat_normal` | 成功 | `3672ms` |
| `enable_deep_thinking` | 成功 | `332ms` |
| `chat_deep` | 成功 | `7007ms` |
| `translation` | 成功，返回 `Could I please have a cup of oat milk latte?` | `558ms` |
| `culture` | 成功，返回 `3` 张卡片 | `3210ms` |
| `scenario_feedback` | 成功 | `2254ms` |
| `report` | 成功 | `12582ms` |
| `tts_english` | 成功 | `1879ms` |
| `stt_english` | 成功，返回 `Hello. I would like a latte with oat milk, please.` | `12067ms` |
| `tts_mandarin` | 成功 | `1205ms` |
| `tts_cantonese` | 成功 | `979ms` |
| `stt_cantonese` | 成功，返回 `你好啊，今日我哋練習日常對話。` | `7239ms` |

### 4.2 与上一轮 fallback 数据对比

| 模块 | 旧结果（API Key 无效 / fallback） | 新结果（已修正并实测） | 结论 |
| --- | --- | --- | --- |
| Chat | 可返回，但主要走 fallback 内容 | `3672ms` 真 Qwen 回复 | 质量已恢复 |
| Translation | 保留原文 / 未真正翻译 | `558ms` 真翻译结果 | 已修复 |
| Culture | `13461ms`，本地卡片兜底 | `3210ms`，真实生成 | 明显改善 |
| Scenario Feedback | 本地兜底反馈 | `2254ms`，真实结构化反馈 | 已恢复 |
| Report | 本地兜底报告 | `12582ms`，真实报告 | 质量恢复，但耗时较高 |
| TTS | 失败 | 英文/普通话/粤语均成功 | 已恢复 |
| STT | `TRANSCRIPTION_FAILED` | 英文/粤语回读成功 | 已恢复 |

## 5. 本轮关键修复

| 修复项 | 结果 |
| --- | --- |
| 非深度思考链路显式关闭 Qwen thinking | 降低无效推理开销 |
| STT 按官方 `qwen3-asr-flash` 兼容格式改写 | 语音识别恢复可用 |
| Translation 按官方 `qwen-mt-flash` 兼容格式改写 | 翻译恢复可用 |
| 删除游客报告 mock 数据 | 报告页不再混入假样本 |

## 6. 当前代码结论

| 项目 | 结论 |
| --- | --- |
| 是否现在切单一 Omni | **不建议** |
| 是否可以后续做成“单一 Omni 家族” | **可以评估**，但至少仍要区分 `qwen3.5-omni-plus` 与 `qwen3.5-omni-plus-realtime` |
| 当前最稳方案 | 继续使用已验证的 Qwen 分模块方案 |
| 下一步最值得做 | 若未来要上 Omni，建议新开一轮“流式协议重构”，不要在现有非流式接口上硬替换 |

## 7. 官方参考

- Qwen Omni 官方文档：<https://help.aliyun.com/zh/model-studio/qwen-omni>
- Realtime 官方文档：<https://help.aliyun.com/zh/model-studio/realtime>
- Qwen ASR 官方文档：<https://help.aliyun.com/zh/model-studio/qwen-asr-api-reference>
- Qwen TTS 官方文档：<https://help.aliyun.com/zh/model-studio/qwen-tts>
- 机器翻译官方文档：<https://help.aliyun.com/zh/model-studio/user-guide/machine-translation>
