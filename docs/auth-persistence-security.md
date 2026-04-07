# LuvTALK 鉴权、持久化与安全总说明

> 当前有效结论：本系统推荐并已落地的方案是 **Supabase Auth 邮箱 OTP + Anonymous Sign-In（游客）+ Prisma 持久化**。
> 这套方案的重点不是“多做一套登录系统”，而是让 **用户身份、业务数据、游客升级、后端写库** 走同一条链路。

## 1. 方案选型结论

| 方案 | 实现难度 | 安全性 | 与当前系统贴合度 | 当前建议 |
| --- | --- | --- | --- | --- |
| 邮箱 OTP | 低 | 中高 | 很高 | **采用** |
| 手机号 OTP | 中高 | 中高 | 中 | 暂不采用 |
| 自建账号密码 | 中 | 中 | 中 | 不建议当前阶段投入 |
| 直接使用 Supabase Auth | 低 | 高 | 很高 | **采用** |

### 1.1 为什么最终选邮箱 OTP

| 考量维度 | 结论 |
| --- | --- |
| 实现难易度 | 邮箱 OTP 可以直接用 Supabase 原生能力；手机号 OTP 还要额外配置短信供应商，联调和成本都更高。 |
| 安全性 | 邮箱 OTP 避免了弱密码管理问题；令牌由 Supabase 签发，前端不自己保存敏感密码。 |
| 产品贴合性 | LuvTALK 当前更像学习型 Web App，不是强依赖手机号的社交/本地服务。邮箱更自然，也更适合后续接报告通知、周报等场景。 |
| 与游客模式兼容 | 匿名用户可以原地升级为邮箱账号，**user id 保持不变**，这正好满足“先体验再注册”的产品路径。 |

## 2. 官方调研结论

| 主题 | 官方结论 | 对本项目的意义 |
| --- | --- | --- |
| Email Passwordless | Supabase 原生支持邮箱 OTP / magic link。 | 可以直接做无密码登录与注册。 |
| Anonymous Users | Supabase 支持匿名登录，并允许后续升级为永久账号。 | 可以保留游客入口，不破坏现有体验。 |
| 用户升级 | 匿名用户可通过 `updateUser()` 绑定邮箱等正式身份信息。 | 当前练习数据可无缝延续。 |
| Phone Auth | 手机号登录需要短信通道配置。 | 对 MVP 来说复杂度、成本和维护都偏高。 |

### 2.1 本次参考的官方文档

| 类型 | 链接 |
| --- | --- |
| Supabase Email Passwordless | https://supabase.com/docs/guides/auth/auth-email-passwordless |
| Supabase Anonymous Sign-Ins | https://supabase.com/docs/guides/auth/auth-anonymous |
| Supabase JS `signInWithOtp` | https://supabase.com/docs/reference/javascript/auth-signinwithotp |
| Supabase JS `updateUser` | https://supabase.com/docs/reference/javascript/auth-updateuser |
| Supabase JS `verifyOtp` | https://supabase.com/docs/reference/javascript/auth-verifyotp |

## 3. 当前系统的最终架构

### 3.1 身份链路

| 层 | 责任 |
| --- | --- |
| Web 前端 | 调用 Supabase Auth 完成游客登录、邮箱登录、邮箱注册、匿名升级。 |
| Supabase Auth | 签发 session 与 access token，维护真实身份。 |
| NestJS 后端 | 从 `Authorization: Bearer <token>` 中读取 Supabase access token，调用 Supabase `/auth/v1/user` 校验。 |
| Prisma / Postgres | 使用同一个 `user.id` upsert 到业务 `User` 表，并挂接会话、收藏、学习目标、报告等数据。 |

### 3.2 数据持久化链路

