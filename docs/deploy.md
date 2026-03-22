# 上线清单

> 这份文档只回答两件事：
>
> 1. 上线前你要做哪些操作。
> 2. 上线前你要检查什么。
>
> 当前结论：项目已经具备上线前提，但上线前仍必须完成一次生产环境变量核对、一次数据库迁移校验、一次真实账号冒烟。

## 1. 上线前要做的操作

| 顺序 | 要做什么           | 具体操作                                                           | 通过标准                                                 |
| ---- | ------------------ | ------------------------------------------------------------------ | -------------------------------------------------------- |
| 1    | 配置生产环境变量   | 在 Railway / Vercel / 其他平台填好后端、前端、数据库、AI、鉴权变量 | 服务可正常启动，不出现缺失环境变量错误                   |
| 2    | 关闭业务内存回退   | 后端生产环境必须设置 `ALLOW_IN_MEMORY_FALLBACK=false`              | 数据库异常时不会出现“接口看起来成功、实际没写入”的假成功 |
| 3    | 确认数据库连接方式 | `DATABASE_URL` 用运行时稳定连接；`DIRECT_URL` 用 Prisma 迁移连接   | `pnpm --filter server prisma:migrate:status` 能跑通      |
| 4    | 执行远端迁移检查   | 在准备上线的环境执行 `pnpm --filter server prisma:migrate:status`  | 不出现 migration 历史不一致、连接失败、schema 漂移       |
| 5    | 执行构建与验证     | 本地或 CI 分别执行 server / web 校验命令                           | server / web 的 lint、类型、测试、构建全部通过           |
| 6    | 部署后端           | 发布 `apps/server`                                                 | 服务启动成功，健康接口正常                               |
| 7    | 部署前端           | 发布 `apps/web`，并确认代理地址指向正确后端                        | 页面能正常访问 API，不出现跨域或 404                     |
| 8    | 做真实账号冒烟     | 用真实登录用户跑一轮核心功能                                       | 文本、语音、收藏、复习、成就、历史会话都正常             |
| 9    | 检查健康接口       | 访问 `/api/health` 与 `/api/health/db`                             | 接口可访问，数据库状态与当前实际情况一致                 |

## 2. 必填环境变量

### 后端

| 分类          | 变量                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Runtime       | `NODE_ENV=production`、`PORT`、`ALLOW_IN_MEMORY_FALLBACK=false`                                                    |
| Database      | `DATABASE_URL`、`DIRECT_URL`                                                                                       |
| Primary AI    | `PRIMARY_API_URL`、`PRIMARY_AUDIO_API_URL`、`PRIMARY_REALTIME_API_URL`、`PRIMARY_API_KEY`                          |
| Secondary AI  | `SECONDARY_API_URL`、`SECONDARY_API_KEY`                                                                           |
| Model Routing | `PRIMARY_MODEL`、`SECONDARY_MODEL`、`THIRD_MODEL`、`STT_MODEL`、`TTS_MODEL`、`REALTIME_MODEL`、`TRANSLATION_MODEL` |
| Auth          | `JWT_SECRET`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`                                                           |

### 前端

| 分类     | 变量                                          |
| -------- | --------------------------------------------- |
| API      | `VITE_API_URL`、`VITE_PROXY_API`              |
| Supabase | `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` |

## 3. 数据库连接要求

| 用途           | 推荐配置                           | 说明                                                                            |
| -------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL` | 优先使用当前环境最稳定的运行时连接 | 如果 `:6543` transaction pooler 有抖动，可直接改用 `*.pooler.supabase.com:5432` |
| `DIRECT_URL`   | 用于 Prisma migration 的连接       | 不要把 `:6543` transaction pooler 用作迁移连接                                  |
| 迁移校验       | `pnpm --filter server prisma:migrate:status` | 用来确认 migration 历史和 schema 没漂移                               |

> 当前项目在这台机器上的实测结论：  
> `aws-1-ap-south-1.pooler.supabase.com:5432` 比 `:6543` 更稳定，适合作为当前环境的运行时和迁移连接。  
> 如果你的部署环境对 Supabase direct host 可稳定访问，也可以让 `DIRECT_URL` 走 direct 连接。

## 4. 上线前必须检查

