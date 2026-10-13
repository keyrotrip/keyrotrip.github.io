-- 122 · 후기(한줄평) 좋아요 · 답글 · 후기 수 (2026-10-13)
-- 사용자: 「여행 후기를 강화해야하는데 … 평균 옆에 후기 몇 개인지 같이 · 후기 좋아요 · 답글」
--   → 고른 것: 후기 수 = 도시 한줄평 수 · 답글은 로그인한 누구나(한 단계) · 좋아요·답글 둘 다 알림 · 화면은 왓챠피디아처럼.
-- 후기 = city_ratings.comment(012). 후기에는 따로 번호가 없어서 (쓴 사람 user_id, 도시 city_id) 둘로 가리킵니다.
--
-- 만든 것
--   1) city_ratings.comment_at · journal_at — 한줄평·일기를 «쓴 때»(별만 고쳐도 바뀌는 updated_at 과 따로).
--      대시보드 「새 후기」「새 일기」 막대가 이걸로 셉니다. 옛 줄은 updated_at 으로 채움.
--   2) review_likes · review_replies · reply_likes — 표는 RLS 로 잠그고, 읽기·쓰기는 아래 함수로만.
--   3) 한줄평을 지우면(빈 칸) 그 후기의 좋아요·답글도 지웁니다(왓챠처럼). 글만 고치면 그대로.
--   4) city_stats 에 n_comment(후기 수) · city_comments 에 좋아요·답글 수와 «내가 눌렀나» · 정렬.
--   5) 알림: review_like(같은 후기 안 읽은 알림은 한 줄로 묶음) · review_reply. notifications.city_id 칸 추가.
--   6) 대시보드(admin_usage_core — 118 바탕): 「쌓인 것」 후기·일기·좋아요·답글 · 「실시간」 오늘 새 후기·새 일기 ·
--      48시간 막대에 c(후기)·j(일기) 칸.
-- 차단한 사이 · 비활성화(off)한 사람의 좋아요·답글은 안 보이고, 걸 수도 없습니다(106 규칙 그대로).
-- 다시 돌려도 됩니다.

-- ── 1. 쓴 때 ─────────────────────────────────────────────────────────────
alter table public.city_ratings add column if not exists comment_at timestamptz;
alter table public.city_ratings add column if not exists journal_at timestamptz;
-- ⚠ 111(110 을 갈아 끼워 fav_rank 까지 뺀 판)을 바탕으로 합니다 — fav_rank 를 빠뜨리면 111 이 되돌아갑니다.
--   이 함수는 «visits·fav_rank 말고 바뀐 칸이 있으면» updated_at 을 지금으로 바꿉니다. 새 두 칸도
--   빼 주지 않으면 아래 채우기 한 줄이 **모든 별점의 updated_at 을 오늘로** 덮습니다(성향·분석·대시보드가 그 시각을 씀).
create or replace function public.ratings_touch_guard()
returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'visits' - 'fav_rank' - 'updated_at' - 'comment_at' - 'journal_at')
     is not distinct from (to_jsonb(old) - 'visits' - 'fav_rank' - 'updated_at' - 'comment_at' - 'journal_at') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end $$;
update public.city_ratings set comment_at = updated_at
 where comment_at is null and nullif(btrim(comment), '') is not null;
update public.city_ratings set journal_at = updated_at
 where journal_at is null and nullif(btrim(journal), '') is not null;

create or replace function public.ratings_written_at()
returns trigger language plpgsql as $$
begin
  if nullif(btrim(new.comment), '') is null then new.comment_at := null;
  elsif tg_op = 'INSERT' or new.comment is distinct from old.comment then new.comment_at := now();
  else new.comment_at := old.comment_at;
  end if;
  if nullif(btrim(new.journal), '') is null then new.journal_at := null;
  elsif tg_op = 'INSERT' or new.journal is distinct from old.journal then new.journal_at := now();
  else new.journal_at := old.journal_at;
  end if;
  return new;
end $$;
drop trigger if exists ratings_written_at on public.city_ratings;
create trigger ratings_written_at before insert or update on public.city_ratings
  for each row execute function public.ratings_written_at();

-- ── 2. 표 ────────────────────────────────────────────────────────────────
create table if not exists public.review_likes (
  liker      uuid not null references auth.users (id) on delete cascade,
  author     uuid not null,
  city_id    text not null,
  created_at timestamptz not null default now(),
  primary key (author, city_id, liker),
  foreign key (author, city_id) references public.city_ratings (user_id, city_id) on delete cascade
);
create index if not exists review_likes_liker_idx on public.review_likes (liker);
alter table public.review_likes enable row level security;

