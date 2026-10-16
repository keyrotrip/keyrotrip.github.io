-- 138 방명록 (2026-10-16, 사용자: 보관함 빈 칸 → 「방명록으로 가자」 · 「비밀 댓글도 가능하게」)
--
-- 정한 것(사용자):
--   쓰는 사람  — 그 사람 화면을 볼 수 있는 사람(can_see_person: 공개면 로그인한 누구나 · 비공개면 승인된 팔로워 · 차단 사이는 안 됨)
--   보는 사람  — 그 사람 화면을 보는 사람 모두(공개 글 + 주인의 답)
--   비밀 글    — 주인과 쓴 사람 둘만. 다른 사람에게는 «비밀 글이에요» 자리만(쓴 사람 이름·답도 안 보임)
--   답        — 주인만, 글마다 한 줄(100자) · 고치기 · 지우기
--   지우기    — 주인 또는 쓴 사람
--   신고      — 글을 바로 가리고(주인에게만 «가려짐»으로 보임) 관리자 「사람 신고」(people_reports)에 글 내용과 함께
--
-- 짜임은 맛집 답글(127)과 같습니다: 표는 RLS 만 켜고 정책을 안 둡니다 → 앱은 표를 직접 못 읽고 못 씀.
--   아래 security definer 함수만 통로입니다(그래야 비밀 글 본문이 남에게 «절대» 안 나갑니다 — 거르기가 서버에 있음).
-- 계정을 지우면(delete-me) 그 사람이 받은 글·쓴 글이 같이 지워집니다(on delete cascade).
-- 여러 번 실행해도 안전합니다.

create table if not exists public.guestbook (
  id         bigint generated always as identity primary key,
  owner      uuid not null references auth.users (id) on delete cascade,   -- 방명록 주인
  author     uuid not null references auth.users (id) on delete cascade,   -- 쓴 사람
  body       text not null check (char_length(btrim(body)) between 1 and 200),
  secret     boolean not null default false,
  reply      text check (reply is null or char_length(btrim(reply)) between 1 and 100),
  reply_at   timestamptz,
  hidden_at  timestamptz,            -- 신고로 가림(주인에게만 «가려짐»으로 보임)
  created_at timestamptz not null default now(),
  check (owner <> author)
);
create index if not exists guestbook_owner_idx  on public.guestbook (owner, created_at desc);
create index if not exists guestbook_author_idx on public.guestbook (author, created_at desc);
alter table public.guestbook enable row level security;
-- (정책 없음 = 앱이 표를 직접 못 읽고 못 씀. 아래 함수만.)


-- ── 읽기 — 그 사람 방명록 ───────────────────────────────────────────────
-- 비밀 글: 주인·쓴 사람이 아니면 본문·이름·사진·답을 비우고(null) secret=true 만 돌려줍니다.
-- 가려진 글(신고): 주인에게만(hidden=true). 쓴 사람이 차단 사이·비활성이면 빠집니다(person_seen).
create or replace function public.guestbook_list(p_owner uuid)
returns table (id bigint, author uuid, name text, avatar_url text, body text, secret boolean,
               reply text, reply_at timestamptz, hidden boolean, created_at timestamptz,
               mine boolean, owner_me boolean)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid)
  select g.id,
         case when 열림 then g.author end,
         case when 열림 then coalesce(p.display_name, '여행자') end,
         case when 열림 then p.avatar_url end,
         case when 열림 then g.body end,
         g.secret,
         case when 열림 then g.reply end,
         case when 열림 then g.reply_at end,
         g.hidden_at is not null,
         g.created_at,
         g.author = (select uid from me),
         g.owner  = (select uid from me)
    from public.guestbook g
    left join public.profiles p on p.id = g.author
    cross join lateral (select (not g.secret
                                or g.owner  = (select uid from me)
                                or g.author = (select uid from me)) as 열림) x
   where (select uid from me) is not null
     and g.owner = p_owner
     and public.can_see_person((select uid from me), p_owner)
     and (g.hidden_at is null or g.owner = (select uid from me))
     and public.person_seen(g.author)
   order by g.created_at desc
   limit 200;
$$;
revoke all on function public.guestbook_list(uuid) from public, anon;
grant execute on function public.guestbook_list(uuid) to authenticated;


-- ── 내 방명록 숫자 — 보관함 칸 ──────────────────────────────────────────
-- 받은 글 수(가려진 것 빼고) · 답을 아직 안 단 글 수
create or replace function public.my_guestbook_stats()
returns table (total int, waiting int)
language sql stable security definer set search_path = public as $$
  select count(*)::int,
         count(*) filter (where g.reply is null)::int
    from public.guestbook g
   where g.owner = auth.uid() and g.hidden_at is null and public.person_seen(g.author);
$$;
revoke all on function public.my_guestbook_stats() from public, anon;
grant execute on function public.my_guestbook_stats() to authenticated;


