-- 126 맛집 줄을 한줄평 줄과 같은 모양으로(b862, 사용자: 「맛집도 한줄평이랑 같은 줄 모양으로 가자」)
--   한줄평을 쓴 사람의 id·사진을 더 돌려줍니다(누르면 그 사람 화면 · 동그란 사진).
--   돌려주는 칸이 바뀌어 create or replace 로는 안 됩니다 — 지우고 다시 만듭니다. 거르는 규칙(차단·비활성)은 124 그대로.
--   「추천」 단추는 서버를 안 바꿉니다: 누르면 food_add(같은 이름, 한줄평 없이) · 다시 누르면 food_del_mine.

drop function if exists public.city_foods_list(text);
create function public.city_foods_list(p_city text)
returns table (name text, n int, note text, note_by text, mine boolean, last_at timestamptz,
               note_uid uuid, note_avatar text)
language sql stable security definer set search_path = public as $$
  with v as (
    select f.*, coalesce(p.display_name, '여행자') as who, p.avatar_url as av
      from public.city_foods f left join public.profiles p on p.id = f.user_id
     where f.city_id = p_city
       and (auth.uid() is null or f.user_id = auth.uid() or not public.blocked_between(auth.uid(), f.user_id))
       and (coalesce(p.visibility, 'public') <> 'off' or f.user_id = auth.uid())
  ),
  g as (
    select name_key, count(*)::int as n, bool_or(user_id = auth.uid()) as mine, max(created_at) as last_at
      from v group by name_key
  )
  select (select v2.name from v v2 where v2.name_key = g.name_key
           group by v2.name order by count(*) desc, max(v2.created_at) desc limit 1),
         g.n, w.note, w.who, g.mine, g.last_at, w.user_id, w.av
    from g
    left join lateral (select v3.note, v3.who, v3.user_id, v3.av from v v3
                        where v3.name_key = g.name_key and v3.note is not null
                        order by v3.created_at desc limit 1) w on true
   order by g.n desc, g.last_at desc
   limit 50;
$$;
revoke all on function public.city_foods_list(text) from public;
grant execute on function public.city_foods_list(text) to anon, authenticated;

-- 확인: true 면 된 것
select exists (select 1 from information_schema.routines r
                 join information_schema.parameters a on a.specific_name = r.specific_name
                where r.routine_name = 'city_foods_list' and a.parameter_name = 'note_avatar') as 사진_칸;
