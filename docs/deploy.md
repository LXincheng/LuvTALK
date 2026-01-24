# Deployment Notes

## Railway (apps/server)

- Build: Dockerfile `apps/server/Dockerfile`
- Build context: `apps/server`
- Start command: `node dist/main`
- Required environment variables:
  - `DATABASE_URL`
  - `DS_AI_API_KEY`
  - `DS_AI_API_URL`
  - `DS_AI_MODEL`
  - `OPENAI_API_URL`
  - `OPENAI_API_KEY`
  - `OPENAI_TRANSCRIBE_MODEL`
  - `OPENAI_TUTOR_MODEL`
  - `OPENAI_TTS_MODEL`

## Vercel (apps/web)

- Root directory: `apps/web`
- Build command: `pnpm --filter web build`
- Output directory: `dist`
- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## API Proxy (Vercel)

- Update `apps/web/vercel.json` with your Railway backend domain.
