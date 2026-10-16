-- 141 · 대시보드 실시간 — 「몇 시에 앱을 열었나」 (2026-10-16)
-- 사용자: 「대시보드 실시간에서 어플 연 시간도 체크할 수 있게」
--
-- ⚠ «누가» 열었는지는 안 남깁니다. 한 시간마다 숫자 하나(그 시간에 앱을 연 횟수)만 올립니다.
--   앱 연 날(user_days, db/112)은 날짜만 남기기로 처리방침 4항에 적었습니다 — 거기에 시각을 붙이면 «누가 몇 시에»가 되므로
--   따로 이름 없는 숫자 표를 둡니다(계정 아이디·IP·기기 아무것도 없음 → 처리방침은 그대로).
--   앱은 기기마다 한 시간에 한 번만 보냅니다(dayseen.js) — 그래서 숫자 ≈ 그 시간에 앱을 연 사람(기기) 수.
--   관리자·「로기」(stat_skip, db/131)는 안 셉니다 — 받는 쪽에서 거릅니다(누군지 보기만 하고 적지 않음).
-- 400일 지난 줄은 지웁니다(앱 연 날과 같은 자).
-- 여러 번 실행해도 안전합니다.

create table if not exists public.open_hours (
  hour timestamptz primary key,          -- 그 시간의 시작(정각)
  n    int not null default 0
);
alter table public.open_hours enable row level security;
-- (정책 없음 = 앱이 표를 직접 못 읽고 못 씀. 아래 함수만.)

-- ── 앱이 부름 — 이 시간 숫자를 하나 올림 ────────────────────────────────
create or replace function public.touch_hour()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.stat_skip where user_id = auth.uid()) then return; end if;
  insert into public.open_hours (hour, n) values (date_trunc('hour', now()), 1)
  on conflict (hour) do update set n = public.open_hours.n + 1;
  -- 오래된 줄 치우기 — 백 번에 한 번쯤만(매번 할 일은 아님)
  if random() < 0.01 then
    delete from public.open_hours where hour < now() - interval '400 days';
  end if;
end $$;
revoke all on function public.touch_hour() from public, anon;
grant execute on function public.touch_hour() to authenticated;

-- ── 관리자 대시보드 — 최근 N시간(기본 48) ─────────────────────────────────
create or replace function public.admin_open_hours(p_hours int default 48)
returns table (hour timestamptz, n int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있어요'; end if;
  return query
    select o.hour, o.n from public.open_hours o
     where o.hour >= date_trunc('hour', now()) - make_interval(hours => greatest(1, least(coalesce(p_hours, 48), 24 * 400)) - 1)
     order by o.hour;
end $$;
revoke all on function public.admin_open_hours(int) from public, anon;
grant execute on function public.admin_open_hours(int) to authenticated;

-- ── 확인: 셋 다 true 면 된 것 ───────────────────────────────────────────
select to_regclass('public.open_hours') is not null                         as 시간표,
       to_regprocedure('public.touch_hour()') is not null                   as 올리기,
       to_regprocedure('public.admin_open_hours(integer)') is not null      as 대시보드_읽기;
