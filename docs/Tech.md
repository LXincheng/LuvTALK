好的，我将为您精简这份技术规范文档，移除部分描述性文字和具体的代码实现示例（如 NestJS 的 Controller/Service 完整代码），同时保留关键的规范、约束和架构定义。

---

# 📘 luvTALK 技术规范文档（Technical Specification Document）

**版本：** v1.4.1 (精简版)
**日期：** 2025-11-15
**技术理念：** TypeScript-first、Ionic PWA、NestJS 模块化、高可扩展

---

# 目录

1.  [项目概述](https://www.google.com/search?q=%23%E9%A1%B9%E7%9B%AE%E6%A6%82%E8%BF%B0)
2.  [核心技术栈](https://www.google.com/search?q=%23%E6%A0%B8%E5%BF%83%E6%8A%80%E6%9C%AF%E6%A0%88)
3.  [技术约束](https://www.google.com/search?q=%23%E6%8A%80%E6%9C%AF%E7%BA%A6%E6%9D%9F)
4.  [前端（PWA）架构规范](https://www.google.com/search?q=%23%E5%89%8D%E7%AB%AFpwa%E6%9E%B6%E6%9E%84%E8%A7%84%E8%8C%83)
5.  [后端（NestJS）架构规范](https://www.google.com/search?q=%23%E5%90%8E%E7%AB%AFnestjs%E6%9E%B6%E6%9E%84%E8%A7%84%E8%8C%83)
6.  [数据库（Prisma）规范](https://www.google.com/search?q=%23%E6%95%B0%E6%8D%AE%E5%BA%93%E8%A7%84%E8%8C%83)
7.  [AI 服务规范](https://www.google.com/search?q=%23ai-%E6%9C%8D%E5%8A%A1%E8%A7%84%E8%8C%83)
8.  [Monorepo 目录结构](https://www.google.com/search?q=%23monorepo-%E7%9B%AE%E5%BD%95%E7%BB%93%E6%9E%84)
9.  [部署规范](https://www.google.com/search?q=%23%E9%83%A8%E7%BD%B2%E8%A7%84%E8%8C%83)

---

# 项目概述

luvTALK 是一款 AI 驱动的语言学习 PWA 应用，使用语音对话、即时反馈、翻译和学习本等功能，帮助用户进行沉浸式语言练习（Cantonese/English）。本项目强调代码统一、易于拓展和跨平台。

---

# 核心技术栈

## 🔹 架构 & 语言

- **Monorepo 管理器**：Turborepo
- **包管理器**：pnpm
- **语言**：TypeScript

## 🔹 前端（PWA）

- **框架**：React 18
- **UI 组件库**：Ionic React (`@ionic/react`)
- **路由**：`@ionic/react-router`
- **构建工具**：Vite
- **状态管理**：Zustand
- **PWA 支持**：`vite-plugin-pwa` + `@ionic/pwa-elements`

## 🔹 后端（API）

- **运行环境**：Node.js 20+
- **框架**：**NestJS 10+**
- **数据验证**：**`class-validator`** (API DTOs), **Zod** (AI 输出)

## 🔹 数据库

- **主库**：PostgreSQL 15+
- **ORM**：Prisma

## 🔹 AI 服务

- **LLM（对话）**：Google Gemini（JSON Mode）
- **ASR（语音转文字）**：Google Speech-to-Text
- **TTS（文字转语音）**：Google Cloud Text-to-Speech

---

# 技术约束

## 1\. TypeScript 约束

- 全项目必须使用 `.ts` / `.tsx`
- 必须启用严格模式：`strict: true`

## 2\. 前端（Ionic）约束

- **路由**：必须使用 `<IonReactRouter>` 和 `<IonRouterOutlet>`。
- **页面**：所有页面必须被 `<IonPage>` 包装。
- **PWA**：必须调用 `@ionic/pwa-elements/loader` 并从 Vite 的 `optimizeDeps` 中排除。

## 3\. 后端（NestJS）约束

- **模块化**：每个核心功能（e.g., `auth`, `conversation`）必须封装在自己的 `Module` 中。
- **分层**：严格遵循 `Controller` → `Service` → `Repository` (PrismaService) 分层。
- **DTOs**：所有 API 输入必须定义 DTO class，并使用 `class-validator` 自动验证。
- **依赖注入**：所有 Service 和 Provider 必须是 `@Injectable()` 并通过构造函数注入。
- **Prisma 集成**：Prisma Client 应封装在 `PrismaModule` 中，并作为 `PrismaService` 注入到其他服务。
- **Response 结构**：使用全局 Interceptor 统一响应结构：
  ```ts
  { data?: any; error?: { message: string; code?: string } }
  ```

## 4\. AI 约束

- Gemini 回复必须为 JSON Mode。
- 所有 LLM 输出必须通过 Zod 校验后才能在 Service 中使用。
- AI 服务层不能直接返回 LLM 原始字符串，必须返回结构化数据。

## 5\. 数据库约束

- Prisma schema 是唯一数据源。
- Prisma Client 只能在 `Service` 层调用。
- 必须使用 `prisma migrate dev` 和 `prisma migrate deploy` 管理数据库变更。

---

# 前端（PWA）架构规范

## 前端目录结构

```
apps/web
│── public
│── src
│ 	├── components
│ 	├── hooks
│ 	├── pages
│ 	├── services 	# API
│ 	├── store 	# Zustand
│ 	├── theme
│ 	│ 	└── variables.css
│ 	├── App.tsx
│ 	└── main.tsx
```

## PWA 元素初始化

```ts
import { defineCustomElements } from "@ionic/pwa-elements/loader";
defineCustomElements(window);
```

---

# 后端（NestJS）架构规范

## 目录结构 (apps/server)

以功能（feature）为导向进行模块化。

```
apps/server
│── src
│ 	├── core/ 		# 核心模块 (e.g., config, database)
│ 	│ 	└── database/
│ 	│ 		└── prisma.service.ts
│ 	│
│ 	├── modules/ 		# 业务功能模块
│ 	│ 	├── conversation/ # 对话模块
│ 	│ 	│ 	├── conversation.controller.ts
│ 	│ 	│ 	├── conversation.service.ts
│ 	│ 	│ 	├── conversation.module.ts
│ 	│ 	│ 	└── dto/
│ 	│ 	│
│ 	│ 	└── notebook/ 	# 学习本模块
│ 	│ 		├── ...
│ 	│
│ 	├── app.module.ts 	# 根模块
│ 	└── main.ts 		# 入口文件
```

## 核心架构理念

1.  **AppModule (根模块)**：组装所有核心模块和功能模块。
2.  **功能模块 (Feature Module)**：
    - `*.module.ts`：定义模块范围，声明 `controllers` 和 `providers`。
    - `*.controller.ts`：定义路由，使用 `@Body()` 配合 DTOs 验证数据。
    - `*.service.ts`：标记为 `@Injectable()`，处理业务逻辑，注入 `PrismaService` 等。

---

# 数据库规范

## 示例 Prisma Schema（会话）

```prisma
model Conversation {
	id 		String 	@id @default(cuid())
	userId 		String
	messages 	Json 	// 存储对话历史
	createdAt 	DateTime @default(now())
}
```

## 示例 Prisma Schema（收藏）

```prisma
model FavoriteSentence {
	id 		String 	@id @default(cuid())
	userId 		String
	conversationId 	String
	text 		String
	createdAt 	DateTime @default(now())
}
```

---

# AI 服务规范

## AI 输出结构（示例）

LLM 必须返回此 JSON 结构的变体：

```json
{
  "reply": "AI 回复文本",
  "correction": {
    "hasMistake": true,
    "explanation": "错误原因"
  },
  "culture": "文化解释"
}
```

## Zod 校验（强制）

在 AI Service 中，必须使用 Zod 校验 LLM 返回的 JSON。

```ts
const AiResponseSchema = z.object({
  reply: z.string(),
  correction: z.object({
    hasMistake: z.boolean(),
    explanation: z.string().optional(),
  }),
  culture: z.string().optional(),
});
```

---

# Monorepo 目录结构

```
📁 luvtalk/
├── apps/
│ 	├── web/ 		# Ionic PWA (Vite)
│ 	└── server/ 		# NestJS Backend
├── packages/
│ 	├── shared/ 		# 共享类型 (e.g., API 响应, Zod schemas)
│ 	├── database/ 		# Prisma schema 和生成的 client
│ 	└── eslint-config-custom/
├── tsconfig.base.json
├── turbo.json
└── pnpm-workspace.yaml
```

---

# 部署规范

## 1\. Monorepo 构建

- 使用 `pnpm install` 安装依赖。
- 使用 `pnpm turbo build` 并行构建 `web` 和 `server`。

## 2\. 前端 (apps/web)

- **产物**：Vite 构建后生成纯静态文件（SPA/PWA）。
- **部署**：部署到任意静态托管平台（如 Vercel, Netlify, Nginx）。

## 3\. 后端 (apps/server)

- **产物**：NestJS 编译后的 `dist` 目录（JavaScript + `node_modules`）。
- **部署**：
  - 推荐使用 Dockerfile 将 `dist`、`node_modules` 和 `prisma` 打包。
  - 在 Node.js 20+ 环境中运行（如 Cloud Run, Vercel Serverless）。
  - 部署时必须运行 `pnpm prisma migrate deploy` 以应用数据库变更。
