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


## Upgrade note for votes + rotation

Before deploying this upgraded version, run the SQL in `supabase/migrations/2026-04-01-votes-and-rotation.sql` inside the Supabase SQL Editor. That adds the `movie_votes` table used by the voting UI and the vote-aware picker.
