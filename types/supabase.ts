export type WorkStatus = 'in_office' | 'wfh' | 'off'

/** Map legacy sick/vacation rows to off (On Leave) until migration 007 is applied. */
export function normalizeWorkStatus(status: string): WorkStatus {
  if (status === 'in_office' || status === 'wfh' || status === 'off') return status
  return 'off'
}

export interface Profile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  is_admin: boolean
  is_hidden: boolean
  created_at: string
}

export interface DailyLog {
  id: number
  user_id: string
  date: string
  status: WorkStatus
  activities: string | null
  activities_at: string | null
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
      }
      daily_logs: {
        Row: DailyLog
      }
    }
    Enums: {
      work_status: WorkStatus
    }
    Functions: {
      get_last_active_date: {
        Args: {
          min_logs: number
          current_date_str: string
        }
        Returns: string | null
      }
    }
  }
}
