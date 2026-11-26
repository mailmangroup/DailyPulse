'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, CheckCheck, Eraser, PanelRightOpen, ListTodo, Copy, Check } from 'lucide-react'
import { createClient } from '@/app/utils/supabase/client'
import { cn } from '@/lib/utils'
import { normalizeChecklistValue } from '@/lib/checklist'
import { createChecklistSyncController, type ChecklistSyncController } from '@/lib/checklist-save-sync'
import type { DailyLog, WorkStatus } from '@/types/supabase'
import { normalizeWorkStatus } from '@/types/supabase'
import { useLocale } from '@/app/components/locale-provider'
import type { TranslationKey } from '@/app/components/locale-provider'
import { ChecklistEditor, parseChecklist, serializeChecklist, hasChecklistItems } from './Checklist'

interface Props {
  currentUserId: string | null
  date: string
}

const STATUS_DOT: Record<WorkStatus, string> = {
  in_office: 'bg-[var(--status-emerald-dot)]',
  wfh: 'bg-[var(--status-sky-dot)]',
  off: 'bg-[var(--status-zinc-dot)]',
}

const getStatusLabel = (status: WorkStatus, t: (key: TranslationKey) => string) => {
  switch (normalizeWorkStatus(status)) {
    case 'in_office': return t('statusInOffice')
    case 'wfh': return t('statusWfh')
    case 'off': return t('statusOff')
  }
}

const countTasks = (activities: string | null) => {
  const items = parseChecklist(activities ?? '').filter((i) => i.text.trim())
  return { total: items.length, done: items.filter((i) => i.checked).length }
}

