-- Migration 007: merge sick + vacation into off ("On Leave" / 休假).
-- Keeps the enum value `off`; drops unused sick/vacation values.

-- 1. Collapse existing rows
update public.daily_logs
set status = 'off'
where status in ('sick', 'vacation');

-- 2. Rebuild the enum without sick/vacation
alter type work_status rename to work_status_old;

create type work_status as enum ('in_office', 'wfh', 'off');

alter table public.daily_logs
  alter column status drop default,
  alter column status type work_status using status::text::work_status,
  alter column status set default 'in_office'::work_status;

drop type work_status_old;
