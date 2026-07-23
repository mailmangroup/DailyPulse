<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# DailyPulse — Agent Notes

Daily team status tracker: who's in / WFH / on leave, daily logs + checklists, date navigation, admin. Auth and data via Supabase; UI is shadcn/ui + Base UI + Tailwind; animations via Framer Motion.

## Stack

- Next.js 16 (App Router) + React 19
- Supabase (auth, Postgres, Realtime, Storage)
- shadcn/ui + Base UI + Tailwind CSS 4
- Framer Motion, next-themes, Vercel Analytics

Dev: `make dev` (kills port 3000, then `npm run dev`). Lint/build: `make lint` / `make build`.

## Project layout

```
app/
  (main)/
    [date]/           # Daily view — /YYYY-MM-DD; today is /
  admin/              # Admin panel (admin-only)
  auth/               # Supabase auth callback
  login/
  components/         # Page-level UI (DailyLogs, DayPanel, TopDashboard, …)
  utils/supabase/     # Browser + server Supabase clients
components/ui/        # shadcn/ui
types/                # Shared TS types (incl. supabase.ts)
database/
  schema.sql          # Canonical schema
  migrations/         # Incremental SQL
proxy.ts              # Auth gate (replaces middleware.ts in this Next.js version)
UI_DOC.md             # Design tokens (dark theme, emerald-300 accent)
```

## Routing & auth

- Auth lives in `proxy.ts`, **not** `middleware.ts`. Unauthenticated requests redirect to `/login`.
- Today → `/`. Other days → `/<YYYY-MM-DD>`.
- Signups restricted to `@kawo.com` (DB trigger `block_non_company_signups`).

## Database (shared Supabase)

Schema: `database/schema.sql`. Project is shared with `hi-kevin` and `kevin-analysis` — be careful with migrations.

| Table | Role |
|---|---|
| `profiles` | Per-user; name, avatar_url, is_admin, is_hidden. Synced from Auth on signup. |
| `daily_logs` | One row per `(user_id, date)`; status enum + activities (checklist text). |
| `user_kawo_credentials` | Per-user KAWO tokens — separate from profiles so team read-all doesn't expose them. |
| `kawo_profile_seed` | Migration seed; deny-all RLS, only via SECURITY DEFINER signup trigger. |

Important triggers/RPCs: `handle_new_user`, `block_non_company_signups`, `guard_privileged_profile_cols`, `get_last_active_date`.

RLS summary: authenticated can read profiles + daily_logs; users mutate only their own logs/credentials; admins can update/delete any profile; privileged profile cols guarded by trigger. Avatars in public `avatars` bucket at `{user_id}/avatar.jpg` with folder-prefix write RLS.

## Conventions

- Prefer existing patterns in `app/components/` and `components/ui/`.
- Design tokens and look: see `UI_DOC.md` (dark + mint-green accent).
- Realtime: daily logs update live via Supabase Realtime.
- i18n: English / Chinese via `locale-provider.tsx`.
