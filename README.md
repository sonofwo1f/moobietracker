# Moobie Clurb v4

Shared, iPhone-friendly movie club tracker built with Next.js + Supabase.

## What is new in this version

- remembered member profile on each device
- member email + notification preference fields
- watched-movie ratings and a club favorites board
- JSON and CSV export endpoints
- notification event logging when a movie night is scheduled, updated, or marked watched
- optional webhook support for outbound notifications

## Important note about identity

This version adds a lightweight member identity layer that remembers the active club member on the device and ties votes, picks, ratings, and attendance to that member profile. It is intentionally simple and does **not** add full passwordless auth.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Database

Run these in Supabase SQL Editor:

1. `supabase/schema.sql`
2. `supabase/migrations/2026-04-01-votes-and-rotation.sql`
3. `supabase/migrations/2026-04-01-identity-ratings-export-notifications.sql`

## Environment variables

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:
- `SCHEDULE_WEBHOOK_URL` for simple outbound schedule notifications

## Export endpoints

- `/api/export?format=json`
- `/api/export?format=csv`