-- ── 쓰기 → 새 번호 · 주인에게 알림 ──────────────────────────────────────
create or replace function public.guestbook_add(p_owner uuid, p_body text, p_secret boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 새 bigint; 이름 text; 글 text := btrim(coalesce(p_body, ''));
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  if p_owner is null or p_owner = me then raise exception '내 방명록에는 쓸 수 없어요'; end if;
  if char_length(글) = 0 then raise exception '남길 말을 적어 주세요'; end if;
  if char_length(글) > 200 then raise exception '방명록은 200자까지예요'; end if;
  if not public.can_see_person(me, p_owner) then raise exception '이 사람의 방명록에는 쓸 수 없어요'; end if;
  if (select visibility from public.profiles where id = me) = 'off' then
    raise exception '비활성화한 계정은 방명록을 쓸 수 없어요'; end if;
  /* 도배 막기 — 한 사람의 방명록에 하루 5개까지(그 사람마다 따로 셈 · 다른 사람 방명록과는 상관없음 · 사용자 10-16) */
  if (select count(*) from public.guestbook
       where author = me and owner = p_owner and created_at > now() - interval '1 day') >= 5 then
    raise exception '이 사람 방명록에는 오늘 더 쓸 수 없어요. 내일 다시 해 주세요'; end if;
  insert into public.guestbook (owner, author, body, secret)
  values (p_owner, me, 글, coalesce(p_secret, false)) returning id into 새;
  if public.notify_wants(p_owner, 'guestbook') then
    select coalesce(display_name, '누군가') into 이름 from public.profiles where id = me;
    insert into public.notifications (user_id, kind, body, actor_id)
    values (p_owner, 'guestbook',
            case when coalesce(p_secret, false)
                 then 이름 || '님이 비밀 방명록을 남겼어요'
                 else 이름 || '님이 방명록을 남겼어요: 「' || left(글, 40)
                        || case when char_length(글) > 40 then '…' else '' end || '」' end,
            me);
  end if;
  return 새;
end $$;
revoke all on function public.guestbook_add(uuid, text, boolean) from public, anon;
grant execute on function public.guestbook_add(uuid, text, boolean) to authenticated;


-- ── 주인의 한 줄 답 — 달기·고치기(빈 글이면 지우기) · 처음 달 때만 쓴 사람에게 알림 ──
create or replace function public.guestbook_reply(p_id bigint, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 답 text := nullif(btrim(coalesce(p_reply, '')), ''); 쓴이 uuid; 전답 text; 이름 text;
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  if char_length(답) > 100 then raise exception '답은 100자까지예요'; end if;
  select g.author, g.reply into 쓴이, 전답 from public.guestbook g where g.id = p_id and g.owner = me;
  if not found then raise exception '답을 달 수 없는 글이에요'; end if;
  update public.guestbook set reply = 답, reply_at = case when 답 is null then null else now() end
   where id = p_id;
  if 전답 is null and 답 is not null and public.notify_wants(쓴이, 'guestbook_reply') then
    select coalesce(display_name, '누군가') into 이름 from public.profiles where id = me;
    insert into public.notifications (user_id, kind, body, actor_id)
    values (쓴이, 'guestbook_reply',
            이름 || '님이 방명록에 답을 달았어요: 「' || left(답, 40)
              || case when char_length(답) > 40 then '…' else '' end || '」',
            me);
  end if;
end $$;
revoke all on function public.guestbook_reply(bigint, text) from public, anon;
grant execute on function public.guestbook_reply(bigint, text) to authenticated;


-- ── 지우기 — 주인 또는 쓴 사람 ───────────────────────────────────────────
create or replace function public.guestbook_del(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  delete from public.guestbook g where g.id = p_id and (g.owner = auth.uid() or g.author = auth.uid());
  if not found then raise exception '지울 수 없는 글이에요'; end if;
end $$;
revoke all on function public.guestbook_del(bigint) from public, anon;
grant execute on function public.guestbook_del(bigint) to authenticated;


-- ── 신고 — 바로 가리고, 관리자 「사람 신고」에 글 내용과 함께 ─────────────
-- 볼 수 있는 글만 신고할 수 있습니다(비밀 글은 주인만). 쓴 사람은 자기 글을 신고하지 않습니다(지우면 됨).
-- 사유는 people_reports 의 다섯 가지 중 하나여야 합니다(report_user 가 거름) · 하루 10번(같은 상한).
create or replace function public.guestbook_report(p_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.guestbook;
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  select * into g from public.guestbook where id = p_id;
  if not found or g.author = me
     or not public.can_see_person(me, g.owner)
     or (g.secret and g.owner <> me) then
    raise exception '신고할 수 없는 글이에요'; end if;
  perform public.report_user(g.author, p_reason, '방명록: ' || left(g.body, 300));
  update public.guestbook set hidden_at = coalesce(hidden_at, now()) where id = p_id;
end $$;
revoke all on function public.guestbook_report(bigint, text) from public, anon;
grant execute on function public.guestbook_report(bigint, text) to authenticated;


-- ── 내 자료 받기(account.js) — 내가 쓴 글 + 내 방명록에 받은 글 ─────────────
-- 표를 앱이 직접 못 읽으므로(정책 없음) 이 함수로 받습니다. 남의 방명록에 달린 남의 글은 안 줍니다.
create or replace function public.my_guestbook_dump()
returns setof public.guestbook
language sql stable security definer set search_path = public as $$
  select * from public.guestbook
   where auth.uid() is not null and (owner = auth.uid() or author = auth.uid())
   order by created_at;
$$;
revoke all on function public.my_guestbook_dump() from public, anon;
grant execute on function public.my_guestbook_dump() to authenticated;


-- ── 확인: 모두 true 면 된 것 ────────────────────────────────────────────
select to_regclass('public.guestbook') is not null                                   as 방명록_표,
       not exists (select 1 from pg_policies where tablename = 'guestbook')           as 앱직접접근_막힘,
       to_regprocedure('public.guestbook_list(uuid)') is not null                     as 읽기,
       to_regprocedure('public.guestbook_add(uuid,text,boolean)') is not null         as 쓰기,
       to_regprocedure('public.guestbook_reply(bigint,text)') is not null             as 답,
       to_regprocedure('public.guestbook_del(bigint)') is not null                    as 지우기,
       to_regprocedure('public.guestbook_report(bigint,text)') is not null            as 신고,
       to_regprocedure('public.my_guestbook_stats()') is not null                     as 보관함_숫자,
       to_regprocedure('public.my_guestbook_dump()') is not null                      as 내자료_받기;