| 业务数据 | 存储位置 | 如何绑定用户 |
| --- | --- | --- |
| `User` | Prisma / Postgres | 后端校验 Supabase token 后按 `payload.id` upsert |
| `Conversation` | Prisma / Postgres | `conversation.userId = user.id` |
| `Favorite` | Prisma / Postgres | `favorite.userId = user.id` |
| `LearningGoal` | Prisma / Postgres | `learningGoal.userId = user.id` |
| `ConversationReport` | Prisma / Postgres | `report.userId = user.id` |

### 3.3 为什么能和当前持久化无缝衔接

> 关键点只有一个：**后端最终认的是 Supabase 用户 id**，而不是前端自己造的本地身份。

当前后端已经具备以下逻辑：

| 能力 | 当前状态 |
| --- | --- |
| 读取前端 bearer token | 已具备 |
| 调用 Supabase `/auth/v1/user` 校验 token | 已具备 |
| 校验成功后自动 upsert Prisma `User` | 已具备 |
| 会话 / 收藏 / 学习目标等表通过 `userId` 关联 | 已具备 |

所以这次不需要重写后端鉴权体系，重点是把前端登录方式收口到同一条 Supabase Auth 路上。

## 4. 本次落地后的登录策略

| 场景 | 最终做法 |
| --- | --- |
| 首次体验 | `signInAnonymously()` |
| 正常登录 | `signInWithOtp({ email })` |
| 正常注册 | 同样走邮箱 OTP，无需额外密码 |
| 游客升级为正式账号 | 匿名用户调用 `updateUser({ email })`，再用 OTP 验证 |
| Google 登录 | 暂时不接，只保留按钮和 toast 提示 |

### 4.1 为什么登录和注册可以共用一套邮箱 OTP

因为对 Supabase 来说，邮箱 OTP 本身就是一套 passwordless 身份验证入口：

| 情况 | 结果 |
| --- | --- |
| 邮箱已存在 | 验证后登录现有账号 |
| 邮箱不存在 | 验证后创建新账号 |

这对 MVP 很友好，页面上仍然保留“登录 / 注册”分区，主要是为了用户心智更清晰，而不是后端维护两套完全不同的逻辑。

## 5. 游客与正式账号的无缝升级

### 5.1 升级机制

| 步骤 | 说明 |
| --- | --- |
| 1 | 用户先用匿名登录进入系统 |
| 2 | 在注册页输入邮箱 |
| 3 | 前端对匿名用户调用 `updateUser({ email })` |
| 4 | 用户输入收到的验证码完成验证 |
| 5 | 同一个 Supabase user 完成升级，原 `user.id` 不变 |

### 5.2 这意味着什么

| 项目 | 是否需要迁移 |
| --- | --- |
| 会话历史 | 不需要 |
| 收藏夹 | 不需要 |
| 学习目标 | 不需要 |
| 报告数据 | 不需要 |
| 成就与等级 | 不需要 |

> 换句话说，这不是“把旧游客数据拷贝到一个新账号”，而是“让原来的匿名账号变成正式账号”。

## 6. 你现在需要在 Supabase 控制台做的操作

### 6.1 必做项

| 操作 | 路径 | 要求 |
| --- | --- | --- |
| 开启 Email Provider | `Authentication -> Sign In / Providers -> Email` | 打开 Email 登录 |
| 开启 Anonymous Sign-Ins | `Authentication -> Sign In / Providers -> Anonymous` | 打开匿名登录 |
| 配置站点 URL | `Authentication -> URL Configuration` | 填你的线上域名，本地可填开发地址 |
| 填写 `.env` 和 `.env.example` | 项目根目录 | 确保 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 一致 |

### 6.2 强烈建议项

| 操作 | 原因 |
| --- | --- |
| 开启 Supabase Bot / Abuse 防护（如 CAPTCHA、Rate Limits） | OTP 类接口天然容易被刷 |
| 使用自定义 SMTP | 提升邮件送达率，避免测试邮箱发件限制 |
| 检查 Auth 邮件模板 | 确保邮件里展示验证码或可验证链接，和当前产品交互一致 |

