# Realtime Interaction Plan

## 背景
发送消息后，DeepSeek 需要几秒生成结果，用户会感知到明显卡顿。我们希望在发送后立即看到本地消息，并在 AI 回复完成时自动刷新，从而提升交互流畅度。

## 方案评估

### WebSocket
- **优点**：全双工通信、低延迟，可以扩展到多聊天室/房间广播。
- **缺点**：需要额外 Gateway 与心跳管理，目前 API 以 REST 为主，集成成本较高；只需要服务端推送时显得过重。

### Server-Sent Events (SSE)
- **优点**：基于 HTTP/1.1，NestJS 用 `@Sse` 即可实现；浏览器端 `EventSource` 原生支持自动重连，非常适合“服务端单向推送”。
- **缺点**：仅支持服务端 → 客户端方向，若日后需要双向通讯需另行扩展。

👉 现阶段主打“服务端推送最终回复”，**SSE** 最稳妥。

## 实现方式

1. **后端 (NestJS)**
   - `ConversationService` 新增 `Subject<ConversationSession>` 来缓存订阅者，并在 `startSession`/`processMessage` 后广播。
   - `ConversationController` 新增 `@Sse(':conversationId/events')`，将 `Observable<ConversationSession>` 转成 `MessageEvent`。
   - DeepSeek 请求仍基于 REST，但每次更新后会推送给所有订阅者。

2. **前端 (React + Ionic)**
   - `services/conversationStream.ts` 封装 `EventSource`，订阅 `/conversation/:id/events`。
   - Zustand `conversation.send` 先乐观地把本地消息 append 到 UI，再触发 API；当 SSE 推送最终结果时自动替换为真实会话数据。
   - 如果 SSE 断线，REST 响应仍能更新 session，保障兼容性。

3. **未来扩展**
   - DeepSeek 若支持流式输出，可复用 SSE 将分片内容逐段推送，进一步降低感知延迟。
   - 若需要多人会话或教师端协作，再考虑 WebSocket Gateway。

结论：当前版本已启用 SSE + 乐观 UI，不再出现“发送后页面空白或卡顿”的体验。***
