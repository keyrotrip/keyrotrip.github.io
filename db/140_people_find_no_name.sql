-- 140 · 친구 찾기 — 이름이 비어 있는(「여행자」로만 보이는) 사람도 「여행자」로 찾히게 (2026-10-16)
-- 사용자: 「그냥 이름이 여행자인 사람은 안 나오는데?」
--   이름(display_name)이 null 인 사람은 화면에서 「여행자」로 보이지만(friends.js·people.js 등),
--   서버에는 이름이 없어서 139 의 앞글자 찾기에 걸릴 글자가 없었습니다.
-- 바꾼 것: 139 의 people_find 에서 이름 자리를 coalesce(display_name, '여행자') 로 — 남에게 보이는 이름 그대로 찾고 돌려줍니다.
--   나머지(20명 · 순서 · 처음 이름(메일 앞부분)·차단·비활성화 빼기)는 139 그대로.
-- 다시 돌려도 됩니다(create or replace). 되돌리려면 139 를 다시 돌리면 됩니다.

create or replace function public.people_find(p_name text)
returns table (user_id uuid, name text, avatar_url text, mine text)
language sql stable security definer set search_path = public as $$
  with q as (select public.name_key(p_name) as k)
  select p.id, coalesce(p.display_name, '여행자'), p.avatar_url,
         (select f.status from public.follows f where f.follower = auth.uid() and f.followee = p.id)
    from public.profiles p, q
   where auth.uid() is not null
     and q.k is not null
     and starts_with(public.name_key(coalesce(p.display_name, '여행자')), q.k)
     and not public.blocked_between(auth.uid(), p.id)
     and p.visibility <> 'off'
     -- ⚠ 처음 이름(메일 앞부분)은 찾기에서 뺍니다(101 머리말). 이름이 비었으면 해당 없음.
     and not exists (select 1 from auth.users u
                      where u.id = p.id
                        and public.name_key(split_part(u.email, '@', 1)) = public.name_key(p.display_name))
   order by (public.name_key(coalesce(p.display_name, '여행자')) = q.k) desc,
            exists (select 1 from public.follows f
                     where f.follower = auth.uid() and f.followee = p.id and f.status = 'accepted') desc,
            char_length(coalesce(p.display_name, '여행자')), coalesce(p.display_name, '여행자')
   limit 20;
$$;
revoke all on function public.people_find(text) from public, anon;
grant execute on function public.people_find(text) to authenticated;

-- 확인: 앞 두 칸이 true 면 된 것 · 셋째 칸은 이번에 새로 찾히게 된 「이름 빈 사람」 수(비활성화 빼고)
select pg_get_functiondef('public.people_find(text)'::regprocedure) like '%starts_with%'                  as 앞글자_찾기,
       pg_get_functiondef('public.people_find(text)'::regprocedure) like '%coalesce(p.display_name%'      as 이름빈사람_찾기,
       (select count(*) from public.profiles where display_name is null and visibility <> 'off')        as 이름빈_사람수;
