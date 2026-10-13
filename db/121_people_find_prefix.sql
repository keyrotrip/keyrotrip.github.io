-- 121 · 친구 찾기를 «앞글자가 같으면»으로 (2026-10-13)
-- 사용자: 「윤 입력만 해도 뜨게 해주고, 인스타 검색기능처럼 가보자」 → 찾는 범위 「앞글자가 같으면」을 고름.
-- 바꾼 것: people_find 가 이름이 «똑같을 때만»(101·106) → «앞글자가 같으면»(띄어쓰기·대소문자 무시는 그대로).
--   · 한 번에 20명까지 — 목록을 통째로 긁기 어렵게(이름 순서대로 다 받으려면 글자마다 따로 물어야 함).
--   · 똑같은 이름이 맨 위, 다음은 내가 팔로우하는 사람, 다음은 짧은 이름.
--   · 기본 이름 「여행자 1234」(db/120)는 «끝까지 똑같이» 쳐야만 나옴 — 「여행자」만 쳐서 새 가입자 줄을 훑지 못하게.
--   · 처음 이름(메일 앞부분) 빼기 · 차단 · 비활성화(off) 빼기는 106 그대로.
-- 다시 돌려도 됩니다(create or replace). 되돌리려면 106 의 6번 칸만 다시 돌리면 됩니다.

create or replace function public.people_find(p_name text)
returns table (user_id uuid, name text, avatar_url text, mine text)
language sql stable security definer set search_path = public as $$
  with q as (select public.name_key(p_name) as k)
  select p.id, p.display_name, p.avatar_url,
         (select f.status from public.follows f where f.follower = auth.uid() and f.followee = p.id)
    from public.profiles p, q
   where auth.uid() is not null
     and q.k is not null
     and starts_with(public.name_key(p.display_name), q.k)
     and (public.name_key(p.display_name) = q.k
          or public.name_key(p.display_name) !~ '^여행자[0-9]+$')
     and not public.blocked_between(auth.uid(), p.id)
     and p.visibility <> 'off'
     -- ⚠ 처음 이름(메일 앞부분)은 찾기에서 뺍니다(101 머리말).
     and not exists (select 1 from auth.users u
                      where u.id = p.id
                        and public.name_key(split_part(u.email, '@', 1)) = public.name_key(p.display_name))
   order by (public.name_key(p.display_name) = q.k) desc,
            exists (select 1 from public.follows f
                     where f.follower = auth.uid() and f.followee = p.id and f.status = 'accepted') desc,
            char_length(p.display_name), p.display_name
   limit 20;
$$;
revoke all on function public.people_find(text) from public, anon;
grant execute on function public.people_find(text) to authenticated;

-- 확인: 「앞글자」가 들어갔으면 true
select pg_get_functiondef('public.people_find(text)'::regprocedure) like '%starts_with%' as 앞글자_찾기;
