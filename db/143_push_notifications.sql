-- 143 · 앱 안 알림을 폰 푸시로 (2026-10-17)
-- 사용자: 방명록·답글 알림을 폰 푸시로 → 「다 푸시 알림 가게 해야지」(좋아요·여행 변경까지 전부).
-- 바꾼 것: due_pushes(137 의 판 그대로) 맨 끝에 «새 알림» 줄을 붙임. push 함수(Edge)는 안 고침 —
--   due_pushes 가 주는 (user_id, kind, ref_id, title, body, url) 을 그대로 보내고 push_log 에 적습니다.
--   5분마다(137 의 pg_cron) 돌므로 늦으면 5분쯤.
-- ⚠ 속 함수는 «마지막으로 만든 파일» 바탕으로(관리자 조절 화면 메모) — 이 파일은 137 의 due_pushes 를 그대로 복사해 끝만 더함.
-- 여러 번 실행해도 안전합니다(create or replace). 되돌리려면 137 을 다시 돌리면 됩니다(예약 줄도 같이 다시 걸림 — 그래도 괜찮음).

create or replace function public.due_pushes(p_window interval default '20 minutes')
returns table (user_id uuid, kind text, ref_id uuid,
               title text, body text, url text)
language sql security definer set search_path = public as $$
  with sw as (
    select coalesce((select (value->>'on')::boolean
                       from public.app_settings where key='push_on'), true) as enabled
  ),
  mine as (
    select m.user_id, t.id as trip_id, t.title as trip_title,
           t.start_date as trip_start,
           coalesce(nullif(t.timezone, ''), 'UTC') as tz,
           coalesce(nullif(p.home_tz, ''), nullif(t.timezone, ''), 'UTC') as home_tz,
           coalesce(p.notify_plan, 'first') as want_plan,
           coalesce(p.notify_flight, true)  as want_flight
      from public.trip_members m
      join public.trips t on t.id = m.trip_id
      left join public.user_prefs p on p.user_id = m.user_id
     where m.left_at is null
       and coalesce(p.notify_all, true)
       and (select enabled from sw)
  ),
  p as (
    select mine.user_id, 'plan'::text as kind, pl.id as ref_id,
           pl.title as title,
           to_char((pl.date + pl.start_time), 'HH24:MI') || ' · ' || mine.trip_title as body,
           ((pl.date + pl.start_time) at time zone mine.tz) as at,
           mine.trip_id, pl.date as on_date, mine.want_plan,
           row_number() over (partition by mine.user_id, pl.trip_id, pl.date
                              order by pl.start_time) as nth
      from public.plans pl
      join mine on mine.trip_id = pl.trip_id
     where pl.deleted_at is null and pl.start_time is not null
       and mine.want_plan <> 'off'
  ),
  f as (
    select mine.user_id, 'flight'::text as kind, b.id as ref_id,
           b.title as title,
           to_char((b.start_date + b.start_time), 'HH24:MI') || ' 출발' as body,
           ((b.start_date + b.start_time) at time zone
              case when b.start_date <= mine.trip_start then mine.home_tz
                   else coalesce((select coalesce(nullif(c.timezone, ''), mine.tz)
                                    from public.trip_legs l
                                    join public.cities c on c.id = l.city_id
                                   where l.trip_id = mine.trip_id
                                     and b.start_date between l.start_date and l.end_date
                                   order by l.start_date limit 1), mine.tz)
              end) as at,
           mine.trip_id, b.start_date as on_date
      from public.bookings b
      join mine on mine.trip_id = b.trip_id
     where b.deleted_at is null and b.kind = '항공'
       and b.start_date is not null and b.start_time is not null
       and mine.want_flight
  ),
  -- fire: 울릴 때 · send_until: 이때가 지나면 보내 봐야 소용없음(일정 5분 전 · 항공 90분 전)
  all_rows as (
    select user_id, kind, ref_id, title, body, trip_id, on_date,
           at - interval '30 minutes' as fire, at - interval '5 minutes' as send_until
      from p where want_plan = 'all' or nth = 1
    union all
    select user_id, kind, ref_id, title, body, trip_id, on_date,
           at - interval '3 hours' as fire, at - interval '90 minutes' as send_until
      from f
  )
  select a.user_id, a.kind, a.ref_id,
         a.title,
         a.body || case when a.kind = 'plan' then
                          case when now() >= a.fire + interval '10 minutes' then ' · 곧 시작해요'
                               else ' · 30분 뒤예요' end
                        else ' · 슬슬 나가실 시간이에요' end,
         './?t=' || a.trip_id::text || '&d=' || a.on_date::text
    from all_rows a
   where a.fire <= now() and now() < a.send_until
     and not exists (select 1 from public.push_log g
                      where g.user_id = a.user_id and g.kind = a.kind
                        and g.ref_id = a.ref_id)
  union all
  -- ── 앱 안 알림(♡ 목록)도 폰 푸시로(143) ──────────────────────────────
  -- 방명록·답글·좋아요·팔로우·여행 변경… notifications 에 새로 생긴 줄 «전부»(사용자: 「다 푸시 알림 가게 해야지」).
  -- 종류별로 끈 사람은 애초에 줄이 안 생깁니다(notify_wants — 넣는 쪽이 거름). 「알림 끄기 전체」(notify_all)·관리자 스위치는 여기서.
  -- 최근 30분 안의 «안 읽은» 것만 — 처음 켜는 날 옛 알림이 한꺼번에 쏟아지지 않게, 이미 앱에서 본 것은 안 보내게.
  -- push_log 의 ref_id 가 uuid 라 알림 번호(bigint)를 md5 로 uuid 를 만들어 «한 번만» 보냅니다. 누르면 ./?n=1 → 앱이 알림 목록을 엶.
  select n.user_id, 'n:' || n.kind, md5('notif:' || n.id::text)::uuid,
         '기로'::text, n.body, './?n=1'::text
    from public.notifications n
    left join public.user_prefs up on up.user_id = n.user_id
   where (select enabled from sw)
     and coalesce(up.notify_all, true)
     and n.read_at is null
     and n.created_at > now() - interval '30 minutes'
     and not exists (select 1 from public.push_log g
                      where g.user_id = n.user_id and g.kind = 'n:' || n.kind
                        and g.ref_id = md5('notif:' || n.id::text)::uuid);
$$;
revoke execute on function public.due_pushes(interval) from anon, authenticated;

-- 확인: true 면 된 것
select pg_get_functiondef('public.due_pushes(interval)'::regprocedure) like '%notifications%' as 알림_푸시;
