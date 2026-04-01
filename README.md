# Moobie Clurb v5

This version adds:
- site-wide password protection with a shared password
- separate pages for Dashboard, Schedule, Backlog, History, Wheel, and Settings
- a spinning wheel for randomly choosing who gets to pick next
- the existing voting, ratings, export, and email notification features

## Environment variables

Add these in Vercel:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_PASSWORD`
- `RESEND_API_KEY`
- `NOTIFY_FROM_EMAIL`
- `SCHEDULE_WEBHOOK_URL`

## Notes

- `SITE_PASSWORD` enables the shared password gate. If you leave it blank, the site stays open.
- The wheel is intentionally random. It does not override the normal rotation board unless your club decides to use it.
- No new Supabase migration is required for this version.

## Routes

- `/`
- `/schedule`
- `/backlog`
- `/history`
- `/wheel`
- `/settings`
- `/login`
