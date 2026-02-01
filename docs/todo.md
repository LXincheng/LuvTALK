# TODO：互动词汇 & 每日复习（评估 + 落地）

## 分阶段落地路线

| 阶段              | 目标                    | 关键任务                                                        | 依赖                |
| ----------------- | ----------------------- | --------------------------------------------------------------- | ------------------- |
| Phase 3.1（MVP）  | 互动词汇 + 每日复习可用 | LLM 返回 `key_terms`；前端高亮 + 收藏；`/review/daily` 即时聚合 | 现有 LLM 与收藏 API |
| Phase 3.2（强化） | 间隔复习与可持续数据    | Prisma 新表（ReviewItem/ReviewLog）；SM-2 计算；复习反馈落库    | Supabase / DB 迁移  |

> Phase 3.1 已完成，以下仅保留 Phase 3.2 待办。

## 实现细节清单（待办）

| 模块 | 改动点               | 文件位置                           | 说明                     |
| ---- | -------------------- | ---------------------------------- | ------------------------ |
| 数据 | ReviewItem/ReviewLog | `apps/server/prisma/schema.prisma` | Phase 3.2 再落库          |

## 需要你配置的地方

| 配置项                              | 文件/位置         | 用途                              |
| ----------------------------------- | ----------------- | --------------------------------- |
| `VITE_API_URL`                      | `apps/web/.env`   | 前端 API 入口                     |
| `DATABASE_URL`                      | `.env` / Supabase | ReviewItem/ReviewLog 与收藏持久化 |
| `DS_AI_API_KEY` / `DS_AI_API_URL`   | `.env`            | DeepSeek 备援 LLM                 |
| `OPENAI_API_KEY` / `OPENAI_API_URL` | `.env`            | GPT Tutor + TTS + STT             |
| `OPENAI_TUTOR_MODEL`                | `.env`            | 导师对话模型                      |
| `OPENAI_TTS_MODEL`                  | `.env`            | 朗读合成模型                      |

## 其他 TODO

| 事项                         | 原因           | 备注                     |
| ---------------------------- | -------------- | ------------------------ |
| `docs/rules.md` 缺失         | 项目规范未落地 | 建议补齐 UI/交互硬性约束 |
| Supabase/Railway/Vercel 配置 | 你已明确暂缓   | 继续在 log 中维护提醒    |
