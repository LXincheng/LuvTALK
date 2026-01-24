# Project Goal: LuvTALK 2.0 - Figma-Driven Cloud Refactor

## 1. Executive Summary

Refactor the LuvTALK application into a cloud-native architecture.
**Strategy**: "Walking Skeleton" first.

1.  **Frontend**: Build `apps/web` using **User-Provided Figma Code (`figma-proto/`)**.
2.  **Migration**: Replace legacy Ionic app with React + Tailwind PWA (`apps/web`).
3.  **Infrastructure**: Dockerize Backend immediately; Setup Supabase DB/Auth.
4.  **Deployment**: Keep CI/CD minimal and ensure the app is deployable to Railway (Backend) and Vercel (Frontend) from Day 1.

## 2. Feature Requirements

### 2.1 ✅ Implemented Features (Port Logic from `apps/web`)

1.  **Polling Conversation**: Send text/voice; AI analyzes pronunciation/vocab and replies (Voice + Text + Translation).
2.  **Multi-language**: Support Cantonese, Mandarin, English.
3.  **Scenarios**: Fixed prompts/openers for different contexts.

### 2.2 🚀 New Features (To Be Implemented)

1.  **Google Login**: Persistent history via Supabase Auth + Google OAuth.
2.  **Conversation History**: List and view persistent chat records per user.
3.  **Favorites System**: Save replies, words, and expressions with a dedicated list view.
4.  **Daily Review**: Spaced repetition cards based on low scores/favorites.
5.  **WebSocket Streaming**: Real-time, full-duplex voice interruption (upgrade from polling).
6.  **Interactive Text**: Clickable words in AI replies to see explanations/usage and allow saving.

## 3. Tech Stack & Deployment

- **Frontend**: React 19 + Vite + Tailwind CSS -> **Vercel**.
- **Backend**: NestJS 11 + Docker (Node+FFmpeg) -> **Railway**.
- **Database**: Supabase (Postgres) + Prisma.
- **Auth**: Supabase Auth (Client SDK + Server Verification).
- **UI Source**: `figma-proto/` (Strict reference).

## 4. Success Criteria

- Frontend visual matches `figma-proto` code.
- Backend is running on Railway (Docker container healthy).
- Frontend is running on Vercel and can talk to Backend.
- User can Login via Google and chat with AI.
- CI pipeline can build `apps/server` and `apps/web` with documented deployment steps.
