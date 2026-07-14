'use client'

import { useState } from 'react'
import { cn, getInitials } from '@/lib/utils'
import type { Profile, DailyLog, WorkStatus } from '@/types/supabase'
import { normalizeWorkStatus } from '@/types/supabase'
import { useLocale } from '@/app/components/locale-provider'
import type { TranslationKey } from '@/app/components/locale-provider'

type ExtendedStatus = WorkStatus | 'unknown'
type StatusTone = 'in_office' | 'wfh' | 'off' | 'unknown'

const STATUS_COLORS: Record<
  StatusTone,
  { text: string; chip: string; chipActive: string; dot: string; avatar: string; ring: string }
> = {
  in_office: {
    text: 'text-[var(--status-emerald-text)]',
    chip: 'bg-[var(--status-emerald-bg)]/15 text-[var(--status-emerald-text)] hover:bg-[var(--status-emerald-bg)]/25',
    chipActive:
      'bg-[var(--status-emerald-bg)]/30 text-[var(--status-emerald-text)] ring-1 ring-[var(--status-emerald-border)]/40',
    dot: 'bg-[var(--status-emerald-dot)]',
    avatar: 'bg-[var(--status-emerald-bg)]/20 text-[var(--status-emerald-text)]',
    ring: 'ring-[var(--status-emerald-bg)]/70',
  },
  wfh: {
    text: 'text-[var(--status-sky-text)]',
    chip: 'bg-[var(--status-sky-bg)]/15 text-[var(--status-sky-text)] hover:bg-[var(--status-sky-bg)]/25',
    chipActive:
      'bg-[var(--status-sky-bg)]/30 text-[var(--status-sky-text)] ring-1 ring-[var(--status-sky-border)]/40',
    dot: 'bg-[var(--status-sky-dot)]',
    avatar: 'bg-[var(--status-sky-bg)]/20 text-[var(--status-sky-text)]',
    ring: 'ring-[var(--status-sky-bg)]/70',
  },
  off: {
    text: 'text-[var(--status-zinc-text)]',
    chip: 'bg-[var(--status-zinc-bg)]/15 text-[var(--status-zinc-text)] hover:bg-[var(--status-zinc-bg)]/25',
    chipActive:
      'bg-[var(--status-zinc-bg)]/30 text-[var(--status-zinc-text)] ring-1 ring-[var(--status-zinc-border)]/40',
    dot: 'bg-[var(--status-zinc-dot)]',
    avatar: 'bg-[var(--status-zinc-bg)]/20 text-[var(--status-zinc-text)]',
    ring: 'ring-[var(--status-zinc-bg)]/70',
  },
  unknown: {
    text: 'text-[var(--status-rose-text)]',
    chip: 'bg-[var(--status-rose-bg)]/15 text-[var(--status-rose-text)] hover:bg-[var(--status-rose-bg)]/25',
    chipActive:
      'bg-[var(--status-rose-bg)]/30 text-[var(--status-rose-text)] ring-1 ring-[var(--status-rose-border)]/40',
    dot: 'bg-[var(--status-rose-dot)]',
    avatar: 'bg-[var(--status-rose-bg)]/20 text-[var(--status-rose-text)]',
    ring: 'ring-[var(--status-rose-bg)]/70',
  },
}

const STATUS_ORDER: ExtendedStatus[] = ['in_office', 'wfh', 'off', 'unknown']

const getStatusTone = (status: ExtendedStatus): StatusTone => {
  if (status === 'in_office' || status === 'wfh' || status === 'unknown') return status
  return 'off'
}

const getStatusLabel = (status: ExtendedStatus, t: (key: TranslationKey) => string) => {
  switch (status) {
    case 'in_office':
      return t('statusInOffice')
    case 'wfh':
      return t('statusWfh')
    case 'off':
      return t('statusOff')
    default:
      return t('notLogged')
  }
}

const displayNameOf = (profile: Profile) => profile.name || profile.email.split('@')[0]

