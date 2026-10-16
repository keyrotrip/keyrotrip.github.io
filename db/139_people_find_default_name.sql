-- 139 · 친구 찾기 — 기본 이름 「여행자 1234」도 앞글자로 찾히게 (2026-10-16)
-- 사용자: 「여행자로만 찾게 해주고 — 어차피 그게 누군지 알 수 없는 거 아냐?」
--   121 은 기본 이름(db/120)을 «끝까지 똑같이» 쳐야만 보여 줬습니다(「여행자」만 쳐서 새 가입자 줄을 훑지 못하게).
--   그런데 기본 이름은 메일과 무관한 무작위 숫자라 누군지 드러나지 않습니다 → 다른 이름과 똑같이 «앞글자가 같으면».
-- 바꾼 것: 121 의 people_find 에서 「여행자+숫자는 똑같을 때만」 한 줄만 뺐습니다. 나머지는 121 그대로:
--   · 한 번에 20명 · 똑같은 이름 맨 위 → 내가 팔로우하는 사람 → 짧은 이름
--   · 처음 이름(메일 앞부분) 빼기 · 차단 · 비활성화(off) 빼기
-- 다시 돌려도 됩니다(create or replace). 되돌리려면 121 을 다시 돌리면 됩니다.

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

-- 확인: 둘 다 true 면 된 것
select pg_get_functiondef('public.people_find(text)'::regprocedure) like '%starts_with%'      as 앞글자_찾기,
       pg_get_functiondef('public.people_find(text)'::regprocedure) not like '%여행자%'       as 기본이름_제한_뺌;