create table if not exists public.review_replies (
  id         bigint generated always as identity primary key,
  author     uuid not null,
  city_id    text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now(),
  foreign key (author, city_id) references public.city_ratings (user_id, city_id) on delete cascade
);
create index if not exists review_replies_review_idx on public.review_replies (author, city_id, created_at);
create index if not exists review_replies_user_idx on public.review_replies (user_id, created_at);
alter table public.review_replies enable row level security;

create table if not exists public.reply_likes (
  reply_id   bigint not null references public.review_replies (id) on delete cascade,
  liker      uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, liker)
);
alter table public.reply_likes enable row level security;
-- (정책 없음 = 앱이 표를 직접 못 읽고 못 씀. 아래 security definer 함수만.)

alter table public.notifications add column if not exists city_id text;

-- 한줄평을 지우면 좋아요·답글도 지움
create or replace function public.review_cleanup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if nullif(btrim(old.comment), '') is not null and nullif(btrim(new.comment), '') is null then
    delete from public.review_likes   where author = new.user_id and city_id = new.city_id;
    delete from public.review_replies where author = new.user_id and city_id = new.city_id;
  end if;
  return null;
end $$;
drop trigger if exists review_cleanup on public.city_ratings;
create trigger review_cleanup after update of comment on public.city_ratings
  for each row execute function public.review_cleanup();

-- 볼 수 있는 후기인가(글이 있고 · 차단 사이 아니고 · 쓴 사람이 off 가 아니거나 나)
create or replace function public.review_ok(p_author uuid, p_city text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.city_ratings r left join public.profiles p on p.id = r.user_id
     where r.user_id = p_author and r.city_id = p_city
       and nullif(btrim(r.comment), '') is not null
       and (auth.uid() is null or not public.blocked_between(auth.uid(), r.user_id))
       and (p.visibility is distinct from 'off' or r.user_id = auth.uid()));
$$;
revoke all on function public.review_ok(uuid, text) from public, anon, authenticated;

-- 남에게 보이는 사람인가(좋아요·답글 단 사람 거르기)
create or replace function public.person_seen(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or p_user = auth.uid() or not public.blocked_between(auth.uid(), p_user))
     and coalesce((select visibility from public.profiles where id = p_user), 'public') <> 'off'
      or p_user = auth.uid();
$$;
revoke all on function public.person_seen(uuid) from public, anon, authenticated;

-- ── 3. 후기 수 · 도시 한줄평 목록 ─────────────────────────────────────────
drop function if exists public.city_stats(text);
create function public.city_stats(p_city text default null)
returns table (city_id text, avg_stars numeric, n_rated int, n_been int, n_want int, n_comment int)
language sql stable security definer set search_path = public as $$
  select r.city_id,
         round(avg(r.stars)::numeric, 2),
         count(*) filter (where r.stars is not null)::int,
         count(*) filter (where r.been)::int,
         count(*) filter (where r.want)::int,
         -- 화면 목록과 같은 기준(off 인 사람 빼고) — 숫자를 눌러 들어갔는데 개수가 다르면 안 됩니다.
         count(*) filter (where nullif(btrim(r.comment), '') is not null
                            and coalesce((select p.visibility from public.profiles p where p.id = r.user_id), 'public') <> 'off')::int
    from public.city_ratings r
   where p_city is null or r.city_id = p_city
   group by r.city_id;
$$;
grant execute on function public.city_stats(text) to anon, authenticated;

