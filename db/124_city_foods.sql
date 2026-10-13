-- 124 · 도시 맛집 추천 (2026-10-13)
-- 사용자: 「후기를 맛집추천도 많이 녹이는건 어때 어쨋든 기록으로 남으니까」 → 시안 C(맛집을 따로 칸) · 「시연 그대로(직접 쓰기만)」.
--   별을 매긴 직후(★4.5↑, 하루 3번) 「🍽 맛집 추천하기」 → 가게 이름(필수) + 한마디(선택). 별점은 없음(추천 = 좋았다).
--   도시 화면 「○○ 맛집 추천」: 같은 이름(띄어쓰기·대소문자 무시)은 묶어 「N명이 추천」, 많이 추천된 순.
-- 표는 RLS 로 잠그고 함수로만. 차단한 사이·비활성화(off)는 안 보임(106 규칙). 한 사람이 한 도시에 여러 곳 추천 가능(같은 가게는 한 번).
-- 대시보드(admin_usage_core — 122 바탕): 「쌓인 것」 맛집 · 「실시간」 오늘 새 맛집 · 48시간 막대 m.
-- 다시 돌려도 됩니다.

create table if not exists public.city_foods (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  city_id    text not null references public.cities (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  name_key   text not null,
  note       text check (note is null or char_length(note) <= 60),
  created_at timestamptz not null default now(),
  unique (user_id, city_id, name_key)
);
create index if not exists city_foods_city_idx on public.city_foods (city_id, name_key);
alter table public.city_foods enable row level security;

-- 추천하기 → 번호. 같은 가게를 또 추천하면 한마디만 바꿉니다.
create or replace function public.food_add(p_city text, p_name text, p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 이름 text := btrim(coalesce(p_name, '')); 말 text := nullif(btrim(coalesce(p_note, '')), ''); 새 bigint;
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  if char_length(이름) = 0 then raise exception '가게 이름을 적어 주세요'; end if;
  if char_length(이름) > 40 then raise exception '가게 이름은 40자까지예요'; end if;
  if 말 is not null and char_length(말) > 60 then raise exception '한마디는 60자까지예요'; end if;
  if not exists (select 1 from public.cities where id = p_city) then raise exception '없는 도시예요'; end if;
  if (select visibility from public.profiles where id = me) = 'off' then
    raise exception '비활성화한 계정은 추천할 수 없어요'; end if;
  if (select count(*) from public.city_foods where user_id = me and created_at > now() - interval '1 hour') >= 30 then
    raise exception '추천을 너무 많이 했어요. 잠시 뒤에 다시 해 주세요'; end if;
  insert into public.city_foods (user_id, city_id, name, name_key, note)
  values (me, p_city, 이름, public.name_key(이름), 말)
  on conflict (user_id, city_id, name_key) do update set note = coalesce(excluded.note, city_foods.note), name = excluded.name
  returning id into 새;
  return 새;
end $$;
revoke all on function public.food_add(text, text, text) from public, anon;
grant execute on function public.food_add(text, text, text) to authenticated;

-- 내 추천 지우기
create or replace function public.food_del(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  delete from public.city_foods where id = p_id and user_id = auth.uid();
end $$;
revoke all on function public.food_del(bigint) from public, anon;
grant execute on function public.food_del(bigint) to authenticated;

-- 도시 맛집 목록 — 가게(이름 키)마다 한 줄: 많이 쓰인 이름 · 추천 수 · 한마디 하나(가장 최근, 쓴 사람) · 내가 추천했나
create or replace function public.city_foods_list(p_city text)
returns table (name text, n int, note text, note_by text, mine boolean, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  with v as (
    select f.*, coalesce(p.display_name, '여행자') as who
      from public.city_foods f left join public.profiles p on p.id = f.user_id
     where f.city_id = p_city
       and (auth.uid() is null or f.user_id = auth.uid() or not public.blocked_between(auth.uid(), f.user_id))
       and (coalesce(p.visibility, 'public') <> 'off' or f.user_id = auth.uid())
  )
  select (select v2.name from v v2 where v2.name_key = g.name_key
           group by v2.name order by count(*) desc, max(v2.created_at) desc limit 1),
         count(*)::int,
         (select v3.note from v v3 where v3.name_key = g.name_key and v3.note is not null order by v3.created_at desc limit 1),
         (select v3.who  from v v3 where v3.name_key = g.name_key and v3.note is not null order by v3.created_at desc limit 1),
         bool_or(g.user_id = auth.uid()),
         max(g.created_at)
    from v g
   group by g.name_key
   order by count(*) desc, max(g.created_at) desc
   limit 50;
$$;
revoke all on function public.city_foods_list(text) from public;
grant execute on function public.city_foods_list(text) to anon, authenticated;

-- 내가 추천한 도시들(별 매긴 직후 「맛집 추천하기」를 빼려고) — 도시 id 만
create or replace function public.my_food_cities()
returns table (city_id text)
language sql stable security definer set search_path = public as $$
  select distinct city_id from public.city_foods where user_id = auth.uid();
$$;
revoke all on function public.my_food_cities() from public, anon;
grant execute on function public.my_food_cities() to authenticated;

-- ── 대시보드 — admin_usage_core (⚠ 122 를 «그대로» 옮겨 와 「-- 124」 줄만 더했습니다) ──────────
create or replace function public.admin_usage_core(p_days int default 28)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  today  date := (now() at time zone 'Asia/Seoul')::date;
  -- 118: 처음 가입한 날 — 지운 계정이 가입한 날(deleted_signups)까지 봅니다. least 는 비어 있는(null) 쪽을 건너뜁니다.
  first0 date := coalesce(least((select min((u.created_at at time zone 'Asia/Seoul')::date) from auth.users u
                                  where not exists (select 1 from public.admins a where a.user_id = u.id)),
                                (select min(day) from public.deleted_signups)), today);
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
  -- ⚠ 116: 관리자(public.admins) 계정이 한 일은 **어디서도 안 셉니다**. 아래 x_ 로 시작하는 걸러 낸 표만 씁니다 —
  --   함수 안에서 원래 표를 바로 부르는 곳이 남으면 그 숫자에만 관리자가 섞입니다(116 머리말의 확인 줄이 잡습니다).
  x_ud as (select u.* from public.user_days u      where not exists (select 1 from public.admins a where a.user_id = u.user_id)),
  x_cr as (select r.* from public.city_ratings r   where not exists (select 1 from public.admins a where a.user_id = r.user_id)),
  x_au as (select u.* from auth.users u            where not exists (select 1 from public.admins a where a.user_id = u.id)),
  x_tr as (select t.* from public.trips t          where not exists (select 1 from public.admins a where a.user_id = t.created_by)),
  x_pl as (select p.* from public.plans p          where not exists (select 1 from public.admins a where a.user_id = p.created_by)),
  x_ex as (select e.* from public.expenses e       where not exists (select 1 from public.admins a where a.user_id = e.created_by)),
  x_fo as (select f.* from public.follows f        where not exists (select 1 from public.admins a where a.user_id = f.follower)),
  x_jp as (select j.* from public.journal_photos j where not exists (select 1 from public.admins a where a.user_id = j.user_id)),
  x_ai as (select i.* from public.ai_usage i       where not exists (select 1 from public.admins a where a.user_id = i.user_id)),
  x_tm as (select m.* from public.trip_members m   where m.trip_id in (select id from x_tr)),
  x_rl as (select l.* from public.review_likes l   where not exists (select 1 from public.admins a where a.user_id = l.liker)),
  x_rr as (select x.* from public.review_replies x where not exists (select 1 from public.admins a where a.user_id = x.user_id)),
  x_fd as (select f.* from public.city_foods f  where not exists (select 1 from public.admins a where a.user_id = f.user_id)),   -- 124
  -- 117: 탈퇴 수(날마다 숫자만). 관리자는 적을 때 이미 뺐습니다(count_account_deletion).
  xd as (select day as d, n from public.account_deletions),

  rt as (                       -- 별이 있는 별점 줄(서울 날짜)
    select x.user_id, x.city_id, x.stars, c.country,
           (x.created_at at time zone 'Asia/Seoul')::date as d,
           (x.updated_at at time zone 'Asia/Seoul')::date as ud
      from x_cr x join public.cities c on c.id = x.city_id
     where x.stars is not null
  ),
  ps as (                       -- 성향 확정한 날 = 해외 «열» 번째 별(115). ⚠ 116·117 이 114 를 바탕으로 짜여 다섯 번째로 되돌아갔던 것을 118 에서 바로잡음
    select user_id, d from (
      select user_id, d, row_number() over (partition by user_id order by d, city_id) as k
        from rt where country is distinct from 'KR') q
     where k = 10
  ),
  su as (select id, (created_at at time zone 'Asia/Seoul')::date as d from x_au),
  -- 118: 가입 «숫자» = 남아 있는 계정 + 지운 계정이 가입한 날(deleted_signups, 관리자는 적을 때 이미 뺌).
  --   사람마다 따라가는 숫자(깊이·어디까지·재방문·새로 온)와 「쌓인 것 — 가입자」·48시간 막대는 su(남아 있는 계정) 그대로.
  sg as (select d, sum(n) as n from (select d, 1 as n from su union all select day, n from public.deleted_signups) z group by d),
  tr as (select created_by as uid, (created_at at time zone 'Asia/Seoul')::date as d from x_tr),
  pl as (select created_by as uid, (created_at at time zone 'Asia/Seoul')::date as d from x_pl),
  ex as (select created_by as uid, (created_at at time zone 'Asia/Seoul')::date as d from x_ex),
  fo as (select follower as uid, (created_at at time zone 'Asia/Seoul')::date as d from x_fo),

  days as (select generate_series(d0, today, interval '1 day')::date as d),
  ua as (select day as d, count(*) as n from x_ud where day between d0 and today group by day),
  ub as (select u.day as d, count(*) as n from x_ud u join su on su.id = u.user_id
          where u.day between d0 and today and su.d < u.day group by u.day),
  sa as (select d, n from sg where d between d0 and today),
  ra as (select d, count(*) as n from rt where d between d0 and today group by d),
  pa as (select d, count(*) as n from ps where d between d0 and today group by d),
  ta as (select d, count(*) as n from tr where d between d0 and today group by d),
  la as (select d, count(*) as n from pl where d between d0 and today group by d),
  ea as (select d, count(*) as n from ex where d between d0 and today group by d),
  aa as (select day as d, sum(calls + review_calls) as n from x_ai where day between d0 and today group by day),
  fa as (select d, count(*) as n from fo where d between d0 and today group by d),
  xa as (select d, sum(n) as n from xd where d between d0 and today group by d),
  series as (
    select days.d, coalesce(ua.n, 0) as a, coalesce(ub.n, 0) as b, coalesce(sa.n, 0) as s,
           coalesce(ra.n, 0) as r, coalesce(pa.n, 0) as p, coalesce(ta.n, 0) as t,
           coalesce(la.n, 0) as pl, coalesce(ea.n, 0) as e, coalesce(aa.n, 0) as ai, coalesce(fa.n, 0) as f, coalesce(xa.n, 0) as x
      from days left join ua using (d) left join ub using (d) left join sa using (d)
                left join ra using (d) left join pa using (d) left join ta using (d)
                left join la using (d) left join ea using (d) left join aa using (d) left join fa using (d) left join xa using (d)
  ),

  -- 「평소」 — 이번 기간 바로 앞 90일(첫 가입 날 앞은 뺌)의 날마다 값
  bdays as (select generate_series(greatest(b0, first0), d0 - 1, interval '1 day')::date as d),
  bv as (
    select bdays.d,
           (select count(*) from x_ud u where u.day = bdays.d) as a,
           (select count(*) from x_ud u join su on su.id = u.user_id
             where u.day = bdays.d and su.d < u.day) as b,
           coalesce((select n from sg where sg.d = bdays.d), 0) as s,
           (select count(*) from rt where rt.d = bdays.d) as r,
           (select count(*) from ps where ps.d = bdays.d) as p,
           (select count(*) from tr where tr.d = bdays.d) as t,
           (select coalesce(sum(n), 0) from xd where xd.d = bdays.d) as x
      from bdays
  ),

  -- 언제 쓰나 — 만든 시각(서울)
  ev as (
    select x.created_at as ts from x_cr x where x.stars is not null
    union all select created_at from x_tr
    union all select created_at from x_pl
    union all select created_at from x_ex
    union all select created_at from x_fo
    union all select created_at from x_jp
  ),
  heat as (
    select extract(dow  from (ts at time zone 'Asia/Seoul'))::int as w,
           extract(hour from (ts at time zone 'Asia/Seoul'))::int as h, count(*) as n
      from ev where (ts at time zone 'Asia/Seoul')::date between d0 and today
     group by 1, 2
  ),
  dep as (select su.id, (select count(*) from rt where rt.user_id = su.id) as k from su),
  fq  as (select user_id, count(*) as k from x_ud where day between d0 and today group by user_id)

  select jsonb_build_object(
    'days', nd, 'all', allp, 'today', today, 'from', d0, 'since', since, 'first', first0,
    'del_since', (select min(day) from public.account_deletions),   -- 117: 탈퇴를 세기 시작한 날

    -- 날마다. a 쓴 사람 · b 그중 다시 온 사람 · s 가입 · r 새 별점 · p 성향 확정 · t 여행 · pl 일정 · e 지출 · ai AI · f 팔로우
    'series', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'a', a, 'b', b, 's', s, 'r', r, 'p', p,
                                         't', t, 'pl', pl, 'e', e, 'ai', ai, 'f', f, 'x', x) order by d), '[]'::jsonb) from series),

    -- 지표 카드 — 이번 기간 / 지난 기간. 「쓴 사람」「다시 온 사람」은 기간 안에 한 번이라도 연 사람(한 사람은 한 번).
    'kpi', jsonb_build_object(
      'active',       (select count(distinct user_id) from x_ud where day between d0 and today),
      'active_prev',  (select count(distinct user_id) from x_ud where day between p0 and d0 - 1),
      -- 「다시 온 사람」 = 가입한 날이 아닌 날에 연 사람. 그래프(series 의 b)와 같은 셈입니다 — 카드는 「기간 전에
      -- 가입한 사람」, 그래프는 「그날 전에 가입한 사람」으로 세면 이번 주에 초대한 사람이 다음 날 다시 와도
      -- 그래프에만 잡혀서, 하루 값이 기간 전체 카드보다 커집니다. (기간 전/후 가입으로 가르는 것은 aud 가 따로.)
      'back',         (select count(distinct u.user_id) from x_ud u join su on su.id = u.user_id
                        where u.day between d0 and today and su.d < u.day),
      'back_prev',    (select count(distinct u.user_id) from x_ud u join su on su.id = u.user_id
                        where u.day between p0 and d0 - 1 and su.d < u.day),
      'signups',      (select coalesce(sum(n), 0) from sg where d between d0 and today),
      'signups_prev', (select coalesce(sum(n), 0) from sg where d between p0 and d0 - 1),
      'ratings',      (select count(*) from rt where d between d0 and today),
      'ratings_prev', (select count(*) from rt where d between p0 and d0 - 1),
      'persona',      (select count(*) from ps where d between d0 and today),
      'persona_prev', (select count(*) from ps where d between p0 and d0 - 1),
      'trips',        (select count(*) from tr where d between d0 and today),
      'trips_prev',   (select count(*) from tr where d between p0 and d0 - 1),
      -- 117: 탈퇴(계정을 지운 사람) — 세기 시작한 날(del_since)부터만 있습니다.
      'deletes',      (select coalesce(sum(n), 0) from xd where d between d0 and today),
      'deletes_prev', (select coalesce(sum(n), 0) from xd where d between p0 and d0 - 1)),

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
                                      'hi', percentile_cont(.75) within group (order by t), 'avg', avg(t), 'n', count(*)) from bv),
      -- 117: 탈퇴 — 세기 시작한 날 뒤 날만 견줍니다.
      'x', (select jsonb_build_object('lo', percentile_cont(.25) within group (order by x),
                                      'mid', percentile_cont(.5) within group (order by x),
                                      'hi', percentile_cont(.75) within group (order by x), 'avg', avg(x), 'n', count(*))
              from bv where bv.d >= (select min(day) from public.account_deletions))),

    -- 지금까지 쌓인 것(112 그대로)
    'total', jsonb_build_object(
      'users',   (select count(*) from su),
      'deleted', (select coalesce(sum(n), 0) from xd),   -- 117
      'ratings', (select count(*) from rt),
      'raters',  (select count(distinct user_id) from rt),
      'persona', (select count(*) from ps),
      'follows', (select count(*) from x_fo where status = 'accepted'),
      'trips',   (select count(*) from x_tr),
      'trips_now',    (select count(*) from x_tr where today between start_date and end_date),
      'comments', (select count(*) from x_cr where nullif(btrim(comment), '') is not null),   -- 122
      'journals', (select count(*) from x_cr where nullif(btrim(journal), '') is not null),   -- 122
      'review_likes', (select count(*) from x_rl),                                            -- 122
      'review_replies', (select count(*) from x_rr),                                          -- 122
      'foods', (select count(*) from x_fd),                                                  -- 124
      'trips_shared', (select count(*) from (select trip_id from x_tm where left_at is null
                                              group by trip_id having count(*) > 1) q)),

    -- 실시간(112 그대로) — 오늘 숫자와 최근 48시간 한 시간씩(시각은 UTC 로 주고 화면이 바꿈)
    'live', jsonb_build_object(
      'active',  (select count(*) from x_ud where day = today),
      'signups', (select coalesce(sum(n), 0) from sg where d = today),
      'ratings', (select count(*) from rt where d = today),
      'comments', (select count(*) from x_cr where (comment_at at time zone 'Asia/Seoul')::date = today),   -- 122
      'journals', (select count(*) from x_cr where (journal_at at time zone 'Asia/Seoul')::date = today),   -- 122
      'foods', (select count(*) from x_fd where (created_at at time zone 'Asia/Seoul')::date = today),   -- 124
      'hours',   (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'r', rr, 's', ss, 'c', cc, 'j', jj, 'm', mm) order by h), '[]'::jsonb)
                    from (select h,
                            (select count(*) from x_cr x
                              where x.stars is not null and x.created_at >= h
                                and x.created_at < h + interval '1 hour') as rr,
                            (select count(*) from x_au u
                              where u.created_at >= h and u.created_at < h + interval '1 hour') as ss
                              ,(select count(*) from x_cr x where x.comment_at >= h and x.comment_at < h + interval '1 hour') as cc   -- 122
                              ,(select count(*) from x_cr x where x.journal_at >= h and x.journal_at < h + interval '1 hour') as jj   -- 122
                              ,(select count(*) from x_fd x where x.created_at >= h and x.created_at < h + interval '1 hour') as mm   -- 124
                            from generate_series(date_trunc('hour', now()) - interval '47 hours',
                                                 date_trunc('hour', now()), interval '1 hour') as h) q)),

    -- 사람들(112 그대로) — 새로 온 / 다시 온 · 가입 주별 재방문
    'aud', jsonb_build_object(
      'new',  (select count(distinct u.user_id) from x_ud u join su on su.id = u.user_id
                where u.day between d0 and today and su.d >= d0),
      'back', (select count(distinct u.user_id) from x_ud u join su on su.id = u.user_id
                where u.day between d0 and today and su.d < d0)),
    'cohort', (select coalesce(jsonb_agg(c order by w desc), '[]'::jsonb) from (
                 select date_trunc('week', su.d)::date as w, count(*) as size,
                        count(*) filter (where exists (select 1 from x_ud u
                              where u.user_id = su.id and u.day between su.d + 1 and su.d + 7)) as w1,
                        count(*) filter (where exists (select 1 from x_ud u
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
                from x_ud where day between greatest(d0, coalesce(since, today)) and today),

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
      'follow',  (select count(distinct follower) from x_fo),
      'trip',    (select count(distinct created_by) from x_tr)),
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
        'u', (select count(distinct user_id) from x_cr
               where comment is not null and (updated_at at time zone 'Asia/Seoul')::date between d0 and today),
        'n', (select count(*) from x_cr
               where comment is not null and (updated_at at time zone 'Asia/Seoul')::date between d0 and today)),
      jsonb_build_object('k', '일기',
        'u', (select count(distinct user_id) from x_cr
               where journal is not null and (updated_at at time zone 'Asia/Seoul')::date between d0 and today),
        'n', (select count(*) from x_cr
               where journal is not null and (updated_at at time zone 'Asia/Seoul')::date between d0 and today)),
      jsonb_build_object('k', '일기 사진',
        'u', (select count(distinct user_id) from x_jp
               where (created_at at time zone 'Asia/Seoul')::date between d0 and today),
        'n', (select count(*) from x_jp
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
        'u', (select count(distinct user_id) from x_ai where day between d0 and today),
        'n', (select coalesce(sum(calls + review_calls), 0) from x_ai where day between d0 and today)))
  ) into res;
  return res;
end $$;
-- 관리자 확인이 없는 속 함수 — 아무에게도 안 엽니다(API 로 못 부름). 겉 함수(admin_usage, 114)만 부릅니다.
revoke all on function public.admin_usage_core(int) from public, anon, authenticated;

-- 확인: 전부 true 면 된 것
select to_regclass('public.city_foods') is not null as 맛집_표,
       to_regprocedure('public.city_foods_list(text)') is not null as 맛집_목록,
       pg_get_functiondef('public.admin_usage_core(int)'::regprocedure) like '%x_fd%'
         and pg_get_functiondef('public.admin_usage_core(int)'::regprocedure) like '%x_rr%' as 대시보드;
