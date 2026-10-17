-- 142 · 여행 성향 기준 다시 재기 — 관리자만 부르는 «읽기 전용» 표본 (2026-10-17)
-- 사용자: 「2번 해보자」(성향 가운데 값을 30명쯤 모이면 다시 재기로 한 것 — persona v4, b853).
--
-- 무엇을 주나(이름·계정 아이디 없음):
--   saved — 사람마다 저장된 성향 코드와 네 축(persona · persona_ax) · 번호
--   rows  — 사람마다 매긴 도시들 [번호, 도시, 별, 다시 간 횟수]  (별을 3곳 이상 매긴 사람만)
--   번호는 «처음 별을 매긴 순서»로 매긴 1, 2, 3… — 누구인지 알 수 없습니다.
-- 빼는 사람: 「통계에서 뺄 계정」(stats_ignore — 시험 계정 로기). 관리자 본인 기록은 실제 여행이라 넣습니다.
-- ⚠ 고치는 것 없음(읽기만). 관리자가 아니면 오류. 다 재고 나면 지워도 됩니다(아래 맨 끝 줄).
-- 여러 번 실행해도 안전합니다.

create or replace function public.admin_persona_sample()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare 결과 jsonb;
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있어요'; end if;
  with u as (
    select r.user_id, row_number() over (order by min(r.created_at)) as 번호
      from public.city_ratings r
     where r.stars is not null
       and r.user_id not in (select user_id from public.stats_ignore)
     group by r.user_id
    having count(*) >= 3
  )
  select jsonb_build_object(
    'saved', (select coalesce(jsonb_agg(jsonb_build_object('n', u.번호, 'code', p.persona, 'ax', p.persona_ax) order by u.번호), '[]')
                from u join public.profiles p on p.id = u.user_id),
    'rows',  (select coalesce(jsonb_agg(jsonb_build_array(u.번호, r.city_id, r.stars, r.visits) order by u.번호), '[]')
                from u join public.city_ratings r on r.user_id = u.user_id
               where r.stars is not null)
  ) into 결과;
  return 결과;
end $$;
revoke all on function public.admin_persona_sample() from public, anon;
grant execute on function public.admin_persona_sample() to authenticated;

-- 확인: true 면 된 것
select to_regprocedure('public.admin_persona_sample()') is not null as 성향_표본;

-- (다 재고 나서 지우려면) drop function if exists public.admin_persona_sample();