drop function if exists public.city_comments(text);
drop function if exists public.city_comments(text, text, int);
create function public.city_comments(p_city text, p_sort text default 'like', p_limit int default 50)
returns table (
  user_id     uuid,
  name        text,
  avatar_url  text,
  stars       numeric,
  comment     text,
  created_at  timestamptz,
  n_like      int,
  n_reply     int,
  liked       boolean,
  is_friend   boolean
)
language sql stable security definer set search_path = public as $$
  select q.* from (
    select r.user_id as user_id,
           coalesce(p.display_name, '여행자') as name,
           p.avatar_url as avatar_url,
           case when coalesce(p.show_stars, true) or r.user_id = auth.uid() then r.stars end as stars,
           r.comment as comment,
           coalesce(r.comment_at, r.updated_at) as created_at,
           (select count(*) from public.review_likes l
             where l.author = r.user_id and l.city_id = r.city_id and public.person_seen(l.liker))::int as n_like,
           (select count(*) from public.review_replies x
             where x.author = r.user_id and x.city_id = r.city_id and public.person_seen(x.user_id))::int as n_reply,
           exists (select 1 from public.review_likes l
                    where l.author = r.user_id and l.city_id = r.city_id and l.liker = auth.uid()) as liked,
           exists (select 1 from public.follows f
                    where f.follower = auth.uid() and f.followee = r.user_id and f.status = 'accepted') as is_friend
      from public.city_ratings r
      left join public.profiles p on p.id = r.user_id
     where r.city_id = p_city
       and nullif(btrim(r.comment), '') is not null
       and (auth.uid() is null or not public.blocked_between(auth.uid(), r.user_id))
       and (p.visibility is distinct from 'off' or r.user_id = auth.uid())
  ) q
  order by case when p_sort = 'new' then null else q.n_like end desc nulls last,
           q.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;
revoke all on function public.city_comments(text, text, int) from public;
grant execute on function public.city_comments(text, text, int) to anon, authenticated;

-- 후기 하나(후기 화면 머리)
create or replace function public.review_one(p_author uuid, p_city text)
returns table (user_id uuid, name text, avatar_url text, stars numeric, comment text, created_at timestamptz,
               n_like int, n_reply int, liked boolean, likers jsonb)
language sql stable security definer set search_path = public as $$
  select r.user_id, coalesce(p.display_name, '여행자'), p.avatar_url,
         case when coalesce(p.show_stars, true) or r.user_id = auth.uid() then r.stars end as stars,
         r.comment, coalesce(r.comment_at, r.updated_at),
         (select count(*) from public.review_likes l
           where l.author = r.user_id and l.city_id = r.city_id and public.person_seen(l.liker))::int,
         (select count(*) from public.review_replies x
           where x.author = r.user_id and x.city_id = r.city_id and public.person_seen(x.user_id))::int,
         exists (select 1 from public.review_likes l
                  where l.author = r.user_id and l.city_id = r.city_id and l.liker = auth.uid()),
         -- 「'○○'님 외 N명이 좋아해요」 — 내가 팔로우하는 사람 먼저, 셋까지
         (select coalesce(jsonb_agg(jsonb_build_object('id', z.liker, 'name', z.name, 'avatar', z.avatar_url)), '[]'::jsonb)
            from (select l.liker, coalesce(pp.display_name, '여행자') as name, pp.avatar_url
                    from public.review_likes l left join public.profiles pp on pp.id = l.liker
                   where l.author = r.user_id and l.city_id = r.city_id and public.person_seen(l.liker)
                   order by exists (select 1 from public.follows f where f.follower = auth.uid()
                                     and f.followee = l.liker and f.status = 'accepted') desc,
                            l.created_at desc
                   limit 3) z)
    from public.city_ratings r left join public.profiles p on p.id = r.user_id
   where r.user_id = p_author and r.city_id = p_city and public.review_ok(p_author, p_city);
$$;
revoke all on function public.review_one(uuid, text) from public;
grant execute on function public.review_one(uuid, text) to anon, authenticated;

-- 답글 목록
create or replace function public.review_replies_list(p_author uuid, p_city text, p_sort text default 'like')
returns table (id bigint, user_id uuid, name text, avatar_url text, body text, created_at timestamptz,
               n_like int, liked boolean)
language sql stable security definer set search_path = public as $$
  select q.* from (
    select x.id as id, x.user_id as user_id, coalesce(p.display_name, '여행자') as name, p.avatar_url as avatar_url,
           x.body as body, x.created_at as created_at,
           (select count(*) from public.reply_likes k where k.reply_id = x.id and public.person_seen(k.liker))::int as n_like,
           exists (select 1 from public.reply_likes k where k.reply_id = x.id and k.liker = auth.uid()) as liked
      from public.review_replies x left join public.profiles p on p.id = x.user_id
     where x.author = p_author and x.city_id = p_city
       and public.review_ok(p_author, p_city)
       and public.person_seen(x.user_id)
  ) q
  order by case when p_sort = 'new' then null else q.n_like end desc nulls last, q.created_at
  limit 200;
$$;
revoke all on function public.review_replies_list(uuid, text, text) from public;
grant execute on function public.review_replies_list(uuid, text, text) to anon, authenticated;