| 类别       | 检查项                                        | 期望结果                                    |
| ---------- | --------------------------------------------- | ------------------------------------------- |
| 数据库     | `pnpm --filter server prisma:migrate:status` 通过 | 本地 schema、migration 历史、远端库结构一致 |
| 构建       | `pnpm --filter server lint:check && pnpm --filter server build && pnpm --filter server test && pnpm --filter web lint && pnpm --filter web exec tsc -b && pnpm --filter web exec vite build` 通过 | 不带病上线 |
| 安全       | `ALLOW_IN_MEMORY_FALLBACK=false`              | 没有假成功写入                              |
| 会话安全   | 匿名会话访问需要 `accessKey`                  | 未授权用户无法访问他人会话、媒体、TTS       |
| AI 配置    | 主模型、备用模型、STT、TTS、Realtime 均已配置 | 不会出现部分链路能用、部分链路缺配置        |
| 前后端联通 | 前端 API 代理正确                             | 页面请求不会打错域名或端口                  |
| 数据一致性 | Supabase 远端与当前 Prisma schema 一致        | 上线后不会出现写入失败或字段不匹配          |
| 健康接口   | `/api/health`、`/api/health/db` 可正常返回    | 可快速判断是否处于数据库降级或自动重连阶段  |

## 5. 上线前建议的冒烟顺序

| 顺序 | 场景                         | 需要确认什么                                 |
| ---- | ---------------------------- | -------------------------------------------- |
| 1    | 登录并进入聊天页             | 用户登录正常，页面无白屏                     |
| 2    | 新建会话并发送文字消息       | `Conversation` 可正常写入和读取              |
| 3    | 在 chat 语音模式发送文字消息 | 导师回复风格自然，且可生成 TTS               |
| 4    | 上传一条语音                 | 转写、导师回复、导师音频播放器都正常         |
| 5    | 收藏一个表达                 | `Favorite` 写入成功                          |
| 6    | 进入每日复习并提交反馈       | `ReviewQueueItem`、`ReviewFeedback` 写入成功 |
| 7    | 打开成就和等级页             | `UserAchievement`、`UserLevel` 可读取        |
| 8    | 刷新页面并恢复历史会话       | 会话、标题、历史记录一致                     |
| 9    | 打开健康接口                 | `/api/health` 返回 `ok` 或 `degraded`，`/api/health/db` 可看到数据库当前状态 |

## 6. 如果检查失败，优先看哪里

| 问题现象                       | 优先检查                                                        |
| ------------------------------ | --------------------------------------------------------------- |
| 服务启动就报数据库错误         | `DATABASE_URL`、`DIRECT_URL`、Supabase 连接方式                 |
| 迁移失败                       | `DIRECT_URL` 是否误用了 `:6543`，以及 `_prisma_migrations` 状态 |
| 健康接口显示 `degraded`        | 查看 `/api/health/db` 中 `connected`、`reconnectScheduled`、`reconnectInFlight` |
| 文本能聊、语音不能用           | `PRIMARY_AUDIO_API_URL`、`STT_MODEL`、`TTS_MODEL`               |
| 沉浸模式异常                   | `PRIMARY_REALTIME_API_URL`、`REALTIME_MODEL`                    |
| 数据写入偶发丢失               | 是否误开了 `ALLOW_IN_MEMORY_FALLBACK=true`                      |
| 前端请求 404 / 跨域 / 代理错乱 | `VITE_API_URL`、`VITE_PROXY_API`、前端代理配置                  |

## 7. 发布目标配置

### Railway（后端）

| 项目          | 配置                     |
| ------------- | ------------------------ |
| Build         | `apps/server/Dockerfile` |
| Build Context | `apps/server`            |
| Start Command | `node dist/main`         |

### Vercel（前端）

| 项目             | 配置                                |
| ---------------- | ----------------------------------- |
| Root Directory   | `apps/web`                          |
| Build Command    | `pnpm --filter web exec vite build` |
| Output Directory | `dist`                              |

### 前端代理

| 项目      | 配置                                                        |
| --------- | ----------------------------------------------------------- |
| API Proxy | `apps/web/vercel.json` 或等价代理配置，必须指向正式后端域名 |
