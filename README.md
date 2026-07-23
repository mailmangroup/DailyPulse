# DailyPulse

A daily team status tracker — see who's in, WFH, or out, leave daily logs and checklists, and browse your team's history by date.

## Features

- **Daily status & logs** — In Office / WFH / On Leave, inline checklists (auto-saved), live updates via Supabase Realtime
- **Team dashboard** — Sticky header grouped by status; warnings for missing logs or empty task lists
- **Activity ranking** — Early loggers ranked; top 3 get badges; confetti on your own submit
- **Date navigation** — Sidebar month calendar (`/` for today, `/YYYY-MM-DD` otherwise)
- **Monthly overview & quick-fill** — Month-wide checklist view; bulk status setting for the month
- **My Month drawer** — Personal task history with inline editing
- **Missed log reminder** — Toast when the team was active but you didn't log
- **Profile & admin** — Edit name/avatar; admins manage members
- **i18n & theme** — English / Chinese; light and dark themes

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router) · [Supabase](https://supabase.com) · [shadcn/ui](https://ui.shadcn.com) + [Base UI](https://base-ui.com) · Tailwind · [Framer Motion](https://framer.com/motion)

## Getting Started

```bash
make dev
```

Open [http://localhost:3000](http://localhost:3000).

Schema: [`database/schema.sql`](database/schema.sql). Design tokens: [`UI_DOC.md`](UI_DOC.md). Agent/contributor notes: [`AGENTS.md`](AGENTS.md).
