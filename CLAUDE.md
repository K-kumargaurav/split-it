# SplitEasy — Bill Splitter App

## Project Overview
A production-grade bill splitting web and mobile app for everyone.
Web: Next.js 14. Mobile: React Native + Expo (Phase 2).

## Stack
- Next.js 14 (App Router) + TypeScript (strict mode)
- PostgreSQL via Supabase
- Prisma ORM
- Tailwind CSS
- NextAuth.js for authentication
- Zod for validation
- Jest for testing

## Folder Structure
src/
  app/          ← Next.js App Router pages
  components/   ← Reusable UI components
  lib/          ← Utilities and helpers
  server/       ← API logic and database queries
  types/        ← TypeScript interfaces
  hooks/        ← Custom React hooks
tests/          ← Mirror of src/ structure

## Critical Money Rules
- ALWAYS store money as integers (paise/cents) — NEVER floats
- 100.50 rupees = 10050 paise in database
- Convert to display format ONLY in UI layer
- Always validate split amounts sum to bill total exactly

## Auth Rules
- Use NextAuth.js with Google + Email providers
- JWT access tokens (15min) + refresh tokens (7 days)
- Store refresh tokens in httpOnly cookies only
- All protected routes use authenticateToken middleware
- Never expose passwords — bcrypt with salt rounds >= 12

## Security Rules
- Validate all inputs with Zod on every endpoint
- Parameterized queries only — never raw SQL string interpolation
- Rate limit all auth endpoints (max 5 req/min)
- CORS whitelist only — never wildcard *
- Never hardcode secrets — environment variables only
- Never log sensitive data (passwords, tokens, card info)
- Users can never see or edit another user's bills

## Code Standards
- TypeScript strict mode — no any types ever
- ESLint + Prettier enforced
- Max file length 300 lines — split if larger
- camelCase functions, kebab-case files
- Write Jest tests for every function
- No TODO comments unless explicitly asked

## UI Rules
- Tailwind CSS only — no inline styles
- Mobile-first responsive design always
- WCAG 2.1 accessibility (aria labels, contrast ratios)
- Loading states for all async operations
- Error boundaries on all pages

## Git Rules
- Never commit .env files
- Branch naming: feature/, fix/, chore/
- Commit messages: conventional commits format