### 6.3 当前不需要做的事

| 操作 | 当前结论 |
| --- | --- |
| 配短信供应商 | 暂时不需要，因为我们不做手机号 OTP |
| 配 Google OAuth | 暂时不接，只保留按钮 |
| 重建数据库表 | 暂时不需要，现有 Prisma 结构已兼容 |

## 7. 代码层已落实的约束

### 7.1 前端

| 模块 | 作用 |
| --- | --- |
| `apps/web/src/services/authService.ts` | 统一封装匿名登录、邮箱 OTP、匿名升级、OTP 校验 |
| `apps/web/src/pages/LoginPage.tsx` | 统一登录 / 注册 UI，兼容浅色 / 深色模式 |
| `apps/web/src/providers/AuthProvider.tsx` | 监听 Supabase session，给全局页面提供登录状态 |
| `apps/web/src/services/apiClient.ts` | 请求后端时自动带上 Supabase access token |

### 7.2 后端

| 模块 | 作用 |
| --- | --- |
| `apps/server/src/modules/auth/auth.service.ts` | 校验 Supabase token，upsert 业务用户 |
| `apps/server/src/modules/auth/jwt-auth.guard.ts` | 把认证后的用户资料挂到 `request.user` |
| `apps/server/src/modules/conversation/conversation.controller.ts` | 会话创建、恢复、删除、历史等接口都会按当前 token 解析用户 |

## 8. 安全基线

### 8.1 当前安全收益

| 项目 | 收益 |
| --- | --- |
| 不存密码 | 降低密码泄漏与密码找回复杂度 |
| 身份源单一 | 前后端都认 Supabase token，避免多套身份状态打架 |
| 游客升级不迁移 | 减少人为迁移脚本带来的串号与越权风险 |
| 后端二次校验 token | 前端 token 不被直接信任，后端会重新确认用户身份 |

### 8.2 仍需注意的风险

| 风险 | 说明 | 建议 |
| --- | --- | --- |
| OTP 被刷 | 邮箱验证码接口可能被恶意请求 | 开启 rate limit、CAPTCHA |
| 邮件送达不稳定 | 默认发件能力有限 | 尽快切到自定义 SMTP |
| 游客设备丢失 | 匿名账号依赖当前设备 session | 在关键位置引导升级正式账号 |
| 前端公开 anon key | 这是正常设计，但必须只使用 anon key，不能泄露 service role key | 严禁把 service role 暴露到前端 |

## 8.3 运行时排障与当前已知问题

| 问题 | 现象 | 根因 | 当前处理 |
| --- | --- | --- | --- |
| 邮件只有跳转链接没有 6 位码 | 收到 Supabase Auth 邮件后跳到新 URL 页面 | Email Template 仍使用 `{{ .ConfirmationURL }}` 而不是 `{{ .Token }}` | 邮件模板已调整为直接发送 6 位验证码 |
| `invalid algorithm` warning | 后端日志里反复出现 `Failed to verify access token: invalid algorithm` | Supabase token 校验后的用户同步写库失败，代码又回退去验本地 JWT | 已调整逻辑：识别 Supabase token 后不再误走本地 JWT 校验噪音路径 |
| `MaxClientsInSessionMode` | `achievement`、`learning-goal`、`auth` 查询报 `max clients reached` | 当前运行时 `DATABASE_URL` 使用 Supabase Session mode pooler，连接上限过低，且业务侧有并发查询放大效应 | 已减少部分并发查询并加入数据库降级；但根因仍需切换运行时数据库连接策略 |

### 8.4 当前数据库状态结论

> 截至 2026-04-07，本地对运行时数据库的最小探测查询也会被 `FATAL: MaxClientsInSessionMode: max clients reached` 拒绝。

这意味着：