-- ── 4. 누르기 · 쓰기 · 지우기 ─────────────────────────────────────────────
-- 후기 좋아요(p_on = true 누름 / false 취소) → 지금 좋아요 수
create or replace function public.review_like(p_author uuid, p_city text, p_on boolean)
returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 이름 text; 도시 text; n int; 알림 bigint;
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  if p_author = me then raise exception '내 한줄평에는 좋아요를 누를 수 없어요'; end if;
  if p_on then
    -- 누를 때만 따집니다 — 차단·비활성화 뒤에도 «취소»는 되어야 합니다.
    if not public.review_ok(p_author, p_city) then raise exception '볼 수 없는 한줄평이에요'; end if;
    if (select visibility from public.profiles where id = me) = 'off' then
      raise exception '비활성화한 계정은 좋아요를 누를 수 없어요'; end if;
    insert into public.review_likes (liker, author, city_id) values (me, p_author, p_city) on conflict do nothing;
    if found then
      select count(*) into n from public.review_likes where author = p_author and city_id = p_city;
      select coalesce(display_name, '누군가') into 이름 from public.profiles where id = me;
      select name into 도시 from public.cities where id = p_city;
      -- 같은 후기의 안 읽은 좋아요 알림이 있으면 그 줄을 고칩니다(한 줄로 묶기)
      select id into 알림 from public.notifications
       where user_id = p_author and kind = 'review_like' and city_id = p_city and read_at is null
       order by created_at desc limit 1;
      if 알림 is not null then
        update public.notifications
           set body = 이름 || '님' || case when n > 1 then ' 외 ' || (n - 1) || '명이' else '이' end
                      || ' 내 ' || coalesce(도시, '') || ' 한줄평을 좋아해요',
               actor_id = me, created_at = now()
         where id = 알림;
      elsif public.notify_wants(p_author, 'review_like')
            and not exists (select 1 from public.notifications      -- 눌렀다 뗐다 해도 하루 한 번
                             where user_id = p_author and actor_id = me and kind = 'review_like'
                               and city_id = p_city and created_at > now() - interval '1 day') then
        insert into public.notifications (user_id, kind, body, actor_id, city_id)
        values (p_author, 'review_like', 이름 || '님이 내 ' || coalesce(도시, '') || ' 한줄평을 좋아해요', me, p_city);
      end if;
    end if;
  else
    delete from public.review_likes where liker = me and author = p_author and city_id = p_city;
  end if;
  select count(*) into n from public.review_likes l
   where l.author = p_author and l.city_id = p_city and public.person_seen(l.liker);
  return n;
end $$;
revoke all on function public.review_like(uuid, text, boolean) from public, anon;
grant execute on function public.review_like(uuid, text, boolean) to authenticated;

