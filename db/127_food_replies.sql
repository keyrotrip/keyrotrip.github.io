-- 127 맛집 추천 글에 답글(b866, 사용자: 「맛집 추천도 한줄평처럼 답글 쓸 수 있게」 → 「추천한 사람 글마다 따로 다는 방식」)
--   답글은 «추천 한 줄(city_foods 의 한 사람 한 가게)»에 붙습니다 — 그 글을 지우면(추천 빼기 · food_del_mine) 답글도 같이.
--   거르기는 한줄평 답글(122)과 같은 규칙: 차단 사이 · 비활성(off) 계정은 안 보임 · 쓴 사람/글 주인은 지울 수 있음.
--   city_foods_list: 대표 글은 «내 글 먼저»(그 줄에 수정·삭제) · mine_note = 내가 글까지 쓴 가게(👍 를 못 누르고 칠하지도 않음 — 내 한줄평 ♡ 와 같음).
--   알림 설정은 한줄평 답글과 같은 칸(notify_wants 의 else → 켜짐)을 씁니다. 알림 줄에 food_id 를 남겨 누르면 그 글로.

create table if not exists public.food_replies (
  id         bigint generated always as identity primary key,
  food_id    bigint not null references public.city_foods (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists food_replies_food_idx on public.food_replies (food_id, created_at);
create index if not exists food_replies_user_idx on public.food_replies (user_id, created_at);
alter table public.food_replies enable row level security;
-- (정책 없음 = 앱이 표를 직접 못 읽고 못 씀. 아래 security definer 함수만.)

alter table public.notifications add column if not exists food_id bigint;

-- 볼 수 있는 추천 글인가(글이 있고 · 차단 사이 아니고 · 쓴 사람이 off 가 아니거나 나)
create or replace function public.food_note_ok(p_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.city_foods f left join public.profiles p on p.id = f.user_id
     where f.id = p_id
       and nullif(btrim(f.note), '') is not null
       and (auth.uid() is null or f.user_id = auth.uid() or not public.blocked_between(auth.uid(), f.user_id))
       and (coalesce(p.visibility, 'public') <> 'off' or f.user_id = auth.uid()));
$$;
revoke all on function public.food_note_ok(bigint) from public, anon, authenticated;

-- ── 도시 화면 맛집 목록 — 126 에 «대표 글 번호 · 그 글 답글 수 · 글 쓴 사람 수»를 더함 ──────────
drop function if exists public.city_foods_list(text);
create function public.city_foods_list(p_city text)
returns table (name text, n int, note text, note_by text, mine boolean, last_at timestamptz,
               note_uid uuid, note_avatar text, note_id bigint, n_reply int, n_notes int, mine_note boolean)
language sql stable security definer set search_path = public as $$
  with v as (
    select f.*, coalesce(p.display_name, '여행자') as who, p.avatar_url as av
      from public.city_foods f left join public.profiles p on p.id = f.user_id
     where f.city_id = p_city
       and (auth.uid() is null or f.user_id = auth.uid() or not public.blocked_between(auth.uid(), f.user_id))
       and (coalesce(p.visibility, 'public') <> 'off' or f.user_id = auth.uid())
  ),
  g as (
    select name_key, count(*)::int as n, bool_or(user_id = auth.uid()) as mine, max(created_at) as last_at,
           count(*) filter (where nullif(btrim(note), '') is not null)::int as n_notes,
           bool_or(user_id = auth.uid() and nullif(btrim(note), '') is not null) as mine_note
      from v group by name_key
  )
  select (select v2.name from v v2 where v2.name_key = g.name_key
           group by v2.name order by count(*) desc, max(v2.created_at) desc limit 1),
         g.n, w.note, w.who, g.mine, g.last_at, w.user_id, w.av, w.id,
         (select count(*) from public.food_replies x where x.food_id = w.id and public.person_seen(x.user_id))::int,
         g.n_notes, coalesce(g.mine_note, false)
    from g
    left join lateral (select v3.id, v3.note, v3.who, v3.user_id, v3.av from v v3
                        where v3.name_key = g.name_key and nullif(btrim(v3.note), '') is not null
                        order by (v3.user_id = auth.uid()) desc, v3.created_at desc limit 1) w on true   -- 내 글이 있으면 내 글이 대표(수정·삭제를 늘 찾게, 사용자)
   order by g.n desc, g.last_at desc
   limit 50;
$$;
revoke all on function public.city_foods_list(text) from public;
grant execute on function public.city_foods_list(text) to anon, authenticated;

-- 한 가게의 추천 글 전부(「추천 글 N개 더 보기」) — 글 없는 추천은 n_plain 으로 셈만
create or replace function public.food_notes(p_city text, p_name text)
returns table (id bigint, user_id uuid, name text, avatar_url text, note text, created_at timestamptz,
               n_reply int, shop text, n_all int)
language sql stable security definer set search_path = public as $$
  with v as (
    select f.*, coalesce(p.display_name, '여행자') as who, p.avatar_url as av
      from public.city_foods f left join public.profiles p on p.id = f.user_id
     where f.city_id = p_city and f.name_key = public.name_key(p_name)
       and (auth.uid() is null or f.user_id = auth.uid() or not public.blocked_between(auth.uid(), f.user_id))
       and (coalesce(p.visibility, 'public') <> 'off' or f.user_id = auth.uid())
  )
  select v.id, v.user_id, v.who, v.av, v.note, v.created_at,
         (select count(*) from public.food_replies x where x.food_id = v.id and public.person_seen(x.user_id))::int,
         (select v2.name from v v2 group by v2.name order by count(*) desc limit 1),
         (select count(*) from v)::int
    from v
   where nullif(btrim(v.note), '') is not null
   order by v.created_at desc
   limit 100;
$$;
revoke all on function public.food_notes(text, text) from public;
grant execute on function public.food_notes(text, text) to anon, authenticated;

-- 추천 글 하나(답글 화면 머리)
create or replace function public.food_note_one(p_id bigint)
returns table (id bigint, city_id text, shop text, user_id uuid, name text, avatar_url text, note text,
               created_at timestamptz, n_reply int)
language sql stable security definer set search_path = public as $$
  select f.id, f.city_id, f.name, f.user_id, coalesce(p.display_name, '여행자'), p.avatar_url, f.note, f.created_at,
         (select count(*) from public.food_replies x where x.food_id = f.id and public.person_seen(x.user_id))::int
    from public.city_foods f left join public.profiles p on p.id = f.user_id
   where f.id = p_id and public.food_note_ok(p_id);
$$;
revoke all on function public.food_note_one(bigint) from public;
grant execute on function public.food_note_one(bigint) to anon, authenticated;

-- 답글 목록(오래된 것부터 — 묻고 답하는 순서)
create or replace function public.food_replies_list(p_id bigint)
returns table (id bigint, user_id uuid, name text, avatar_url text, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select x.id, x.user_id, coalesce(p.display_name, '여행자'), p.avatar_url, x.body, x.created_at
    from public.food_replies x left join public.profiles p on p.id = x.user_id
   where x.food_id = p_id and public.food_note_ok(p_id) and public.person_seen(x.user_id)
   order by x.created_at
   limit 200;
$$;
revoke all on function public.food_replies_list(bigint) from public;
grant execute on function public.food_replies_list(bigint) to anon, authenticated;

-- 답글 쓰기 → 새 번호 · 글 주인에게 알림
create or replace function public.food_reply_add(p_id bigint, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 새 bigint; 주인 uuid; 도시 text; 가게 text; 이름 text; 글 text := btrim(coalesce(p_body, ''));
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  if char_length(글) = 0 then raise exception '답글을 적어 주세요'; end if;
  if char_length(글) > 300 then raise exception '답글은 300자까지예요'; end if;
  if not public.food_note_ok(p_id) then raise exception '볼 수 없는 추천 글이에요'; end if;
  if (select visibility from public.profiles where id = me) = 'off' then
    raise exception '비활성화한 계정은 답글을 달 수 없어요'; end if;
  if (select count(*) from public.food_replies
       where user_id = me and created_at > now() - interval '1 hour') >= 60 then
    raise exception '답글을 너무 많이 달았어요. 잠시 뒤에 다시 해 주세요'; end if;
  insert into public.food_replies (food_id, user_id, body) values (p_id, me, 글) returning id into 새;
  select f.user_id, f.city_id, f.name into 주인, 도시, 가게 from public.city_foods f where f.id = p_id;
  if 주인 <> me and public.notify_wants(주인, 'food_reply') then
    select coalesce(display_name, '누군가') into 이름 from public.profiles where id = me;
    insert into public.notifications (user_id, kind, body, actor_id, city_id, food_id)
    values (주인, 'food_reply',
            이름 || '님이 내 「' || 가게 || '」 추천에 답글을 달았어요: 「'
              || left(글, 40) || case when char_length(글) > 40 then '…' else '' end || '」',
            me, 도시, p_id);
  end if;
  return 새;
end $$;
revoke all on function public.food_reply_add(bigint, text) from public, anon;
grant execute on function public.food_reply_add(bigint, text) to authenticated;

-- 답글 지우기 — 쓴 사람, 또는 그 추천 글의 주인
create or replace function public.food_reply_del(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  delete from public.food_replies x
   where x.id = p_id
     and (x.user_id = auth.uid()
          or exists (select 1 from public.city_foods f where f.id = x.food_id and f.user_id = auth.uid()));
  if not found then raise exception '지울 수 없는 답글이에요'; end if;
end $$;
revoke all on function public.food_reply_del(bigint) from public, anon;
grant execute on function public.food_reply_del(bigint) to authenticated;

-- 확인: 셋 다 true 면 된 것
select to_regclass('public.food_replies') is not null as 답글_표,
       to_regprocedure('public.food_reply_add(bigint,text)') is not null as 답글_쓰기,
       exists (select 1 from information_schema.parameters a join information_schema.routines r on a.specific_name = r.specific_name
                where r.routine_name = 'city_foods_list' and a.parameter_name = 'n_notes') as 목록_답글수;
