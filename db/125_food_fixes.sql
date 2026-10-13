-- 125 · 맛집 추천 고침 둘 (2026-10-13) — 124 를 올리기 전 코드 검토에서 찾음
-- ① 공백·눈에 안 보이는 글자로만 된 가게 이름은 name_key 가 null 이라 「null value in column name_key」 원문 오류가 떴습니다
--    → 그 경우 「가게 이름을 적어 주세요」로 막습니다(food_add 를 통째로 다시 만듦 — 124 와 나머지는 같음).
-- ② 내 추천을 지울 길이 없었습니다(잘못 쓴 가게 이름이 내 이름과 함께 남음) → food_del_mine(도시, 가게 이름).
--    화면에는 id 를 안 내주므로(묶은 목록) 이름으로 지웁니다 — 띄어쓰기·대소문자 무시(name_key).
-- 다시 돌려도 됩니다.

create or replace function public.food_add(p_city text, p_name text, p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 이름 text := btrim(coalesce(p_name, '')); 말 text := nullif(btrim(coalesce(p_note, '')), ''); 새 bigint;
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  if char_length(이름) = 0 or public.name_key(이름) is null then raise exception '가게 이름을 적어 주세요'; end if;
  if char_length(이름) > 40 then raise exception '가게 이름은 40자까지예요'; end if;
  if 말 is not null and char_length(말) > 60 then raise exception '한줄평은 60자까지예요'; end if;
  if not exists (select 1 from public.cities where id = p_city) then raise exception '없는 도시예요'; end if;
  if (select visibility from public.profiles where id = me) = 'off' then
    raise exception '비활성화한 계정은 추천할 수 없어요'; end if;
  if (select count(*) from public.city_foods where user_id = me and created_at > now() - interval '1 hour') >= 30 then
    raise exception '추천을 너무 많이 했어요. 잠시 뒤에 다시 해 주세요'; end if;
  insert into public.city_foods (user_id, city_id, name, name_key, note)
  values (me, p_city, 이름, public.name_key(이름), 말)
  on conflict (user_id, city_id, name_key) do update set note = coalesce(excluded.note, city_foods.note), name = excluded.name
  returning id into 새;
  return 새;
end $$;
revoke all on function public.food_add(text, text, text) from public, anon;
grant execute on function public.food_add(text, text, text) to authenticated;

create or replace function public.food_del_mine(p_city text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  delete from public.city_foods
   where user_id = auth.uid() and city_id = p_city and name_key = public.name_key(p_name);
end $$;
revoke all on function public.food_del_mine(text, text) from public, anon;
grant execute on function public.food_del_mine(text, text) to authenticated;

-- 확인: 둘 다 true 면 된 것
select pg_get_functiondef('public.food_add(text,text,text)'::regprocedure) like '%name_key(이름) is null%' as 빈이름_막기,
       to_regprocedure('public.food_del_mine(text,text)') is not null as 내추천_지우기;
