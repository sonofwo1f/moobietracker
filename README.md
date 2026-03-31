# Moobie Clurb

Shared, iPhone-friendly movie club tracker built with Next.js + Supabase.

## Features

- shared backlog and watch history
- schedule upcoming movie nights
- track who picked each movie
- optionally track attendees
- fairness board
- random picker

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Database

Run `supabase/schema.sql` in the Supabase SQL Editor.

## Environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
