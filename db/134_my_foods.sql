-- 134 · 보관함 「맛집 추천」 칸(b873, 사용자: 「보관함에 한줄평 밑에 맛집 후기까지」 → 이름은 「맛집 추천」)
--   · 내가 남긴 맛집 추천을 전부(한마디 없는 것도) — 가게 이름 · 도시 · 한마디 · 사진 · 같은 가게를 추천한 다른 사람 수 · 답글 수
--   · 읽기만 합니다. 쓰는 사람이 있어도 돌려도 됩니다.
begin;

create or replace function public.my_foods()
returns table (id bigint, city_id text, name text, note text, photo text, created_at timestamptz,
               n_other int, n_reply int)
language sql stable security definer set search_path = public as $$
  select f.id, f.city_id, f.name, nullif(btrim(f.note), ''),
         case when f.photo_hidden then null else f.photo end,
         f.created_at,
         (select count(*) from public.city_foods o
           where o.city_id = f.city_id and o.name_key = f.name_key and o.user_id <> f.user_id
             and public.person_seen(o.user_id))::int,
         (select count(*) from public.food_replies x where x.food_id = f.id and public.person_seen(x.user_id))::int
    from public.city_foods f
   where f.user_id = auth.uid()
   order by f.created_at desc
   limit 500;
$$;
revoke all on function public.my_foods() from public, anon;
grant execute on function public.my_foods() to authenticated;

commit;

-- 확인: true 면 된 것
select to_regprocedure('public.my_foods()') is not null as 내_맛집;
