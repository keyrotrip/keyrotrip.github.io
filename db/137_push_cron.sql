-- =====================================================================
-- 잠금화면 알림을 «제때» 부르기 — Supabase 안의 예약(pg_cron)으로 5분마다 (2026-10-16)
--
-- 왜: 알림을 부르는 GitHub 예약(push.yml, «15분마다»)이 실제로는 2시간 10분 ~ 9시간 40분 간격
--     (가운데 4시간 48분, 10-01~10-16 실행 71번 실측 · 35분 이하 0번)이었습니다. 일정 알림은 «30분 전»에
--     울리고 서버는 그때부터 20분 안에 불려야 보내므로, 이대로면 여행 중 일정 알림의 90% 넘게가 안 나갑니다.
--     (지난 30일엔 진행 중인 여행이 없어 아직 빠진 알림은 0 — 앞으로의 일입니다.)
--     063 머리말의 «pg_cron 은 이 등급에 없다»는 옛 판단입니다. 10-16 에 Extensions 목록에서 확인했습니다.
--
-- 하는 일 셋
--   1. due_pushes: «20분 지나면 버림» → «일정 5분 전까지는 늦어도 보냄»(항공은 90분 전까지).
--      늦게 보내는 일정 알림은 «30분 뒤예요» 대신 «곧 시작해요». 같은 것을 두 번 안 보내는 것(push_log)은 그대로.
--   2. 5분마다 push 함수를 부르는 예약 «keyro-push». 열쇠는 Vault 의 push_cron_secret 에서 꺼냅니다
--      (이 파일·SQL 기록에 비밀값이 안 남게).
--   3. 맨 아래 확인 표.
--
-- ⚠ 실행 전에 할 것(대시보드에서, 순서 상관없음):
--   a. Database → Extensions 에서 pg_cron · pg_net 둘 다 켜기
--   b. Vault(Integrations → Vault, 또는 Project Settings → Vault)에 새 비밀:
--      이름 push_cron_secret · 값 = Edge Functions Secrets 의 PUSH_CRON_SECRET 과 «같은 값»
--   c. Edge Functions → push → 설정의 «Verify JWT (Enforce JWT verification)» 가 켜져 있으면 끄기.
--      예약은 JWT 없이 x-cron-secret 머리만 보냅니다. push 함수가 그 열쇠를 글자까지 견주므로(b881) 꺼도 안전합니다.
--      켜 둔 채면 게이트웨이가 401 로 막습니다 — 아래 «확인 2»에서 401 이 보이면 이것입니다.
--   빠진 게 있으면 이 파일은 아무것도 안 바꾸고 무엇이 빠졌는지 말하며 멈춥니다.
--
-- 바탕: due_pushes 는 066 의 것(마지막 판)에서 맨 끝 거르기와 문구만 바꿨습니다. 여러 번 실행해도 안전합니다.
-- GitHub 예약(push.yml)은 이것이 도는 것을 확인한 뒤 걷습니다 — 그때까지 둘이 같이 돌아도 push_log 가 겹침을 막습니다.
-- =====================================================================

-- ── 0. 준비됐나 ─────────────────────────────────────────────────────────
do $$
declare 빠짐 text := '';
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then 빠짐 := 빠짐 || ' · pg_cron 켜기(Database → Extensions)'; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net')  then 빠짐 := 빠짐 || ' · pg_net 켜기(Database → Extensions)'; end if;
  -- 한 식에 묶으면 vault 가 없을 때 표 이름부터 못 찾아 엉뚱한 오류로 죽습니다 — 나눠서 봅니다.
  if to_regclass('vault.decrypted_secrets') is null then
    빠짐 := 빠짐 || ' · Vault 켜기(Integrations → Vault)';
  elsif not exists (select 1 from vault.secrets where name = 'push_cron_secret') then
    빠짐 := 빠짐 || ' · Vault 에 push_cron_secret 넣기(값 = PUSH_CRON_SECRET 과 같게)';
  end if;
  if 빠짐 <> '' then
    raise exception '아직 준비 안 됨%', 빠짐;
  end if;
end $$;


-- ── 1. 보낼 것 — 늦어도 쓸모 있으면 보냄 ────────────────────────────────
-- p_window 는 옛 호출과 모양을 맞추려고 남깁니다(이제 안 씁니다 — 끝 시각은 아래 «send_until»).
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
                        and g.ref_id = a.ref_id);
$$;
revoke execute on function public.due_pushes(interval) from anon, authenticated;


-- ── 2. 5분마다 부르기 ──────────────────────────────────────────────────
-- 같은 이름이 있으면 지우고 다시 겁니다(여러 번 실행해도 하나만).
select cron.unschedule(jobid) from cron.job where jobname = 'keyro-push';
select cron.schedule('keyro-push', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://qahqqhjleqfrsjiixnas.supabase.co/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                         where name = 'push_cron_secret' limit 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$job$);


-- ── 3. 확인 1 (지금) ───────────────────────────────────────────────────
-- 확인 2(5~10분 뒤, 따로 실행): 예약이 실제로 불렀고 함수가 200 을 줬는지
--   select status_code, left(content::text, 120) as 답, created
--     from net._http_response order by created desc limit 5;
--   200 · {"sent":0,"due":0} 같은 답이면 성공. 401 이면 위 «c»(Verify JWT 끄기), 403 이면 Vault 값이 PUSH_CRON_SECRET 과 다름.
select * from (
  select 1 as ord, 'pg_cron · pg_net'::text as check,
         case when (select count(*) from pg_extension where extname in ('pg_cron','pg_net')) = 2
              then 'OK' else 'X' end as result, ''::text as note
  union all
  select 2, 'Vault 열쇠 (값은 안 보임)',
         case when exists (select 1 from vault.secrets where name = 'push_cron_secret') then 'OK' else 'X' end,
         '이름 push_cron_secret'
  union all
  select 3, '예약 keyro-push',
         case when exists (select 1 from cron.job where jobname = 'keyro-push' and active) then 'OK' else 'X' end,
         (select schedule from cron.job where jobname = 'keyro-push')
  union all
  select 4, 'due_pushes 새 판(늦어도 보냄)',
         case when (select prosrc from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
                     where n.nspname = 'public' and pr.proname = 'due_pushes') like '%곧 시작해요%'
              then 'OK' else 'X' end,
         '일정 5분 전 · 항공 90분 전까지'
) t order by ord;