| 结论 | 说明 |
| --- | --- |
| 认证链路可部分工作 | Supabase Auth 本身能签发 token，但后端同步业务用户时可能被数据库连接池拒绝 |
| 业务读写不稳定 | Profile、Achievement、LearningGoal 等依赖 Prisma 的接口会受影响 |
| 不能判定为“当前已完全稳定可写” | 在修正数据库连接配置前，不建议把当前状态视为生产可用 |

### 8.5 建议的数据库连接配置

| 变量 | 建议 |
| --- | --- |
| `DATABASE_URL` | 当前项目运行时优先使用 transaction pooler `:6543`，并带上 `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Prisma migrate / schema engine 优先 direct host；若当前环境不支持 IPv6，再退到 session mode `:5432` |

> 简单说：当前不是 SQL 写错，也不是 Prisma schema 坏了，而是 **连接池模式选型不适合当前运行时负载**。

## 11. 当前数据库修正结论

### 11.1 这次问题的真实根因

你当前根目录 `.env` 里虽然存在 `DIRECT_URL` 这个变量名，但之前两条连接串都还是：

`aws-1-ap-south-1.pooler.supabase.com:5432`

这仍然是 Supabase pooler，不是 direct host。

真正的 direct host 应该长这样：

`db.<project-ref>.supabase.co:5432`

对于当前项目，就是：

`db.thwbsfhqtphfhwovfrih.supabase.co:5432`

但在当前这台机器上，实测结果是：

| 连接 | 结果 |
| --- | --- |
| `db.thwbsfhqtphfhwovfrih.supabase.co:5432` | DNS 只返回 IPv6，当前环境 Prisma 无法连通 |
| `aws-1-ap-south-1.pooler.supabase.com:6543` | 可连通，Prisma 最小读查询成功 |
| `aws-1-ap-south-1.pooler.supabase.com:5432` | 可作为当前环境下的 `DIRECT_URL` fallback，但不适合继续拿来做运行时 `DATABASE_URL` |

### 11.2 你现在还需要做什么

| 操作 | 是否还需要你额外提供信息 |
| --- | --- |
| 把 `DATABASE_URL` 改成 transaction pooler `:6543` | 不需要，当前信息已经足够 |
| 把 `DIRECT_URL` 按环境选择 direct host 或 session mode `:5432` | 不需要，当前信息已经足够 |
| 重启本地 server / 部署环境 | **需要**，否则旧连接不会释放 |
| 在 Supabase SQL Editor 执行演示数据 SQL | **需要**，这一步要你亲自执行 |

### 11.3 可直接执行的演示数据 SQL

执行前提：

| 条件 | 说明 |
| --- | --- |
| `auth.users` 里已经存在 `xincheng0116@gamil.com` | 最简单做法是先用这个邮箱真实登录一次，让 Supabase Auth 自动建用户 |
| 如果 `auth.users` 里还没有这条记录 | 下面这份 SQL 不会报错，但也不会真正插入该用户的业务展示数据 |

下面这版 SQL 不再依赖会跨语句失效的 `target_user` CTE，可以直接在 Supabase SQL Editor 执行。

```sql
begin;

insert into public."User" ("id", "email", "name", "avatarUrl", "createdAt")
select
  au.id,
  au.email,
  'Xincheng',
  null,
  now()
from auth.users au
where au.email = 'xincheng0116@gamil.com'
on conflict ("id") do update
set
  "email" = excluded."email",
  "name" = excluded."name";

insert into public."Achievement" (
  "code", "title", "description", "icon", "color", "rarity", "targetValue", "targetMetric"
)
values
  ('first_conversation', 'First Conversation', 'Complete your first guided conversation.', 'Sparkles', '#4F8CFF', 'common', 1, 'conversation_count'),
  ('streak_keeper', 'Streak Keeper', 'Stay active for 7 days.', 'Flame', '#2F6BFF', 'rare', 7, 'streak_days'),
  ('vocabulary_builder', 'Vocabulary Builder', 'Save 120 useful words.', 'BookOpen', '#7BA7FF', 'rare', 120, 'vocab_count'),
  ('sharp_listener', 'Sharp Listener', 'Reach an average review score of 85.', 'Waveform', '#9BB8FF', 'epic', 85, 'average_score')