const sortByName = (a: Profile, b: Profile) =>
  displayNameOf(a).localeCompare(displayNameOf(b), undefined, { sensitivity: 'base' })

interface Props {
  initialProfiles: Profile[]
  logs: DailyLog[]
  className?: string
}

export default function StatusSummaryCards({ initialProfiles, logs, className }: Props) {
  const { t } = useLocale()
  const [filter, setFilter] = useState<ExtendedStatus | null>(null)

  const grouped = STATUS_ORDER.reduce<Record<ExtendedStatus, Profile[]>>(
    (acc, status) => ({ ...acc, [status]: [] }),
    {} as Record<ExtendedStatus, Profile[]>
  )
  for (const profile of initialProfiles) {
    const log = logs.find((l) => l.user_id === profile.id)
    const status: ExtendedStatus = log ? normalizeWorkStatus(log.status) : 'unknown'
    grouped[status].push(profile)
  }
  for (const status of STATUS_ORDER) {
    grouped[status].sort(sortByName)
  }

  const visible = (filter ? [filter] : STATUS_ORDER).filter((status) => grouped[status].length > 0)

  const toggleFilter = (status: ExtendedStatus) => {
    setFilter((prev) => (prev === status ? null : status))
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col gap-2.5 rounded-2xl border border-border bg-card p-2.5 shadow-sm',
        className
      )}
    >
      <div className="flex flex-wrap gap-1">
        {STATUS_ORDER.map((status) => {
          const count = grouped[status].length
          const tone = STATUS_COLORS[getStatusTone(status)]
          const isActive = filter === status
          const isDimmed = filter !== null && !isActive

          return (
            <button
              key={status}
              type="button"
              onClick={() => toggleFilter(status)}
              aria-pressed={isActive}
              title={isActive ? t('showAllStatuses') : getStatusLabel(status, t)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-all',
                count > 0
                  ? isActive
                    ? tone.chipActive
                    : tone.chip
                  : 'bg-muted/40 text-muted-foreground/50',
                isDimmed && 'opacity-40',
                count === 0 && 'pointer-events-none'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  count > 0 ? tone.dot : 'bg-muted-foreground/30'
                )}
              />
              <span className="text-[10px] font-semibold leading-none">
                {getStatusLabel(status, t)}
              </span>
              <span
                className={cn(
                  'tabular-nums text-[11px] font-bold leading-none',
                  count > 0 ? 'opacity-90' : 'opacity-50'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {visible.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {visible.map((status) => {
            const tone = STATUS_COLORS[getStatusTone(status)]
            const people = grouped[status]

            return (
              <div key={status} className="min-w-0">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wide',
                      tone.text
                    )}
                  >
                    {getStatusLabel(status, t)}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground/70">
                    {people.length}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {people.map((profile) => {
                    const userLog = logs.find((l) => l.user_id === profile.id)
                    const hasNoTasks =
                      !userLog?.activities?.trim() &&
                      (status === 'in_office' || status === 'wfh')
                    const displayName = displayNameOf(profile)
                    const initials = getInitials(displayName)

                    return (
                      <div
                        key={profile.id}
                        title={
                          hasNoTasks
                            ? `${profile.email} · ${t('noTasksYet')}`
                            : profile.email
                        }
                        className={cn(
                          'inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/35 py-0.5 pl-0.5 pr-2',
                          status === 'unknown' && 'opacity-90',
                          hasNoTasks && 'bg-[var(--status-amber-bg)]/10'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full text-[8px] font-semibold ring-1',
                            tone.ring,
                            !profile.avatar_url && tone.avatar,
                            status === 'unknown' && 'animate-pulse'
                          )}
                        >
                          {profile.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            initials
                          )}
                        </div>
                        <span
                          className={cn(
                            'truncate text-[11px] font-medium leading-none text-foreground/85',
                            hasNoTasks && 'text-[var(--status-amber-text)]'
                          )}
                        >
                          {displayName}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          —
        </div>
      )}
    </div>
  )
}
