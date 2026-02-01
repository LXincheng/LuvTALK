# LuvTALK 2.0 实施计划（新版）

> 覆盖旧 Phase0/1/2，并补充当前阶段与后续新功能路线。

## 阶段总览

| 阶段    | 目标                  | 关键任务（摘要）                                                                    | 状态                   |
| ------- | --------------------- | ----------------------------------------------------------------------------------- | ---------------------- |
| Phase 0 | 基础骨架与可部署能力  | `apps/web` 脚手架 + Tailwind；`apps/server` Docker+FFmpeg；CI 基线；`.env` 环境集中 | 已完成（部署配置暂缓） |
| Phase 1 | Figma UI 还原         | glassmorphism/暗黑/沉浸模式/导航与布局对齐；多语言 UI 文案                          | 已完成                 |
| Phase 2 | 现有后端接入 & 轻量化 | 会话 + SSE；语音上传与播放；收藏 API；移除旧前端                                    | 已完成                 |
| Phase 3 | 互动词汇 + 每日复习   | LLM 词汇标注输出；消息注解与收藏联动；复习卡片聚合                                  | 已完成（MVP）          |
| Phase 4 | 账号与部署链路        | Supabase Auth；Railway/Vercel 配置；环境变量落地                                    | 暂缓（按你指示）       |

## Phase 3 详细任务

| 模块     | 子任务              | 输出物                                   | 说明                        |
| -------- | ------------------- | ---------------------------------------- | --------------------------- |
| 互动词汇 | AI 输出 `key_terms` | `AiResponseSchema` + `prompt.config.ts`  | LLM 结构化输出词汇与解释    |
| 互动词汇 | 消息注解落库        | `ConversationMessage.meta.keyTerms`      | 保存到会话 JSON，前端可复用 |
| 互动词汇 | UI 高亮与弹窗       | `AnnotatedMessage` + `VocabularyPopover` | 用虚线下划线 + 收藏         |
| 每日复习 | 数据聚合            | `/review/daily`                          | 汇总收藏 + 低分表达         |
| 每日复习 | 复习反馈            | `/review/feedback`                       | 记录复习结果，更新复习节奏  |
| 每日复习 | 朗读支持            | 复用 `/conversation/:id/tts`             | 卡片可一键发音              |

## 暂缓项（等待你启动）

| 项目                | 阻塞原因             | 对应文件                       |
| ------------------- | -------------------- | ------------------------------ |
| Supabase Auth 接入  | 环境未配置           | `apps/web` + `apps/server`     |
| Railway/Vercel 部署 | 地址与环境变量未配置 | `apps/web/vercel.json`、`.env` |
