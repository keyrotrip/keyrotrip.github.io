-- =====================================================================
-- 114 · 관리자 「사용」 칸 고도화 — 유튜브 스튜디오 「분석」처럼 (b825, 2026-10-03)
--
-- 사용자: 「유튜브 스튜디오처럼 초고도화 해봐」. 112 의 admin_usage 를 넓힙니다 — **돌려주던 것은 그대로**
-- 두고 더합니다(옛 화면이 캐시에 남아 있어도 안 깨지게). top(이 기간 인기 도시)만 걷습니다 — b815 부터 화면이
-- 안 썼고, 112 머리말에 「이 함수를 다시 고칠 일이 생기면 그때 같이 걷을 것」이라 적어 둔 것입니다.
--
-- ⚠ **새로 모으는 자료는 없습니다.** 이미 있는 줄(별점·여행·일정·지출·팔로우·일기 사진·앱 연 날)의 날짜와
--   시각을 셉니다. 처리방침 4차(2026-10-01)의 「이용 통계」 안입니다.
-- ⚠ **숫자만 냅니다**(043·112 와 같은 약속). 누가 무엇을 했는지는 관리자에게도 안 돌려줍니다.
-- ⚠ 날짜·시각은 서울로 자릅니다(112 와 같음).
--
-- 더한 것:
--   · 기간 — 7·28·90·365 와 「전체」(p_days ≤ 0: 첫 가입 날부터 오늘까지)
--   · series(날마다) — 다시 온 사람(b) · 여행(t) · 일정(pl) · 지출(e) · AI(ai) · 팔로우(f)
--   · kpi — 다시 온 사람(back — 가입한 날이 아닌 날에 연 사람) · 새 여행(trips), 지난 기간과 짝
--   · typical — 「평소」: 이번 기간 바로 앞 90일의 하루 값 25%·50%·75%(유튜브의 평소 범위 띠)와 하루 평균(avg)
--   · heat — 요일×시간 활동 수(별점·여행·일정·지출·팔로우·일기 사진을 만든 시각)
--   · depth — 사람마다 매긴 별점 수 구간(가입자 전체) · freq — 이번 기간에 앱을 연 날 수 구간
--   · stick — 꾸준함 = 하루 평균 쓴 사람 ÷ 이번 기간 쓴 사람
--   · funnel_p — 이번 기간에 가입한 사람만의 「어디까지 가나」
--
-- 속 함수(admin_usage_core)는 관리자 확인이 없어서 **아무에게도 안 열어 둡니다**(revoke). 앱은 겉 함수
-- admin_usage 만 부르고, 겉 함수가 관리자인지 본 뒤 속 함수를 부릅니다. 속 함수를 따로 둔 까닭은 맨 아래
-- 「확인」 줄 — SQL 편집기는 로그인한 사람이 아니라서 관리자 확인을 못 지나므로, 속 함수를 바로 불러 봅니다.
--
-- 여러 번 실행해도 안전합니다.
-- =====================================================================

create or replace function public.admin_usage_core(p_days int default 28)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  today  date := (now() at time zone 'Asia/Seoul')::date;
  first0 date := coalesce((select min((created_at at time zone 'Asia/Seoul')::date) from auth.users), today);
  nd     int;
  d0     date;                                          -- 이번 기간 첫날
  p0     date;                                          -- 지난 기간 첫날
  b0     date;                                          -- 「평소」를 재는 앞 90일의 첫날
  since  date := (select min(day) from public.user_days);   -- 앱 연 날 기록이 시작된 날(112)
  allp   boolean := coalesce(p_days, 28) <= 0;
  res    jsonb;
