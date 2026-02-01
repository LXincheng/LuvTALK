# Phase 3 实施说明：每日复习联动 / 词汇卡片 / 高亮词汇

> 本文用于记录 Phase 3 的核心实现逻辑与扩展方案，便于后续维护与迭代。

## 总览

| 模块     | 目标                     | 关键产出                                       |
| -------- | ------------------------ | ---------------------------------------------- |
| 互动词汇 | 让 AI 回复自带可点击词汇 | `key_terms` → 消息 meta → 前端高亮 + 收藏      |
| 每日复习 | 汇总收藏与低分表达       | `/review/daily` 聚合 + `/review/feedback` 反馈 |
| 朗读支持 | 复习卡片一键发音         | 复用 `/conversation/:id/tts`                   |

## 后端实现逻辑

### 1) AI 词汇标注输出

| 位置                                                 | 改动            | 说明                                  |
| ---------------------------------------------------- | --------------- | ------------------------------------- |
| `apps/server/src/common/types/ai-response.schema.ts` | 新增 `keyTerms` | `term / definition / type / examples` |
| `apps/server/src/common/config/prompt.config.ts`     | 强化 prompt     | 约束 3-5 个词汇，且必须出现在 reply   |

### 2) 消息注解落库

| 位置                                                           | 改动                                | 说明                                      |
| -------------------------------------------------------------- | ----------------------------------- | ----------------------------------------- |
| `apps/server/src/common/types/conversation.types.ts`           | `ConversationMessage.meta.keyTerms` | 让前端消费结构化词汇                      |
| `apps/server/src/modules/conversation/conversation.service.ts` | 归一化与过滤                        | 仅保留 reply 中出现的词汇，去重、裁剪长度 |

### 3) 每日复习聚合

| 接口                    | 输入              | 输出                            |
| ----------------------- | ----------------- | ------------------------------- |
| `GET /review/daily`     | 无                | `cards` 数组（收藏 + 低分表达） |
| `POST /review/feedback` | `cardId + action` | `{ status: "ok" }`              |

聚合策略（MVP）：

- **收藏卡片**：直接映射 `FavoriteItem` 为复习卡片。
- **低分表达**：扫描会话消息，提取 `score < 60` 的用户表达 + AI 示例。
- 优先保留低分表达，再补齐收藏卡片（最多 10 张）。

## 前端实现逻辑

### 1) 高亮词汇 + 弹窗收藏

| 组件                | 输入          | 输出                   |
| ------------------- | ------------- | ---------------------- |
| `AnnotatedMessage`  | `annotations` | 虚线下划线 + Popover   |
| `VocabularyPopover` | 词汇详情      | 解释 + 例句 + 收藏按钮 |

数据来源：

- `ConversationMessage.meta.keyTerms` → `Annotation[]`
- 收藏时携带 `conversationId`，便于复习页复用 TTS

### 2) 每日复习页面联动

| 流程 | 说明                                          |
| ---- | --------------------------------------------- |
| 加载 | `GET /review/daily` 拉取卡片                  |
| 反馈 | `POST /review/feedback` 上报 `known/practice` |
| 朗读 | 复用 `/conversation/:id/tts` 合成语音         |

## 数据结构约定（简化版）

| 字段                        | 类型                 | 说明          |
| --------------------------- | -------------------- | ------------- |
| `ReviewCard.term`           | string               | 词语/句子正文 |
| `ReviewCard.definition`     | string               | 解释/翻译     |
| `ReviewCard.example`        | string               | 示例句        |
| `ReviewCard.sourceType`     | favorite / low_score | 来源          |
| `ReviewCard.conversationId` | string?              | 用于 TTS      |

## 扩展与下一步

> Phase 3.2 将引入 ReviewItem/ReviewLog 数据表，并引入 SM-2 或可配置的间隔复习策略。

建议扩展方向：

1. ReviewLog 落库：记录卡片反馈与复习时间，支持统计曲线。
2. 语言维度：根据 `targetLanguage` 分桶，避免跨语言混杂。
3. 复习排序：优先低分表达 + 未掌握收藏。
4. 收藏来源补全：语义收藏追加 `conversationId` 与 `score` 信息。
