# DailyPulse

A daily team status tracker — see who's in, WFH, or out, leave daily logs and checklists, and browse your team's history by date.

## Features

### Daily Status & Logs
- Each team member sets their daily status: **In Office**, **WFH**, or **On Leave**
- Attach a checklist of activities to your daily log — editable inline, auto-saved to Supabase
- Read-only checklist view for other team members' logs
- Live updates via Supabase Realtime — no refresh needed

### Team Dashboard
- Sticky header groups the team by status with member counts and names
- Warnings highlight team members who haven't logged (red/pulsing) or logged in/WFH but left no tasks (amber)

### Activity Ranking & Confetti
- Members are ranked by how early they submitted their log each day
- Top 3 early loggers get trophy/medal badges and a gradient highlight on their card
- Confetti fires when you submit your own log

### Date Navigation (Sidebar)
- Left sidebar shows a scrollable month calendar — click any date to navigate to `/<YYYY-MM-DD>`
- Today always resolves to `/` (no date in the URL)
- Pending navigation shows an animated pulse on the selected date

### Monthly Overview
- Modal showing all checklist entries across the current month, grouped by date
- Filter by individual team member

### Quick-Fill
- Calendar grid modal to bulk-set your status for any day in the month
- Optimistic updates with instant UI feedback

### My Month Drawer
- Personal side drawer showing your own task history for the viewed month
- Inline checklist editing per day; supports clearing all tasks or marking all done

### Missed Log Reminder
- Toast notification if the team was active on a recent day but you didn't log
- Dismisses per-date and persists dismissal in localStorage

### Profile & Admin
- Edit your display name and avatar URL inline
- Admin panel (admin-only): view all team members, toggle admin status, delete users (with log count confirmation)

### i18n & Theme
- English / Chinese toggle on the header
- Light and dark theme support

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) with App Router
- **Database**: [Supabase](https://supabase.com) for auth, data, and Realtime
- **UI**: [shadcn/ui](https://ui.shadcn.com) + [Base UI](https://base-ui.com) with Tailwind CSS
- **Animations**: [Framer Motion](https://framer.com/motion)
- **Analytics**: [Vercel Analytics](https://vercel.com/analytics)

## Getting Started

```bash
make dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/
  (main)/
    [date]/         # Daily view — logs, status, checklists per team member
  admin/            # Admin panel
  auth/             # Supabase auth callback
  login/            # Login page
  components/       # Shared page-level components
    DailyLogs.tsx       # Team status cards with ranking, logs, and checklists
    DayPanel.tsx        # Left sidebar with date nav, monthly overview, and quick-fill
    TopDashboard.tsx    # Sticky header with date and user controls
    MyMonthDrawer.tsx   # Personal month history drawer
    Checklist.tsx       # Checklist editor/viewer
    ActiveDayReminder.tsx
    ProfileEditModal.tsx
    locale-provider.tsx # i18n (English / Chinese)
  utils/supabase/   # Supabase client (browser + server)
components/ui/      # shadcn/ui component library
types/              # Shared TypeScript types
proxy.ts            # Auth middleware (replaces middleware.ts in this Next.js version)
```

## Database

Schema lives in [database/schema.sql](database/schema.sql). The Supabase project is shared with two other internal apps (`hi-kevin`, `kevin-analysis`).

### Tables

| Table | Description |
|---|---|
| `profiles` | One row per user, synced from Supabase Auth on signup. Holds `name`, `avatar_url`, `is_admin`, `is_hidden`. |
| `daily_logs` | Core data — one row per `(user_id, date)`. Stores `status` (enum) and `activities` (serialized checklist text). |
| `user_kawo_credentials` | Per-user KAWO API tokens. Intentionally separate from `profiles` so credentials aren't exposed to the whole team via the team dashboard's read-all policy. |
| `kawo_profile_seed` | Seed table for migrating KAWO credentials from the old project. Fully locked down — no RLS grants, no API access; only reachable by the `SECURITY DEFINER` signup trigger. |

### Triggers & Functions

- **`handle_new_user`** — fires on every new `auth.users` insert. Auto-creates a `profiles` row (seeding name/avatar from Google OAuth metadata) and copies KAWO credentials from `kawo_profile_seed` if a matching email row exists.
- **`block_non_company_signups`** — rejects any signup not from `@kawo.com`.
- **`guard_privileged_profile_cols`** — prevents non-admins from self-granting `is_admin` or `is_hidden` even if they have a valid row-level update policy.
- **`get_last_active_date(min_logs, current_date_str)`** — RPC that returns the most recent date before today where more than `min_logs` team members logged. Used by the missed-log reminder.

### Row Level Security

- **`profiles`**: all authenticated users can read; users can update their own row; admins can update or delete any row.
- **`daily_logs`**: all authenticated users can read; users can only insert/update their own rows.
- **`user_kawo_credentials`**: users can only read/write their own row.
- **`kawo_profile_seed`**: deny-all RLS + `REVOKE ALL` — unreachable from the browser.

### Storage

An `avatars` bucket (public) stores user avatar images at `{user_id}/avatar.jpg`. Folder-prefix RLS ensures users can only write to their own folder.

## Key Notes

- Auth is handled in `proxy.ts` (not `middleware.ts`) — unauthenticated requests redirect to `/login`.
- Dark theme with mint-green (`emerald-300`) accent — see [UI_DOC.md](UI_DOC.md) for design tokens.