begin
  nd := case when allp then (today - first0 + 1) else least(coalesce(p_days, 28), 3650) end;
  nd := greatest(nd, 1);
  d0 := today - (nd - 1);
  p0 := today - (2 * nd - 1);
  b0 := d0 - 90;

  with
  rt as (                       -- 별이 있는 별점 줄(서울 날짜)
    select x.user_id, x.city_id, x.stars, c.country,
           (x.created_at at time zone 'Asia/Seoul')::date as d,
           (x.updated_at at time zone 'Asia/Seoul')::date as ud
      from public.city_ratings x join public.cities c on c.id = x.city_id
     where x.stars is not null
  ),
  ps as (                       -- 성향 확정한 날 = 해외 다섯 번째 별(112 와 같음)
    select user_id, d from (
      select user_id, d, row_number() over (partition by user_id order by d, city_id) as k
        from rt where country is distinct from 'KR') q
     where k = 5
  ),
  su as (select id, (created_at at time zone 'Asia/Seoul')::date as d from auth.users),
  tr as (select created_by as uid, (created_at at time zone 'Asia/Seoul')::date as d from public.trips),
  pl as (select created_by as uid, (created_at at time zone 'Asia/Seoul')::date as d from public.plans),
  ex as (select created_by as uid, (created_at at time zone 'Asia/Seoul')::date as d from public.expenses),
  fo as (select follower as uid, (created_at at time zone 'Asia/Seoul')::date as d from public.follows),

  days as (select generate_series(d0, today, interval '1 day')::date as d),
  ua as (select day as d, count(*) as n from public.user_days where day between d0 and today group by day),
  ub as (select u.day as d, count(*) as n from public.user_days u join su on su.id = u.user_id
          where u.day between d0 and today and su.d < u.day group by u.day),
  sa as (select d, count(*) as n from su where d between d0 and today group by d),
  ra as (select d, count(*) as n from rt where d between d0 and today group by d),
  pa as (select d, count(*) as n from ps where d between d0 and today group by d),
  ta as (select d, count(*) as n from tr where d between d0 and today group by d),
  la as (select d, count(*) as n from pl where d between d0 and today group by d),
  ea as (select d, count(*) as n from ex where d between d0 and today group by d),
  aa as (select day as d, sum(calls + review_calls) as n from public.ai_usage where day between d0 and today group by day),
  fa as (select d, count(*) as n from fo where d between d0 and today group by d),
  series as (
    select days.d, coalesce(ua.n, 0) as a, coalesce(ub.n, 0) as b, coalesce(sa.n, 0) as s,
           coalesce(ra.n, 0) as r, coalesce(pa.n, 0) as p, coalesce(ta.n, 0) as t,
           coalesce(la.n, 0) as pl, coalesce(ea.n, 0) as e, coalesce(aa.n, 0) as ai, coalesce(fa.n, 0) as f
      from days left join ua using (d) left join ub using (d) left join sa using (d)
                left join ra using (d) left join pa using (d) left join ta using (d)
                left join la using (d) left join ea using (d) left join aa using (d) left join fa using (d)
  ),

  -- 「평소」 — 이번 기간 바로 앞 90일(첫 가입 날 앞은 뺌)의 날마다 값
  bdays as (select generate_series(greatest(b0, first0), d0 - 1, interval '1 day')::date as d),
  bv as (
    select bdays.d,
           (select count(*) from public.user_days u where u.day = bdays.d) as a,
           (select count(*) from public.user_days u join su on su.id = u.user_id
             where u.day = bdays.d and su.d < u.day) as b,
           (select count(*) from su where su.d = bdays.d) as s,
           (select count(*) from rt where rt.d = bdays.d) as r,
           (select count(*) from ps where ps.d = bdays.d) as p,
           (select count(*) from tr where tr.d = bdays.d) as t
      from bdays
  ),

  -- 언제 쓰나 — 만든 시각(서울)
  ev as (
    select x.created_at as ts from public.city_ratings x where x.stars is not null
    union all select created_at from public.trips
    union all select created_at from public.plans
    union all select created_at from public.expenses
    union all select created_at from public.follows
    union all select created_at from public.journal_photos
  ),
  heat as (
    select extract(dow  from (ts at time zone 'Asia/Seoul'))::int as w,
           extract(hour from (ts at time zone 'Asia/Seoul'))::int as h, count(*) as n
      from ev where (ts at time zone 'Asia/Seoul')::date between d0 and today
     group by 1, 2
  ),
  dep as (select su.id, (select count(*) from rt where rt.user_id = su.id) as k from su),
  fq  as (select user_id, count(*) as k from public.user_days where day between d0 and today group by user_id)

  select jsonb_build_object(
    'days', nd, 'all', allp, 'today', today, 'from', d0, 'since', since, 'first', first0,

    -- 날마다. a 쓴 사람 · b 그중 다시 온 사람 · s 가입 · r 새 별점 · p 성향 확정 · t 여행 · pl 일정 · e 지출 · ai AI · f 팔로우
    'series', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'a', a, 'b', b, 's', s, 'r', r, 'p', p,
                                         't', t, 'pl', pl, 'e', e, 'ai', ai, 'f', f) order by d), '[]'::jsonb) from series),

    -- 지표 카드 — 이번 기간 / 지난 기간. 「쓴 사람」「다시 온 사람」은 기간 안에 한 번이라도 연 사람(한 사람은 한 번).
    'kpi', jsonb_build_object(
      'active',       (select count(distinct user_id) from public.user_days where day between d0 and today),
      'active_prev',  (select count(distinct user_id) from public.user_days where day between p0 and d0 - 1),
      -- 「다시 온 사람」 = 가입한 날이 아닌 날에 연 사람. 그래프(series 의 b)와 같은 셈입니다 — 카드는 「기간 전에
      -- 가입한 사람」, 그래프는 「그날 전에 가입한 사람」으로 세면 이번 주에 초대한 사람이 다음 날 다시 와도
      -- 그래프에만 잡혀서, 하루 값이 기간 전체 카드보다 커집니다. (기간 전/후 가입으로 가르는 것은 aud 가 따로.)
      'back',         (select count(distinct u.user_id) from public.user_days u join su on su.id = u.user_id
                        where u.day between d0 and today and su.d < u.day),
      'back_prev',    (select count(distinct u.user_id) from public.user_days u join su on su.id = u.user_id
                        where u.day between p0 and d0 - 1 and su.d < u.day),
      'signups',      (select count(*) from su where d between d0 and today),
      'signups_prev', (select count(*) from su where d between p0 and d0 - 1),
      'ratings',      (select count(*) from rt where d between d0 and today),
      'ratings_prev', (select count(*) from rt where d between p0 and d0 - 1),
      'persona',      (select count(*) from ps where d between d0 and today),
      'persona_prev', (select count(*) from ps where d between p0 and d0 - 1),
      'trips',        (select count(*) from tr where d between d0 and today),
      'trips_prev',   (select count(*) from tr where d between p0 and d0 - 1)),

    -- 평소 — 하루 값 25·50·75%(화면의 띠) · avg 하루 평균(화면의 「평소보다 많아요/적어요」는 이것과 견줌 — 띠와
    -- 견주면 별점처럼 며칠에 몰리는 숫자는 띠가 0~0 이라 1개만 매겨도 「많아요」가 됨, 10-03 실제 숫자로 봄).
    -- n = 견준 날 수(적으면 화면이 안 그림). 「쓴 사람」「다시 온 사람」은 기록 시작 뒤 날만.
    'typical', jsonb_build_object(
      'a', (select jsonb_build_object('lo', percentile_cont(.25) within group (order by a),
                                      'mid', percentile_cont(.5) within group (order by a),
                                      'hi', percentile_cont(.75) within group (order by a), 'avg', avg(a), 'n', count(*))
              from bv where since is not null and bv.d >= since),
      'b', (select jsonb_build_object('lo', percentile_cont(.25) within group (order by b),
                                      'mid', percentile_cont(.5) within group (order by b),
                                      'hi', percentile_cont(.75) within group (order by b), 'avg', avg(b), 'n', count(*))
              from bv where since is not null and bv.d >= since),
      's', (select jsonb_build_object('lo', percentile_cont(.25) within group (order by s),
                                      'mid', percentile_cont(.5) within group (order by s),
                                      'hi', percentile_cont(.75) within group (order by s), 'avg', avg(s), 'n', count(*)) from bv),
      'r', (select jsonb_build_object('lo', percentile_cont(.25) within group (order by r),
                                      'mid', percentile_cont(.5) within group (order by r),
                                      'hi', percentile_cont(.75) within group (order by r), 'avg', avg(r), 'n', count(*)) from bv),
      'p', (select jsonb_build_object('lo', percentile_cont(.25) within group (order by p),
                                      'mid', percentile_cont(.5) within group (order by p),
                                      'hi', percentile_cont(.75) within group (order by p), 'avg', avg(p), 'n', count(*)) from bv),
      't', (select jsonb_build_object('lo', percentile_cont(.25) within group (order by t),
                                      'mid', percentile_cont(.5) within group (order by t),
                                      'hi', percentile_cont(.75) within group (order by t), 'avg', avg(t), 'n', count(*)) from bv)),

    -- 지금까지 쌓인 것(112 그대로)
    'total', jsonb_build_object(
      'users',   (select count(*) from su),
      'ratings', (select count(*) from rt),
      'raters',  (select count(distinct user_id) from rt),
      'persona', (select count(*) from ps),
      'follows', (select count(*) from public.follows where status = 'accepted'),
      'trips',   (select count(*) from public.trips),
      'trips_now',    (select count(*) from public.trips where today between start_date and end_date),
      'trips_shared', (select count(*) from (select trip_id from public.trip_members where left_at is null
                                              group by trip_id having count(*) > 1) q)),

    -- 실시간(112 그대로) — 오늘 숫자와 최근 48시간 한 시간씩(시각은 UTC 로 주고 화면이 바꿈)
    'live', jsonb_build_object(
      'active',  (select count(*) from public.user_days where day = today),
      'signups', (select count(*) from su where d = today),
      'ratings', (select count(*) from rt where d = today),
      'hours',   (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'r', rr, 's', ss) order by h), '[]'::jsonb)
                    from (select h,
                            (select count(*) from public.city_ratings x
                              where x.stars is not null and x.created_at >= h
                                and x.created_at < h + interval '1 hour') as rr,
                            (select count(*) from auth.users u
                              where u.created_at >= h and u.created_at < h + interval '1 hour') as ss
                            from generate_series(date_trunc('hour', now()) - interval '47 hours',
                                                 date_trunc('hour', now()), interval '1 hour') as h) q)),

    -- 사람들(112 그대로) — 새로 온 / 다시 온 · 가입 주별 재방문
    'aud', jsonb_build_object(
      'new',  (select count(distinct u.user_id) from public.user_days u join su on su.id = u.user_id
                where u.day between d0 and today and su.d >= d0),
      'back', (select count(distinct u.user_id) from public.user_days u join su on su.id = u.user_id
                where u.day between d0 and today and su.d < d0)),
    'cohort', (select coalesce(jsonb_agg(c order by w desc), '[]'::jsonb) from (
                 select date_trunc('week', su.d)::date as w, count(*) as size,
                        count(*) filter (where exists (select 1 from public.user_days u
                              where u.user_id = su.id and u.day between su.d + 1 and su.d + 7)) as w1,
                        count(*) filter (where exists (select 1 from public.user_days u
                              where u.user_id = su.id and u.day between su.d + 8 and su.d + 30)) as w4,
                        bool_and(su.d + 7  <= today) as ok1,
                        bool_and(su.d + 30 <= today) as ok4,
                        bool_and(since is not null and su.d >= since) as tracked
                   from su
                  where su.d >= today - 7 * 8
                  group by 1) c),

    -- 얼마나 자주 — 이번 기간에 앱을 연 날 수
    'freq', jsonb_build_object(
      '1',   (select count(*) from fq where k = 1),
      '2-3', (select count(*) from fq where k between 2 and 3),
      '4-7', (select count(*) from fq where k between 4 and 7),
      '8+',  (select count(*) from fq where k >= 8)),

    -- 꾸준함 — 하루 평균 쓴 사람 ÷ 기간 쓴 사람(기록 시작 뒤 날만)
    'stick', (select case when count(distinct user_id) = 0 then null
                     else round(count(*)::numeric
                                / greatest(1, today - greatest(d0, coalesce(since, today)) + 1)
                                / count(distinct user_id), 3) end
                from public.user_days where day between greatest(d0, coalesce(since, today)) and today),

    -- 얼마나 깊이 — 사람마다 매긴 별점 수(가입자 전체)
    'depth', jsonb_build_object(
      '0',     (select count(*) from dep where k = 0),
      '1-4',   (select count(*) from dep where k between 1 and 4),
      '5-19',  (select count(*) from dep where k between 5 and 19),
      '20-49', (select count(*) from dep where k between 20 and 49),
      '50+',   (select count(*) from dep where k >= 50)),

    -- 언제 쓰나 — 요일(0 일요일)×시간 활동 수
    'heat', (select coalesce(jsonb_agg(jsonb_build_object('w', w, 'h', h, 'n', n)), '[]'::jsonb) from heat),

    -- 어디까지 가나 — 지금까지 전체(112 그대로) · 이번 기간에 가입한 사람만(funnel_p)
    'funnel', jsonb_build_object(
      'users',   (select count(*) from su),
      'rated',   (select count(distinct user_id) from rt),
      'persona', (select count(*) from ps),
      'follow',  (select count(distinct follower) from public.follows),
      'trip',    (select count(distinct created_by) from public.trips)),
    'funnel_p', jsonb_build_object(
      'users',   (select count(*) from su where su.d between d0 and today),
      'rated',   (select count(distinct rt.user_id) from rt join su on su.id = rt.user_id where su.d between d0 and today),
      'persona', (select count(*) from ps join su on su.id = ps.user_id where su.d between d0 and today),
      'follow',  (select count(distinct fo.uid) from fo join su on su.id = fo.uid where su.d between d0 and today),
      'trip',    (select count(distinct tr.uid) from tr join su on su.id = tr.uid where su.d between d0 and today)),

    -- 기능별 쓰임(112 그대로) — u 쓴 사람 · n 몇 번(건)
    'feat', jsonb_build_array(
      jsonb_build_object('k', '별점',
        'u', (select count(distinct user_id) from rt where ud between d0 and today),
        'n', (select count(*) from rt where d between d0 and today)),
      jsonb_build_object('k', '한줄평',
        'u', (select count(distinct user_id) from public.city_ratings
               where comment is not null and (updated_at at time zone 'Asia/Seoul')::date between d0 and today),
        'n', (select count(*) from public.city_ratings
               where comment is not null and (updated_at at time zone 'Asia/Seoul')::date between d0 and today)),
      jsonb_build_object('k', '일기',
        'u', (select count(distinct user_id) from public.city_ratings
               where journal is not null and (updated_at at time zone 'Asia/Seoul')::date between d0 and today),
        'n', (select count(*) from public.city_ratings
               where journal is not null and (updated_at at time zone 'Asia/Seoul')::date between d0 and today)),
      jsonb_build_object('k', '일기 사진',
        'u', (select count(distinct user_id) from public.journal_photos
               where (created_at at time zone 'Asia/Seoul')::date between d0 and today),
        'n', (select count(*) from public.journal_photos
               where (created_at at time zone 'Asia/Seoul')::date between d0 and today)),
      jsonb_build_object('k', '팔로우',
        'u', (select count(distinct uid) from fo where d between d0 and today),
        'n', (select count(*) from fo where d between d0 and today)),
      jsonb_build_object('k', '여행',
        'u', (select count(distinct uid) from tr where d between d0 and today),
        'n', (select count(*) from tr where d between d0 and today)),
      jsonb_build_object('k', '일정',
        'u', (select count(distinct uid) from pl where d between d0 and today),
        'n', (select count(*) from pl where d between d0 and today)),
      jsonb_build_object('k', '지출',
        'u', (select count(distinct uid) from ex where d between d0 and today),
        'n', (select count(*) from ex where d between d0 and today)),
      jsonb_build_object('k', 'AI',
        'u', (select count(distinct user_id) from public.ai_usage where day between d0 and today),
        'n', (select coalesce(sum(calls + review_calls), 0) from public.ai_usage where day between d0 and today)))
  ) into res;
  return res;