on conflict ("code") do update
set
  "title" = excluded."title",
  "description" = excluded."description",
  "icon" = excluded."icon",
  "color" = excluded."color",
  "rarity" = excluded."rarity",
  "targetValue" = excluded."targetValue",
  "targetMetric" = excluded."targetMetric";

insert into public."LevelDefinition" ("level", "title", "icon", "color", "minXp")
values
  (1, 'Starter', 'Seedling', '#9BB8FF', 0),
  (2, 'Explorer', 'Compass', '#6EA8FF', 150),
  (3, 'Achiever', 'Rocket', '#4F8CFF', 360),
  (4, 'Fluent', 'Crown', '#2F6BFF', 720)
on conflict ("level") do update
set
  "title" = excluded."title",
  "icon" = excluded."icon",
  "color" = excluded."color",
  "minXp" = excluded."minXp";

insert into public."Conversation" (
  "id", "scenarioId", "targetLanguage", "nativeLanguage", "messages",
  "score", "title", "status", "createdAt", "updatedAt", "userId"
)
values
  (
    'demo-conv-01',
    'daily-small-talk',
    'English',
    'Chinese',
    '[]'::jsonb,
    88,
    'Daily Speaking Warmup',
    'completed',
    now() - interval '6 days',
    now() - interval '6 days',
    (select id from public."User" where email = 'xincheng0116@gamil.com')
  ),
  (
    'demo-conv-02',
    'travel-checkin',
    'English',
    'Chinese',
    '[]'::jsonb,
    91,
    'Hotel Check-in Practice',
    'completed',
    now() - interval '3 days',
    now() - interval '3 days',
    (select id from public."User" where email = 'xincheng0116@gamil.com')
  ),
  (
    'demo-conv-03',
    'business-intro',
    'English',
    'Chinese',
    '[]'::jsonb,
    86,
    'Business Self Introduction',
    'completed',
    now() - interval '1 day',
    now() - interval '1 day',
    (select id from public."User" where email = 'xincheng0116@gamil.com')
  )
on conflict ("id") do update
set
  "score" = excluded."score",
  "title" = excluded."title",
  "status" = excluded."status",
  "updatedAt" = excluded."updatedAt",
  "userId" = excluded."userId";

insert into public."LearningGoal" (
  "userId", "dailyMinutesGoal", "weeklyWordsGoal", "weeklySpeakingGoal", "createdAt", "updatedAt"
)
values (
  (select id from public."User" where email = 'xincheng0116@gamil.com'),
  20,
  35,
  5,
  now(),
  now()
)
on conflict ("userId") do update
set
  "dailyMinutesGoal" = excluded."dailyMinutesGoal",
  "weeklyWordsGoal" = excluded."weeklyWordsGoal",
  "weeklySpeakingGoal" = excluded."weeklySpeakingGoal",
  "updatedAt" = excluded."updatedAt";

insert into public."LearningActivityDaily" (
  "userId", "dateKey", "focusSeconds", "createdAt", "updatedAt"
)
values
  ((select id from public."User" where email = 'xincheng0116@gamil.com'), to_char(current_date - 6, 'YYYY-MM-DD'), 1320, now(), now()),
  ((select id from public."User" where email = 'xincheng0116@gamil.com'), to_char(current_date - 5, 'YYYY-MM-DD'), 1680, now(), now()),
  ((select id from public."User" where email = 'xincheng0116@gamil.com'), to_char(current_date - 4, 'YYYY-MM-DD'), 1500, now(), now()),
  ((select id from public."User" where email = 'xincheng0116@gamil.com'), to_char(current_date - 3, 'YYYY-MM-DD'), 2100, now(), now()),
  ((select id from public."User" where email = 'xincheng0116@gamil.com'), to_char(current_date - 2, 'YYYY-MM-DD'), 1860, now(), now()),
  ((select id from public."User" where email = 'xincheng0116@gamil.com'), to_char(current_date - 1, 'YYYY-MM-DD'), 1740, now(), now()),
  ((select id from public."User" where email = 'xincheng0116@gamil.com'), to_char(current_date, 'YYYY-MM-DD'), 2280, now(), now())
