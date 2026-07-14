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
  {
    text: string
    soft: string
    softActive: string
    dot: string
    avatar: string
    ring: string
    bar: string
  }
> = {
  in_office: {
    text: 'text-[var(--status-emerald-text)]',
    soft: 'hover:bg-[var(--status-emerald-bg)]/10',
    softActive: 'bg-[var(--status-emerald-bg)]/15 ring-1 ring-[var(--status-emerald-border)]/35',
    dot: 'bg-[var(--status-emerald-dot)]',
    avatar: 'bg-[var(--status-emerald-bg)]/20 text-[var(--status-emerald-text)]',
    ring: 'ring-[var(--status-emerald-bg)]/60',
    bar: 'bg-[var(--status-emerald-dot)]',
  },
  wfh: {
    text: 'text-[var(--status-sky-text)]',
    soft: 'hover:bg-[var(--status-sky-bg)]/10',
    softActive: 'bg-[var(--status-sky-bg)]/15 ring-1 ring-[var(--status-sky-border)]/35',
    dot: 'bg-[var(--status-sky-dot)]',
    avatar: 'bg-[var(--status-sky-bg)]/20 text-[var(--status-sky-text)]',
    ring: 'ring-[var(--status-sky-bg)]/60',
    bar: 'bg-[var(--status-sky-dot)]',
  },
  off: {
    text: 'text-[var(--status-zinc-text)]',
    soft: 'hover:bg-[var(--status-zinc-bg)]/10',
    softActive: 'bg-[var(--status-zinc-bg)]/15 ring-1 ring-[var(--status-zinc-border)]/35',
    dot: 'bg-[var(--status-zinc-dot)]',
    avatar: 'bg-[var(--status-zinc-bg)]/20 text-[var(--status-zinc-text)]',
    ring: 'ring-[var(--status-zinc-bg)]/60',
    bar: 'bg-[var(--status-zinc-dot)]',
  },
  unknown: {
    text: 'text-[var(--status-rose-text)]',
    soft: 'hover:bg-[var(--status-rose-bg)]/10',
    softActive: 'bg-[var(--status-rose-bg)]/15 ring-1 ring-[var(--status-rose-border)]/35',
    dot: 'bg-[var(--status-rose-dot)]',
    avatar: 'bg-[var(--status-rose-bg)]/20 text-[var(--status-rose-text)]',
    ring: 'ring-[var(--status-rose-bg)]/60',
    bar: 'bg-[var(--status-rose-dot)]',
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
  const totalPeople = initialProfiles.length

  const toggleFilter = (status: ExtendedStatus) => {
    setFilter((prev) => (prev === status ? null : status))
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm',
        className
      )}
    >
      <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border/50 bg-border/40 sm:grid-cols-4">
        {STATUS_ORDER.map((status) => {
          const count = grouped[status].length
          const tone = STATUS_COLORS[getStatusTone(status)]
          const isActive = filter === status
          const isDimmed = filter !== null && !isActive
          const hasPeople = count > 0

          return (
            <button
              key={status}
              type="button"
              onClick={() => hasPeople && toggleFilter(status)}
              aria-pressed={isActive}
              disabled={!hasPeople}
              title={
                !hasPeople
                  ? getStatusLabel(status, t)
                  : isActive
                    ? t('showAllStatuses')
                    : getStatusLabel(status, t)
              }
              className={cn(
                'relative flex flex-col items-start gap-1 bg-card px-3 py-2.5 text-left transition-all',
                hasPeople ? tone.soft : 'cursor-default',
                isActive && tone.softActive,
                isDimmed && 'opacity-35',
                !hasPeople && 'opacity-40'
              )}
            >
              {isActive && (
                <span
                  className={cn('absolute inset-x-0 top-0 h-0.5 rounded-b-full', tone.bar)}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  'text-[10px] font-medium leading-none tracking-wide text-muted-foreground',
                  isActive && tone.text
                )}
              >
                {getStatusLabel(status, t)}
              </span>
              <span
                className={cn(
                  'flex items-center gap-1.5 tabular-nums text-lg font-semibold leading-none tracking-tight',
                  hasPeople ? 'text-foreground' : 'text-muted-foreground/50',
                  isActive && tone.text
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    hasPeople ? tone.dot : 'bg-muted-foreground/30'
                  )}
                />
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {visible.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-3.5">
          {visible.map((status) => {
            const tone = STATUS_COLORS[getStatusTone(status)]
            const people = grouped[status]
            const showHeader = filter === null && visible.length > 1

            return (
              <div key={status} className="min-w-0">
                {showHeader && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
                    <span className={cn('text-xs font-medium', tone.text)}>
                      {getStatusLabel(status, t)}
                    </span>
                    <span className="h-px flex-1 bg-border/50" />
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {people.length}
                      {totalPeople > 0 ? `/${totalPeople}` : ''}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-1.5">
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
                          'flex min-w-0 items-center gap-2 rounded-lg bg-muted/30 px-1.5 py-1.5 transition-colors hover:bg-muted/50',
                          status === 'unknown' && 'bg-[var(--status-rose-bg)]/8',
                          hasNoTasks && 'bg-[var(--status-amber-bg)]/10'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-semibold ring-1',
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
                            'min-w-0 truncate text-[12px] font-medium leading-tight text-foreground/90',
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