end $$;
-- 관리자 확인이 없는 속 함수 — 아무에게도 안 엽니다(API 로 못 부름). 겉 함수만 부릅니다.
revoke all on function public.admin_usage_core(int) from public, anon, authenticated;

-- 겉 함수 — 앱이 부르는 이름은 112 그대로(admin_usage). 관리자인지 보고 속 함수를 부릅니다.
create or replace function public.admin_usage(p_days int default 28)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 볼 수 있습니다';
  end if;
  return public.admin_usage_core(p_days);
end $$;
revoke all on function public.admin_usage(int) from public, anon;
grant execute on function public.admin_usage(int) to authenticated;


-- ── 확인 ─────────────────────────────────────────────────────────────
-- ① 함수가 있고, 속 함수는 로그인한 사람도 못 부르는가
select '겉 함수 admin_usage' as item, to_regprocedure('public.admin_usage(integer)') is not null as ok
union all select '속 함수 admin_usage_core', to_regprocedure('public.admin_usage_core(integer)') is not null
union all select '속 함수는 앱(authenticated)이 못 부름',
  not has_function_privilege('authenticated', 'public.admin_usage_core(integer)', 'execute')
union all select '속 함수는 로그인 전(anon)도 못 부름',
  not has_function_privilege('anon', 'public.admin_usage_core(integer)', 'execute');
-- ② 28일 숫자 미리보기(숫자만 — 사람 이름·id 없음). 결과 칸을 통째로 붙여 주시면 화면과 견줘 봅니다.
select jsonb_build_object(
  'days', x->'days', 'kpi', x->'kpi', 'typical', x->'typical', 'freq', x->'freq', 'stick', x->'stick',
  'depth', x->'depth', 'funnel_p', x->'funnel_p', 'heat칸수', jsonb_array_length(x->'heat'),
  'series날수', jsonb_array_length(x->'series')) as 미리보기
from (select public.admin_usage_core(28) as x) q;