on conflict ("userId", "dateKey") do update
set
  "focusSeconds" = excluded."focusSeconds",
  "updatedAt" = excluded."updatedAt";

insert into public."ReviewFeedback" (
  "id", "userId", "cardId", "action", "sourceType", "conversationId", "createdAt"
)
values
  ('demo-review-01', (select id from public."User" where email = 'xincheng0116@gamil.com'), 'card_vocab_01', 'known', 'favorite', 'demo-conv-01', now() - interval '5 days'),
  ('demo-review-02', (select id from public."User" where email = 'xincheng0116@gamil.com'), 'card_vocab_02', 'practice', 'low_score', 'demo-conv-02', now() - interval '2 days'),
  ('demo-review-03', (select id from public."User" where email = 'xincheng0116@gamil.com'), 'card_vocab_03', 'known', 'favorite', 'demo-conv-03', now() - interval '1 day')
on conflict ("id") do update
set
  "action" = excluded."action",
  "sourceType" = excluded."sourceType",
  "conversationId" = excluded."conversationId",
  "createdAt" = excluded."createdAt";

insert into public."UserAchievement" (
  "userId", "achievementId", "progress", "unlockedAt", "createdAt", "updatedAt"
)
select
  (select id from public."User" where email = 'xincheng0116@gamil.com'),
  a.id,
  case a.code
    when 'first_conversation' then 3
    when 'streak_keeper' then 7
    when 'vocabulary_builder' then 128
    when 'sharp_listener' then 87
    else 0
  end,
  case
    when a.code in ('first_conversation', 'streak_keeper', 'vocabulary_builder', 'sharp_listener')
      then now() - interval '1 day'
    else null
  end,
  now(),
  now()
from public."Achievement" a
where a.code in ('first_conversation', 'streak_keeper', 'vocabulary_builder', 'sharp_listener')
on conflict ("userId", "achievementId") do update
set
  "progress" = excluded."progress",
  "unlockedAt" = excluded."unlockedAt",
  "updatedAt" = excluded."updatedAt";

insert into public."UserLevel" (
  "userId", "levelId", "currentXp", "updatedAt"
)
values (
  (select id from public."User" where email = 'xincheng0116@gamil.com'),
  (select id from public."LevelDefinition" where level = 3),
  428,
  now()
)
on conflict ("userId") do update
set
  "levelId" = excluded."levelId",
  "currentXp" = excluded."currentXp",
  "updatedAt" = excluded."updatedAt";

commit;
```

## 9. 为什么这次不选手机号验证

| 维度 | 原因 |
| --- | --- |
| 实施成本 | 需要额外短信服务商与模板配置 |
| 成本结构 | 每条短信有真实费用，不适合当前阶段先验证产品 |
| 风险控制 | 短信链路还要考虑区域、模板审核、失败重试、风控策略 |
| 业务贴合 | 语言学习产品当前没有强手机号依赖 |

> 简单说，手机号登录不是不能做，而是 **现在做不划算**。

## 10. 后续建议

| 优先级 | 建议 |
| --- | --- |
| P0 | 在 Supabase 控制台完成 Email / Anonymous Provider 配置 |
| P0 | 检查邮件模板，确保验证码流程和当前页面匹配 |
| P1 | 开启 OTP rate limit / CAPTCHA |
| P1 | 配置稳定 SMTP 发件 |
| P2 | 后续需要社交登录时，再补 Google OAuth 真正接入 |
| P2 | 未来如果要支持手机号，可作为第二登录方式，而不是替换当前邮箱方案 |
