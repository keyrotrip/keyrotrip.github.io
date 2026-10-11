-- =====================================================================
-- 119 · 친구 중 여행 메이트 — 내가 팔로우하는 사람들의 성향 코드 (2026-10-11)
--
-- 사용자: 분석 탭 아이디어에서 「성향 2,3,4 / 별점 1 만들자」 — ④ 친구 중 여행 메이트.
-- 화면(pmore.js)이 내 코드와 친구 코드로 궁합을 냅니다 — 「여행 궁합」 카드와 같은 셈(card.js personaMatch).
-- ⚠ follow_people(106)은 이름·사진만 줍니다. person_body(110)는 성향을 주지만 그 사람의 별점 목록까지 싣고 와서
--   친구마다 부르기엔 무겁습니다 — 코드 하나만 주는 함수를 따로 둡니다.
-- ⚠ 거르는 규칙은 106·110 과 같습니다: 팔로우가 수락된 사람만 · 비활성화(off) 뺌 · 차단 사이 뺌 · can_see_person.
--   성향이 없는(확정 전) 사람은 안 줍니다 — 서버 성향은 해외 10곳을 넘겨 확정됐을 때만 적힙니다(pshift).
-- ⚠ 앱은 이 함수가 없으면 카드를 조용히 안 냅니다(옛 판 서버에서도 안 깨짐). 그래도 화면을 올리기 «전에» 돌려 주십시오.
-- 여러 번 실행해도 안전합니다.
-- =====================================================================

create or replace function public.friend_personas()
returns table (user_id uuid, name text, avatar_url text, persona text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, p.persona
    from public.follows f
    join public.profiles p on p.id = f.followee
   where auth.uid() is not null
     and f.follower = auth.uid() and f.status = 'accepted'
     and p.visibility <> 'off'
     and not public.blocked_between(auth.uid(), f.followee)
     and public.can_see_person(auth.uid(), f.followee)
     and p.persona ~ '^[FH][ML][ND][GP]$'
   order by coalesce(f.accepted_at, f.created_at) desc
   limit 200;
$$;
revoke all on function public.friend_personas() from public, anon;
grant execute on function public.friend_personas() to authenticated;

-- ── 확인 ── 함수가 생겼고, 로그인 안 한 사람은 못 부르는지 봅니다.
--   (SQL 편집기는 로그인한 사람이 아니라서 함수를 불러도 빈 결과가 맞습니다 — 그래서 부르지 않고 이 둘만 봅니다.)
select to_regprocedure('public.friend_personas()') is not null                        as 함수_있음,
       has_function_privilege('anon', 'public.friend_personas()', 'execute')          as 로그인_안한_사람도_부름,
       has_function_privilege('authenticated', 'public.friend_personas()', 'execute') as 로그인한_사람은_부름;