export default function MyMonthDrawer({ currentUserId, date }: Props) {
  const { localeTag, t } = useLocale()
  const [supabase] = useState(() => createClient())
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(false)
  const [copiedLogId, setCopiedLogId] = useState<number | null>(null)
  const syncControllersRef = useRef<Map<number, ChecklistSyncController>>(new Map())
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const base = useMemo(() => new Date(`${date}T00:00:00`), [date])
  const [viewYear, setViewYear] = useState(base.getFullYear())
  const [viewMonth, setViewMonth] = useState(base.getMonth())

  // Keep the drawer's month in sync with the page's date when it changes.
  useEffect(() => {
    setViewYear(base.getFullYear())
    setViewMonth(base.getMonth())
  }, [base])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const load = useCallback(async () => {
    if (!currentUserId) return
    setLoading(true)
    const startDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`
    const endDate = new Date(viewYear, viewMonth + 1, 0).toLocaleDateString('en-CA')
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', currentUserId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
    const filtered = (data ?? []).filter((l) => hasChecklistItems(l.activities))
    for (const existing of syncControllersRef.current.values()) {
      existing.resetContext('invalidated', '')
    }
    syncControllersRef.current.clear()
    for (const log of filtered) {
      const controller = createChecklistSyncController({
        normalize: normalizeChecklistValue,
      })
      controller.resetContext(String(log.id), log.activities)
      syncControllersRef.current.set(log.id, controller)
    }
    setLogs(filtered)
    setLoading(false)
  }, [currentUserId, viewYear, viewMonth, supabase])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const handleDraftChange = useCallback((logId: number, activities: string) => {
    const normalized = normalizeChecklistValue(activities)
    let controller = syncControllersRef.current.get(logId)
    if (!controller) {
      controller = createChecklistSyncController({
        normalize: normalizeChecklistValue,
      })
      syncControllersRef.current.set(logId, controller)
    }
    controller.onLocalEdit(normalized)
    setLogs((prev) =>
      prev.map((l) => (l.id === logId ? { ...l, activities: normalized } : l))
    )
  }, [])

  const persist = useCallback(async (logId: number, activities: string) => {
    const normalized = normalizeChecklistValue(activities)
    let controller = syncControllersRef.current.get(logId)
    if (!controller) {
      controller = createChecklistSyncController({
        normalize: normalizeChecklistValue,
      })
      syncControllersRef.current.set(logId, controller)
    }
    controller.onLocalEdit(normalized)

    await controller.requestSave(normalized, async (valueToSave, isCurrent) => {
      const { data, error } = await supabase
        .from('daily_logs')
        .update({ activities: valueToSave, updated_at: new Date().toISOString() })
        .eq('id', logId)
        .select()
        .single()

      if (error || !data) {
        console.error('Save error:', error)
        return false
      }

      if (isCurrent()) {
        const currentDraft = controller.getState().draftValue
        const hasNewerDraft = currentDraft !== valueToSave
        setLogs((prev) =>
          prev.map((l) => {
            if (l.id !== data.id) return l
            return hasNewerDraft ? { ...data, activities: currentDraft } : data
          })
        )
      }
      return true
    })
  }, [supabase])

  const setDayChecked = useCallback(async (log: DailyLog, checked: boolean) => {
    const items = parseChecklist(log.activities ?? '').filter((i) => i.text.trim())
    const next = serializeChecklist(items.map((i) => ({ ...i, checked })))
    // Optimistic update so the UI (and the editor) reflect the change instantly.
    handleDraftChange(log.id, next)
    await persist(log.id, next)
  }, [handleDraftChange, persist])

  const handleCopyDay = useCallback(async (log: DailyLog) => {
    const text = normalizeChecklistValue(log.activities)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedLogId(log.id)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopiedLogId(null), 1500)
    } catch (error) {
      console.error('Copy error:', error)
    }
  }, [])

  const setAllChecked = useCallback(async (checked: boolean) => {
    const targets = logs.filter((l) => {
      const { total, done } = countTasks(l.activities)
      return checked ? done < total : done > 0
    })
    await Promise.all(targets.map((l) => setDayChecked(l, checked)))
  }, [logs, setDayChecked])

  const { totalTasks, doneTasks } = useMemo(() => {
    let total = 0
    let done = 0
    for (const l of logs) {
      const c = countTasks(l.activities)
      total += c.total
      done += c.done
    }
    return { totalTasks: total, doneTasks: done }
  }, [logs])

  const goPrevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11) }
    else setViewMonth((m) => m - 1)
  }
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0) }
    else setViewMonth((m) => m + 1)
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(localeTag, {
    month: 'long',
    year: 'numeric',
  })

  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const allDone = totalTasks > 0 && doneTasks === totalTasks

  if (!currentUserId) return null

  return (
    <>
      {/* Edge handle */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('myMonth')}
        className={cn(
          'group fixed right-0 top-1/2 z-30 -translate-y-1/2 flex flex-col items-center gap-2 rounded-l-2xl border border-r-0 border-primary/30 bg-primary py-4 pl-2.5 pr-2 text-primary-foreground shadow-lg transition-all duration-300 hover:pr-3.5',
          open && 'pointer-events-none translate-x-full opacity-0'
        )}
      >
        <PanelRightOpen className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        <span className="text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl]">
          {t('myMonth')}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="fixed right-0 top-0 z-50 flex h-screen w-[440px] max-w-[92vw] flex-col border-l border-border bg-card shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/30 text-primary shrink-0">
                  <ListTodo className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold leading-tight text-foreground">{t('myMonth')}</h2>
                  <p className="text-xs text-muted-foreground leading-tight">{t('myMonthSubtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Month nav + progress */}
              <div className="border-b border-border px-4 py-3 shrink-0 space-y-3">
                <div className="flex items-center justify-between rounded-full bg-muted p-1">
                  <button
                    onClick={goPrevMonth}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-medium">{monthLabel}</span>
                  <button
                    onClick={goNextMonth}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {totalTasks > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn('font-semibold tabular-nums', allDone ? 'text-[var(--status-emerald-text)]' : 'text-foreground')}>
                        {allDone ? t('allDone') : `${doneTasks}/${totalTasks} ${t('done')}`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setAllChecked(true)}
                          disabled={allDone}
                          className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40 disabled:hover:bg-primary/10"
                        >
                          <CheckCheck className="h-3 w-3" />
                          {t('checkAll')}
                        </button>
                        <button
                          onClick={() => setAllChecked(false)}
                          disabled={doneTasks === 0}
                          className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:opacity-40"
                        >
                          <Eraser className="h-3 w-3" />
                          {t('clearAll')}
                        </button>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className={cn('h-full rounded-full', allDone ? 'bg-[var(--status-emerald-dot)]' : 'bg-primary')}
                        initial={false}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="visible-scrollbar flex-1 min-h-0 overflow-y-auto px-4 py-4">
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-2 animate-pulse">
                        <div className="h-3 w-28 rounded bg-muted" />
                        <div className="h-16 rounded-lg bg-muted" />
                      </div>
                    ))}
                  </div>
                ) : logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ListTodo className="mb-2 h-8 w-8 opacity-40" />
                    <p className="text-sm">{t('noPersonalTasksThisMonth')}</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {logs.map((log) => {
                      const dateObj = new Date(`${log.date}T00:00:00`)
                      const dateLabel = dateObj.toLocaleDateString(localeTag, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                      const { total, done } = countTasks(log.activities)
                      const dayDone = total > 0 && done === total
                      return (
                        <div key={log.id}>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-sm font-semibold text-primary">{dateLabel}</span>
                            <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[normalizeWorkStatus(log.status)])} />
                              {getStatusLabel(log.status, t)}
                            </span>
                            <div className="h-px flex-1 bg-border" />
                            <span className={cn('text-xs tabular-nums', dayDone ? 'text-[var(--status-emerald-text)] font-semibold' : 'text-muted-foreground')}>
                              {done}/{total}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => void handleCopyDay(log)}
                                disabled={total === 0}
                                title={copiedLogId === log.id ? t('copied') : t('copyTasks')}
                                className={cn(
                                  'flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent',
                                  copiedLogId === log.id
                                    ? 'text-[var(--status-emerald-text)] bg-[var(--status-emerald-bg)]/20'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                              >
                                {copiedLogId === log.id ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => setDayChecked(log, true)}
                                disabled={dayDone}
                                title={t('markAllDone')}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent"
                              >
                                <CheckCheck className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDayChecked(log, false)}
                                disabled={done === 0}
                                title={t('clearDay')}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                              >
                                <Eraser className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
                            <ChecklistEditor
                              value={log.activities ?? ''}
                              onChange={(v) => handleDraftChange(log.id, v)}
                              onSave={(v) => void persist(log.id, v)}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
