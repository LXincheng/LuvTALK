# LuvTALK 2.0 Implementation Plan

## Phase 0: "Walking Skeleton" (Init & Deploy Prep)

> **Goal**: Get a "Hello World" full-stack app deployed on cloud.

- [ ] **Frontend Init (`apps/web`)**:
  - [ ] Create Vite + React + TypeScript project.
  - [ ] Install `tailwindcss`, `postcss`, `autoprefixer`, `lucide-react`.
  - [ ] Create `vercel.json` (Rewrite rules for SPA and API proxy).
- [ ] **Backend Prep (`apps/server`)**:
  - [ ] Create `Dockerfile` (Must include `apt-get install ffmpeg`).
  - [ ] Create `.dockerignore`.
- [ ] **Supabase Init**:
  - [ ] Update `.env` with Supabase `DATABASE_URL`.
  - [ ] Run `npx prisma db push`.
- [ ] **CI/CD Baseline**:
  - [ ] Add a minimal CI workflow (install, lint, build) for `apps/server` and `apps/web`.
  - [ ] Document Railway/Vercel environment variables and deployment steps.
- [ ] **MANUAL CHECKPOINT**:
  - User connects Repo to Railway (Backend) & Vercel (Frontend).
  - Verify `/api/health` returns 200 on public URL.

## Phase 1: Figma UI Implementation (Frontend)

> **Goal**: Recreate the UI using provided code.

- **Primary Source**: The folder `figma-proto/` contains the High-Fidelity UI code.
- **Instruction**: Before implementing ANY frontend component, you MUST read the corresponding file in `figma-proto/`.
- **Adaptation**: Copy the Tailwind classes and structure from Figma code. Adapt it to React components (props, state) but **KEEP THE STYLING EXACT**.

## Phase 2: Logic Connection (The "Brain")

- [ ] **Backend Auth**:
  - [ ] Configure `Passport-JWT` to verify Supabase tokens.
  - [ ] Protect `ConversationController` with new Guard.
- [ ] **Client Logic**:
  - [ ] Port `useVoiceRecorder` from legacy app (remove Ionic deps).
  - [ ] Port `apiClient` to use Vercel environment variables.
  - [ ] Connect Chat UI to `POST /conversation/message`.
- [ ] **History Retrieval**:
  - [ ] Add API to list and fetch user conversation history.
  - [ ] Wire history data into UI (list + detail, following Figma if available).

## Phase 3: New Features

- [ ] **Favorites & Review**:
  - [ ] Create DB Models: `Favorite`, `ReviewQueue`.
  - [ ] Implement Favorites list UI and APIs (save/remove/list).
  - [ ] Implement `figma-proto/review-card.tsx` UI.
  - [ ] Aggregate low-score expressions into the review queue.
- [ ] **Interactive Text**:
  - [ ] Implement Clickable Words in Chat Bubble.
  - [ ] Provide word explanation data source (API or curated dictionary).
- [ ] **WebSocket**:
  - [ ] Setup `ConversationGateway` (Socket.io) on Backend.
  - [ ] Add WebSocket client flow for real-time full-duplex chat.
  - [ ] Update Dockerfile to expose correct ports if needed.

## Phase 4: Cleanup

- [ ] Verify Feature Parity.
- [ ] Delete legacy frontend remnants (if any).
