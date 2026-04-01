# LuvTALK 部署教程

> 本文档帮助你将 LuvTALK 部署到生产环境。
> 架构：前端（Vercel） + 后端（Railway） + 数据库（Supabase PostgreSQL）

## 一分钟速览

```
┌─────────────┐      ┌─────────────────┐      ┌──────────────┐
│  Vercel      │─────▶│  Railway         │─────▶│  Supabase    │
│  (前端 SPA)  │ API  │  (NestJS 后端)   │  SQL │  (PostgreSQL)│
│  apps/web    │ 代理 │  apps/server     │      │              │
└─────────────┘      └─────────────────┘      └──────────────┘
```

**部署顺序**：① 数据库就绪 → ② 部署后端 → ③ 部署前端 → ④ 冒烟测试

---

## 1. 前置条件

- [Supabase](https://supabase.com) 项目已创建，PostgreSQL 可用
- [Railway](https://railway.app) 账号已注册
- [Vercel](https://vercel.com) 账号已注册
- 本仓库已推送到 GitHub

---

## 2. 数据库配置

1. 在 Supabase 项目设置中获取数据库连接字符串
2. 推荐配置：
   - `DATABASE_URL`：使用 Session Mode pooler（`:5432`），运行时稳定
   - `DIRECT_URL`：使用 Session Mode pooler（`:5432`）或 Direct 连接，供 Prisma 迁移
3. 验证迁移状态：
   ```bash
   pnpm --filter server prisma:migrate:status
   ```
4. 首次部署需要执行迁移：
   ```bash
   pnpm --filter server prisma:migrate:deploy
   ```

---

## 3. 部署后端（Railway）

### 步骤

1. 在 Railway 创建新项目 → **Deploy from GitHub repo**
2. 选择本仓库
3. 配置构建：
   - **Dockerfile Path**: `apps/server/Dockerfile`
   - **Build Context**: `apps/server`
   - **Start Command**: `node dist/main`
4. 添加环境变量（见下方完整列表）
5. 部署完成后记录后端域名（例：`your-app.up.railway.app`）

### 后端环境变量

| 分类         | 变量                             | 说明                           |
| ------------ | -------------------------------- | ------------------------------ |
| **运行时**   | `NODE_ENV=production`            | 生产模式                       |
|              | `PORT=3000`                      | 服务端口                       |
|              | `ALLOW_IN_MEMORY_FALLBACK=false` | **必须 false**，禁止假成功写入 |
| **数据库**   | `DATABASE_URL`                   | 运行时连接                     |
|              | `DIRECT_URL`                     | Prisma 迁移连接                |
| **主模型**   | `PRIMARY_API_URL`                | 主 AI 服务地址                 |
|              | `PRIMARY_AUDIO_API_URL`          | 主 AI 音频服务地址             |
|              | `PRIMARY_REALTIME_API_URL`       | 主 AI 实时服务地址             |
|              | `PRIMARY_API_KEY`                | 主 AI 密钥                     |
| **备用模型** | `SECONDARY_API_URL`              | 备用 AI 服务地址               |
|              | `SECONDARY_API_KEY`              | 备用 AI 密钥                   |
| **模型路由** | `PRIMARY_MODEL`                  | 主模型名称                     |
|              | `SECONDARY_MODEL`                | 备用模型名称                   |
|              | `THIRD_MODEL`                    | 第三备用模型名称               |
|              | `STT_MODEL`                      | 语音转文字模型                 |
|              | `TTS_MODEL`                      | 文字转语音模型                 |
|              | `REALTIME_MODEL`                 | 实时语音模型                   |
|              | `TRANSLATION_MODEL`              | 翻译模型                       |
| **认证**     | `JWT_SECRET`                     | JWT 签名密钥                   |
|              | `GOOGLE_CLIENT_ID`               | Google OAuth ID                |
|              | `GOOGLE_CLIENT_SECRET`           | Google OAuth Secret            |

### 验证后端

```bash
curl https://your-app.up.railway.app/api/health
# 期望返回: {"status":"ok", ...}

curl https://your-app.up.railway.app/api/health/db
# 期望返回: {"connected":true, ...}
```

---

## 4. 部署前端（Vercel）

### 步骤

1. 在 Vercel 创建新项目 → **Import Git Repository**
2. 选择本仓库
3. 配置项目：
   - **Root Directory**: `apps/web`
   - **Build Command**: `pnpm --filter web exec vite build`
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install`
4. 添加环境变量：

| 变量                     | 值                                | 说明              |
| ------------------------ | --------------------------------- | ----------------- |
| `VITE_API_URL`           | `/api`                            | API 路径前缀      |
| `VITE_PROXY_API`         | `https://your-app.up.railway.app` | 后端真实域名      |
| `VITE_SUPABASE_URL`      | `https://xxx.supabase.co`         | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...`                          | Supabase 匿名密钥 |

5. **重要**：更新 `apps/web/vercel.json` 中的 API 代理地址：

   ```json
   {
     "rewrites": [
       {
         "source": "/api/(.*)",
         "destination": "https://your-app.up.railway.app/api/$1"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

   将 `your-app.up.railway.app` 替换为 Railway 分配的真实域名。

6. 点击 **Deploy**

---

## 5. 部署后验证（冒烟测试）

| 顺序 | 场景                   | 需要确认什么                   |
| ---- | ---------------------- | ------------------------------ |
| 1    | 登录并进入聊天页       | 用户登录正常，页面无白屏       |
| 2    | 新建会话并发送文字消息 | 会话可正常写入和读取           |
| 3    | 发送语音或上传语音     | 转写、导师回复、音频播放器正常 |
| 4    | 上传一张图片到 chat    | 选中后有 toast、图片可预览、可发送、可正常识别 |
| 5    | 切换学习语言与音色     | chat 只显示当前语言可用音色    |
| 6    | 进入场景练习并结束     | 语音可用、反馈可生成、无 mock  |
| 7    | 收藏一个表达           | 收藏写入成功                   |
| 8    | 刷新页面并恢复历史会话 | 会话、标题、历史记录一致       |
| 9    | 打开健康接口           | `/api/health` 返回 `ok`        |

---

## 6. 常见问题排查

| 问题现象                | 优先检查                                                     |
| ----------------------- | ------------------------------------------------------------ |
| 服务启动就报数据库错误  | `DATABASE_URL`、`DIRECT_URL` 是否正确                        |
| 迁移失败                | `DIRECT_URL` 是否误用了 `:6543` transaction pooler           |
| 健康接口显示 `degraded` | `/api/health/db` 中 `connected` 和 `reconnectScheduled` 状态 |
| 文本能聊、语音不能用    | `PRIMARY_AUDIO_API_URL`、`STT_MODEL`、`TTS_MODEL` 是否配置 |
| chat 一直初始化        | 数据库连接、`/api/health/db`、会话历史接口是否超时或关闭   |
| 沉浸模式异常            | `PRIMARY_REALTIME_API_URL`、`REALTIME_MODEL` 是否配置        |
| 数据写入偶发丢失        | 是否误开了 `ALLOW_IN_MEMORY_FALLBACK=true`                   |
| 前端请求 404 / 跨域     | `vercel.json` 中 API 代理地址是否正确                        |

> 音色目录已经固定在服务端官方映射里，部署时不再配置 `TTS_VOICE_*` 或 `VITE_TTS_VOICE_*`。
> 当前推荐音色为：普通话 `Serena`，粤语 `Kiki / Rocky`，英语 `Ethan`。

---

## 7. 上线前构建验证

本地执行以下命令确认全部通过后再部署：

```bash
# 后端
pnpm --filter server lint:check
pnpm --filter server build
pnpm --filter server test

# 前端
pnpm --filter web lint
pnpm --filter web exec tsc -b
pnpm --filter web exec vite build
```

## 8. 数据库连接说明

| 用途           | 推荐配置                                     | 说明               |
| -------------- | -------------------------------------------- | ------------------ |
| `DATABASE_URL` | Session Mode pooler `:5432`                  | 运行时稳定连接     |
| `DIRECT_URL`   | Session Mode pooler `:5432` 或 Direct        | Prisma 迁移专用    |
| 迁移校验       | `pnpm --filter server prisma:migrate:status` | 确认 schema 无漂移 |
