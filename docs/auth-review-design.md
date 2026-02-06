# Supabase Auth 与复习持久化设计文档

> 目标：支持游客 + 手机号验证码登录，后端可验证 Supabase Access Token，并将对话/收藏/复习数据持久化，便于后续分析。

## 1. 认证流程设计（游客 + 手机号）

| 模块              | 输入                | 处理                                                    | 输出                   | 备注                                  |
| ----------------- | ------------------- | ------------------------------------------------------- | ---------------------- | ------------------------------------- |
| 前端-游客登录     | 点击“游客体验”      | `supabase.auth.signInAnonymously()`                     | Session + access_token | 便于无需手机号也可开始使用            |
| 前端-手机号验证码 | 手机号 + 发送验证码 | `supabase.auth.signInWithOtp({ phone })`                | 触发短信               | 需要在 Supabase 控制台启用 Phone Auth |
| 前端-验证码确认   | 手机号 + OTP        | `supabase.auth.verifyOtp({ phone, token, type:'sms' })` | Session + access_token | 完成登录                              |
| 前端-请求后端     | access_token        | `Authorization: Bearer <token>`                         | 业务接口可识别 userId  | 后端解析用户身份                      |
| 后端-鉴权         | access_token        | 调用 `SUPABASE_URL/auth/v1/user` 校验                   | 返回 Supabase user     | 避免在后端存放 JWT 私钥               |

## 2. Token 校验与用户落库

| 步骤       | 说明                                     | 关键点                                   |
| ---------- | ---------------------------------------- | ---------------------------------------- |
| Token 校验 | 后端调用 Supabase Auth 用户接口          | 需 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY` |
| 用户落库   | 使用 Supabase user.id 作为本地 `User.id` | email/phone/头像同步到本地               |
| 游客处理   | supabase anonymous user 也有 `id`        | 业务数据可与游客绑定                     |

## 3. 复习持久化模型（可扩展）

| 表              | 作用               | 主要字段                                                         | 说明                |
| --------------- | ------------------ | ---------------------------------------------------------------- | ------------------- |
| ReviewQueueItem | 复习队列（带调度） | userId, sourceType, term, nextReviewAt, intervalDays, easeFactor | 用于卡片复习排序    |
| ReviewFeedback  | 复习反馈日志       | userId, cardId, action, createdAt                                | 统计“已掌握/需练习” |

> 没有迁移能力时，可使用 Supabase SQL Editor 手动创建表结构；应用侧已实现缺表降级（回退到内存队列）。

## 4. 复习调度算法（简化版 SM-2）

| 输入            | 处理逻辑                                                                            | 输出                         |
| --------------- | ----------------------------------------------------------------------------------- | ---------------------------- |
| action=practice | intervalDays=1；easeFactor=max(1.3, easeFactor-0.2)                                 | nextReviewAt=明天            |
| action=known    | intervalDays=round(intervalDays \* easeFactor)；easeFactor=min(3.0, easeFactor+0.1) | nextReviewAt=intervalDays 后 |

> 目标：低门槛可解释、方便后续改成完整 SM-2。

## 5. 数据持久化范围

| 业务              | 存储位置           | 状态           |
| ----------------- | ------------------ | -------------- |
| 会话 Conversation | Conversation 表    | 已支持         |
| 收藏 Favorite     | Favorite 表        | 已支持         |
| 复习队列          | ReviewQueueItem 表 | 新增（需建表） |
| 复习反馈          | ReviewFeedback 表  | 新增（需建表） |
