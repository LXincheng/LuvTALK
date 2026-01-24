# Architecture Specification

## Frontend (`apps/web`)

- **Base**: React 19, Vite, TypeScript.
- **UI Engine**: Tailwind CSS.
- **Code Source**: Figma-generated code (primary), Custom logic (secondary).
- **Router**: React Router DOM v6.
- **PWA**: `vite-plugin-pwa`.

## Backend (`apps/server`)

- **Base**: NestJS 11.
- **Runtime**: Docker (Node 20 + FFmpeg).
- **API**: REST (Legacy/Standard) + WebSocket (Realtime Voice).
- **Auth Strategy**: `passport-jwt` verifying Supabase JWT.

## Data Models (Supabase/Prisma)

- **User**: Linked to Supabase Auth ID.
- **Conversation**: Stores chat history.
- **Favorite**: (New) Stores saved words/replies.
- **ReviewQueue**: (New) Spaced repetition items.
