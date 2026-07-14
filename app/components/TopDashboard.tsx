'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/utils/supabase/client'
import type { Profile } from '@/types/supabase'
import { ThemeToggle } from '@/components/theme-toggle'
import { useLocale } from '@/app/components/locale-provider'

interface Props {
  date: string
  initialProfiles: Profile[]
  onEditProfile: () => void
}

export default function TopDashboard({ date, initialProfiles, onEditProfile }: Props) {
  const { locale, localeTag, toggleLocale, t } = useLocale()
  const supabase = createClient()
  const router = useRouter()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [supabase])

  const currentProfile = currentUserId ? initialProfiles.find((p) => p.id === currentUserId) : null

  const displayDate = new Date(`${date}T12:00:00`).toLocaleDateString(localeTag, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/10 p-3">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold tracking-tight text-foreground">{displayDate}</h1>
        {currentUserId && (
          <div className="flex items-center gap-3">
            <button
              onClick={onEditProfile}
              className="flex items-center gap-2 rounded-full border border-border/20 bg-muted py-1 pl-1 pr-3 text-sm font-medium text-muted-foreground transition-all hover:border-border/50 hover:text-foreground"
              title={t('editProfile')}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card ring-1 ring-border/40 text-[10px] font-semibold">
                {currentProfile?.avatar_url ? (
                  <img
                    src={currentProfile.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (currentProfile?.name || currentProfile?.email || '?').trim().charAt(0).toUpperCase()
                )}
              </span>
              <span className="truncate max-w-[140px]">
                {currentProfile?.name || currentProfile?.email || t('setName')}
              </span>
            </button>
            {currentProfile?.is_admin && (
              <Link
                href="/admin"
                className="rounded-full border border-border/20 bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:border-border/50 hover:text-foreground"
              >
                Admin
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="rounded-full border border-border/20 bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:border-border/50 hover:text-foreground"
            >
              {t('signOut')}
            </button>
            <button
              onClick={toggleLocale}
              className="rounded-full border border-border/20 bg-muted px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground transition-all hover:border-border/50 hover:text-foreground"
              aria-label={locale === 'en' ? 'Switch to Chinese' : '切换到英文'}
              title={locale === 'en' ? 'Switch to Chinese' : '切换到英文'}
            >
              {locale === 'en' ? '中文' : 'English'}
            </button>
            <ThemeToggle />
          </div>
        )}
      </div>
    </div>
  )
}