-- 답글 쓰기 → 새 답글 번호
create or replace function public.review_reply_add(p_author uuid, p_city text, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 새 bigint; 이름 text; 도시 text; 글 text := btrim(coalesce(p_body, ''));
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  if char_length(글) = 0 then raise exception '답글을 적어 주세요'; end if;
  if char_length(글) > 300 then raise exception '답글은 300자까지예요'; end if;
  if not public.review_ok(p_author, p_city) then raise exception '볼 수 없는 한줄평이에요'; end if;
  if (select visibility from public.profiles where id = me) = 'off' then
    raise exception '비활성화한 계정은 답글을 달 수 없어요'; end if;
  if (select count(*) from public.review_replies
       where user_id = me and created_at > now() - interval '1 hour') >= 60 then
    raise exception '답글을 너무 많이 달았어요. 잠시 뒤에 다시 해 주세요'; end if;
  insert into public.review_replies (author, city_id, user_id, body) values (p_author, p_city, me, 글)
  returning id into 새;
  if p_author <> me and public.notify_wants(p_author, 'review_reply') then
    select coalesce(display_name, '누군가') into 이름 from public.profiles where id = me;
    select name into 도시 from public.cities where id = p_city;
    insert into public.notifications (user_id, kind, body, actor_id, city_id)
    values (p_author, 'review_reply',
            이름 || '님이 내 ' || coalesce(도시, '') || ' 한줄평에 답글을 달았어요: 「'
              || left(글, 40) || case when char_length(글) > 40 then '…' else '' end || '」',
            me, p_city);
  end if;
  return 새;
end $$;
revoke all on function public.review_reply_add(uuid, text, text) from public, anon;
grant execute on function public.review_reply_add(uuid, text, text) to authenticated;

-- 답글 지우기 — 쓴 사람, 또는 그 후기의 주인
create or replace function public.review_reply_del(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  delete from public.review_replies where id = p_id and (user_id = auth.uid() or author = auth.uid());
  if not found then raise exception '지울 수 없는 답글이에요'; end if;
end $$;
revoke all on function public.review_reply_del(bigint) from public, anon;
grant execute on function public.review_reply_del(bigint) to authenticated;

-- 답글 좋아요 → 지금 좋아요 수(알림은 안 보냄 — 후기 좋아요·답글만)
create or replace function public.reply_like(p_id bigint, p_on boolean)
returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); x record; n int;
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  if not p_on then                     -- 취소는 언제나(차단·비활성화 뒤에도)
    delete from public.reply_likes where reply_id = p_id and liker = me;
  else
    select * into x from public.review_replies where id = p_id;
    if not found or not public.review_ok(x.author, x.city_id) or not public.person_seen(x.user_id) then
      raise exception '볼 수 없는 답글이에요'; end if;
    if x.user_id = me then raise exception '내 답글에는 좋아요를 누를 수 없어요'; end if;
    if (select visibility from public.profiles where id = me) = 'off' then
      raise exception '비활성화한 계정은 좋아요를 누를 수 없어요'; end if;
    insert into public.reply_likes (reply_id, liker) values (p_id, me) on conflict do nothing;
  end if;
  select count(*) into n from public.reply_likes k where k.reply_id = p_id and public.person_seen(k.liker);
  return n;
end $$;
revoke all on function public.reply_like(bigint, boolean) from public, anon;
grant execute on function public.reply_like(bigint, boolean) to authenticated;

-- ── 5. 대시보드 — admin_usage_core (⚠ 118 을 «그대로» 옮겨 와 아래 다섯 줄만 더했습니다) ─────────
--   x_rl·x_rr: 관리자 뺀 좋아요·답글 · total.comments·journals·review_likes·review_replies ·
--   live.comments·journals(오늘) · hours 에 c(새 한줄평)·j(새 일기). 나머지는 118 과 한 글자도 같습니다.
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
      'trips_shared', (select count(*) from (select trip_id from x_tm where left_at is null
                                              group by trip_id having count(*) > 1) q)),

    -- 실시간(112 그대로) — 오늘 숫자와 최근 48시간 한 시간씩(시각은 UTC 로 주고 화면이 바꿈)
    'live', jsonb_build_object(
      'active',  (select count(*) from x_ud where day = today),
      'signups', (select coalesce(sum(n), 0) from sg where d = today),
      'ratings', (select count(*) from rt where d = today),
      'comments', (select count(*) from x_cr where (comment_at at time zone 'Asia/Seoul')::date = today),   -- 122
      'journals', (select count(*) from x_cr where (journal_at at time zone 'Asia/Seoul')::date = today),   -- 122
      'hours',   (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'r', rr, 's', ss, 'c', cc, 'j', jj) order by h), '[]'::jsonb)
                    from (select h,
                            (select count(*) from x_cr x
                              where x.stars is not null and x.created_at >= h
                                and x.created_at < h + interval '1 hour') as rr,
                            (select count(*) from x_au u
                              where u.created_at >= h and u.created_at < h + interval '1 hour') as ss
                              ,(select count(*) from x_cr x where x.comment_at >= h and x.comment_at < h + interval '1 hour') as cc   -- 122
                              ,(select count(*) from x_cr x where x.journal_at >= h and x.journal_at < h + interval '1 hour') as jj   -- 122
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
select (select count(*) from information_schema.columns
         where table_name = 'city_ratings' and column_name in ('comment_at', 'journal_at')) = 2 as 쓴때_칸,
       to_regclass('public.review_likes') is not null and to_regclass('public.review_replies') is not null
         and to_regclass('public.reply_likes') is not null                                as 표_셋,
       pg_get_functiondef('public.city_stats(text)'::regprocedure) like '%n_comment%'     as 후기수,
       pg_get_functiondef('public.admin_usage_core(int)'::regprocedure) like '%x_rr%'
         and pg_get_functiondef('public.admin_usage_core(int)'::regprocedure) like '%k = 10%' as 대시보드,
       -- 0 이어야 함(채우기가 별점 시각을 안 건드렸는지)
       (select count(*) from public.city_ratings where updated_at > now() - interval '2 minutes') as 방금_바뀐_줄;
