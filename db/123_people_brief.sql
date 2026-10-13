-- 123 · 알림 줄의 사람 사진·이름 (2026-10-13)
-- 사용자: 「소식탭 / 팔로워 / 팔로잉도 인스타처럼」 → ♡ 알림 화면(activity.js)이 줄마다 «누가» 했는지 사진을 보여 줍니다.
-- 알림(notifications)에는 actor_id 만 있고, profiles 는 RLS 로 «나·같은 여행 일행»만 읽힙니다(001).
-- 그래서 id 여럿을 받아 이름·사진만 돌려주는 함수를 둡니다 — 차단한 사이 · 비활성화(off)는 빼고(106 규칙).
-- 다시 돌려도 됩니다.

create or replace function public.people_brief(p_ids uuid[])
returns table (user_id uuid, name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.display_name, '여행자'), p.avatar_url
    from public.profiles p
   where auth.uid() is not null
     and p.id = any(p_ids)
     and (p.id = auth.uid()
          or (not public.blocked_between(auth.uid(), p.id) and p.visibility <> 'off'))
   limit 200;
$$;
revoke all on function public.people_brief(uuid[]) from public, anon;
grant execute on function public.people_brief(uuid[]) to authenticated;

-- 확인: true 면 된 것
select to_regprocedure('public.people_brief(uuid[])') is not null as 사람_사진_함수;
