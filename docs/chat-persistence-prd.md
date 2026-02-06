# 聊天记录与语音文件持久化 PRD

## 1. 背景与问题

LuvTALK 是一款 AI 语言学习聊天应用。在本次改动之前，每次用户访问 `/chat` 页面或切换浏览器标签页，前端都会调用 `startConversation()` 创建全新会话，导致：

- 所有聊天记录丢失，用户无法查看之前的对话
- 每次重新进入都消耗 LLM token 生成开场白
- 语音文件虽在服务器磁盘上保留，但因 conversationId 变化而无法访问
- 用户体验极差

## 2. 目标

实现类似 Claude 网页端的聊天体验：

- 会话持久化：刷新页面、切换标签后自动恢复当前会话
- 历史记录：用户可查看和切换过去的对话
- 语音持久化：TTS 音频 URL 写回数据库，恢复会话时无需重新生成
- 模式切换：语音模式 / 纯文字模式 / 沉浸模式（预留）

## 3. 技术方案

### 3.1 数据库变更

Conversation 模型新增两个字段：

- `title: String?` — 自动生成的会话标题（场景名称或首条用户消息前60字符）
- `status: String @default("active")` — 会话状态："active" 或 "archived"

### 3.2 存储策略

| 数据类型          | 存储位置             | 理由                        |
| ----------------- | -------------------- | --------------------------- |
| 会话元数据 + 消息 | Supabase PostgreSQL  | 核心数据，跨设备同步        |
| 语音录音/TTS 音频 | 服务器文件系统       | 已有实现，通过 API URL 访问 |
| 当前活跃会话 ID   | localStorage         | 快速恢复，无需额外请求      |
| 用户偏好          | localStorage         | 轻量级                      |
| TTS 音频 URL      | 写回 DB message meta | 避免重复生成                |

### 3.3 后端 API

新增端点：

- `POST /api/conversation/resume` — 恢复或创建会话
- `POST /api/conversation/:id/archive` — 归档会话

修改端点：

- `GET /api/conversation/history` — 移除强制鉴权，支持游客返回空数组

### 3.4 前端核心改动

**会话恢复逻辑**（替代原来的 `startConversation()`）：

1. 从 localStorage 读取 `activeConversationId`
2. 调用 `POST /conversation/resume`，传入 conversationId + 语言参数
3. 后端优先查找用户的活跃会话，没有则创建新的
4. 成功后将 session.id 写入 localStorage

**聊天模式**：

- 语音模式：默认行为，TTS + 语音录入
- 文字模式：跳过 TTS 合成，隐藏麦克风按钮
- 沉浸模式：禁用状态，预留接口

### 3.5 TTS 音频持久化

TTS 合成成功后，后端自动将 `audioUrl` 写回对应 AI 消息的 `meta.audioUrl` 字段并重新持久化会话。恢复会话时，消息中已包含音频 URL，无需重新合成。

## 4. UI 设计

### 4.1 聊天历史抽屉

- 左侧滑出，glass-sidebar 风格
- 显示会话列表：标题、最后消息预览、相对时间
- "新对话" 按钮
- 当前会话高亮
- 空状态提示

### 4.2 模式切换器

- 分段控制器，位于聊天头部
- 三个选项：语音 / 文字 / 沉浸（禁用）
- glass-card 容器 + glass-button 选中态

### 4.3 头部改造

- 新增历史记录按钮（History 图标）
- 显示当前会话标题
- 模式切换器替代原来的沉浸模式按钮

## 5. 涉及文件

### 新建

- `apps/web/src/components/chat/ChatHistoryDrawer.tsx`
- `apps/web/src/components/chat/ChatModeSwitcher.tsx`
- `docs/chat-persistence-prd.md`

### 修改

- `apps/server/prisma/schema.prisma`
- `apps/server/src/common/types/conversation.types.ts`
- `apps/server/src/modules/conversation/conversation.service.ts`
- `apps/server/src/modules/conversation/conversation.controller.ts`
- `apps/server/src/modules/conversation/dto/start-conversation.dto.ts`
- `apps/server/src/modules/voice-tutor/voice-tutor.service.ts`
- `apps/web/src/types/api.ts`
- `apps/web/src/services/conversationService.ts`
- `apps/web/src/pages/ConversationPage.tsx`
- `apps/web/src/components/chat/VoiceInput.tsx`
- `apps/web/src/providers/LocaleContext.tsx`

## 6. 验证清单

- [ ] 刷新页面后会话恢复，消息完整
- [ ] 切换标签页不创建新会话
- [ ] 切换语言创建新会话，切回恢复原会话
- [ ] 历史抽屉显示所有会话
- [ ] 点击历史会话可加载
- [ ] "新对话" 归档旧会话
- [ ] 文字模式无 TTS、无麦克风
- [ ] 语音模式 TTS 正常
- [ ] 沉浸模式按钮禁用
- [ ] 模式选择持久化
- [ ] 语音消息刷新后仍可播放
- [ ] 游客用户通过 localStorage 恢复