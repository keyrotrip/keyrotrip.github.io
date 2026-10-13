-- 129 맛집 추천 사진(b870, 사용자 시안 승인: 추천 하나에 한 장 · 도시 화면 오른쪽 작은 사진 · 추천 글 화면 크게)
--   · 올리기 전에 폰에서 긴 변 1200 으로 줄여 JPEG 로 다시 굽습니다(dom.js fitImage) — 그 과정에서 사진 속 위치 정보(EXIF)가 빠집니다.
--   · 통(food-photos)은 «공개 읽기» — 누구나 주소로 봅니다. 올리기·바꾸기·지우기는 내 폴더(내 id/…)에만.
--   · 신고가 들어오면 «바로» 숨깁니다(사용자: 「사진은 신고 들어오면 일단 바로 내리자」). 관리자가 신고 목록에서 되살릴 수 있습니다.
--     숨긴 사진은 목록 함수들이 null 로 돌려줘 화면에 안 나옵니다(주소는 칸에 남겨 되살리기용).
--   · 목록 함수 셋은 돌려주는 칸이 늘어 지우고 다시 만듭니다(127 그대로 + 사진).

-- ⚠ 쓰는 사람이 있는 중에 돌려도 되게 한 묶음(begin~commit)으로 — 목록 함수를 지우고 다시 만드는 틈이 생기지 않고, 하나라도 실패하면 통째로 취소됩니다.
begin;

alter table public.city_foods add column if not exists photo text;
alter table public.city_foods add column if not exists photo_hidden boolean not null default false;
alter table public.city_foods drop constraint if exists city_foods_photo_len;
alter table public.city_foods add constraint city_foods_photo_len check (photo is null or char_length(photo) <= 500);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-photos', 'food-photos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fphotos_write on storage.objects;
create policy fphotos_write on storage.objects for insert
  with check (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists fphotos_update on storage.objects;
create policy fphotos_update on storage.objects for update
  using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists fphotos_delete on storage.objects;
create policy fphotos_delete on storage.objects for delete
  using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 내 추천 줄에 사진 달기·바꾸기·빼기(p_url null) — 주소는 «내 폴더»의 것만
create or replace function public.food_photo_set(p_id bigint, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 주소 text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  if 주소 is not null and 주소 not like '%/storage/v1/object/public/food-photos/' || me::text || '/%' then
    raise exception '올릴 수 없는 사진 주소예요'; end if;
  update public.city_foods set photo = 주소, photo_hidden = false where id = p_id and user_id = me;
  if not found then raise exception '내 추천이 아니에요'; end if;
end $$;
revoke all on function public.food_photo_set(bigint, text) from public, anon;
grant execute on function public.food_photo_set(bigint, text) to authenticated;

-- 사진 신고 → 바로 숨기고 신고 목록에 남김(관리자 화면이 detail 의 「#food:번호」로 되살리기 단추를 답니다)
create or replace function public.food_photo_report(p_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 주인 uuid; 가게 text; 도시 text; 주소 text;
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  select f.user_id, f.name, c.name, f.photo into 주인, 가게, 도시, 주소
    from public.city_foods f left join public.cities c on c.id = f.city_id where f.id = p_id;
  if 주인 is null or 주소 is null then raise exception '신고할 사진이 없어요'; end if;
  if 주인 = me then raise exception '내 사진은 신고할 수 없어요'; end if;
  perform public.report_user(주인, p_reason, left('[맛집 사진 · ' || coalesce(도시, '') || ' 「' || 가게 || '」] #food:' || p_id || ' ' || 주소, 500));
  update public.city_foods set photo_hidden = true where id = p_id;
end $$;
revoke all on function public.food_photo_report(bigint, text) from public, anon;
grant execute on function public.food_photo_report(bigint, text) to authenticated;

-- 관리자: 숨긴 사진 되살리기 / 아주 내리기(주소 지움)
create or replace function public.admin_food_photo(p_id bigint, p_show boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  if p_show then update public.city_foods set photo_hidden = false where id = p_id;
  else update public.city_foods set photo = null, photo_hidden = false where id = p_id; end if;
end $$;
revoke all on function public.admin_food_photo(bigint, boolean) from public, anon;
grant execute on function public.admin_food_photo(bigint, boolean) to authenticated;

-- ── 목록 함수 셋 — 127 그대로 + 사진(숨긴 것은 null) ──────────────────────────────
drop function if exists public.city_foods_list(text);
create function public.city_foods_list(p_city text)
returns table (name text, n int, note text, note_by text, mine boolean, last_at timestamptz,
               note_uid uuid, note_avatar text, note_id bigint, n_reply int, n_notes int, mine_note boolean,
               note_photo text)
language sql stable security definer set search_path = public as $$
  with v as (
    select f.*, coalesce(p.display_name, '여행자') as who, p.avatar_url as av
      from public.city_foods f left join public.profiles p on p.id = f.user_id
     where f.city_id = p_city
       and (auth.uid() is null or f.user_id = auth.uid() or not public.blocked_between(auth.uid(), f.user_id))
       and (coalesce(p.visibility, 'public') <> 'off' or f.user_id = auth.uid())
  ),
  g as (
    select name_key, count(*)::int as n, bool_or(user_id = auth.uid()) as mine, max(created_at) as last_at,
           count(*) filter (where nullif(btrim(note), '') is not null)::int as n_notes,
           bool_or(user_id = auth.uid() and nullif(btrim(note), '') is not null) as mine_note
      from v group by name_key
  )
  select (select v2.name from v v2 where v2.name_key = g.name_key
           group by v2.name order by count(*) desc, max(v2.created_at) desc limit 1),
         g.n, w.note, w.who, g.mine, g.last_at, w.user_id, w.av, w.id,
         (select count(*) from public.food_replies x where x.food_id = w.id and public.person_seen(x.user_id))::int,
         g.n_notes, coalesce(g.mine_note, false),
         case when w.photo_hidden then null else w.photo end
    from g
    left join lateral (select v3.id, v3.note, v3.who, v3.user_id, v3.av, v3.photo, v3.photo_hidden from v v3
                        where v3.name_key = g.name_key and nullif(btrim(v3.note), '') is not null
                        order by (v3.user_id = auth.uid()) desc, v3.created_at desc limit 1) w on true
   order by g.n desc, g.last_at desc
   limit 50;
$$;
revoke all on function public.city_foods_list(text) from public;
grant execute on function public.city_foods_list(text) to anon, authenticated;

drop function if exists public.food_notes(text, text);
create function public.food_notes(p_city text, p_name text)
returns table (id bigint, user_id uuid, name text, avatar_url text, note text, created_at timestamptz,
               n_reply int, shop text, n_all int, photo text)
language sql stable security definer set search_path = public as $$
  with v as (
    select f.*, coalesce(p.display_name, '여행자') as who, p.avatar_url as av
      from public.city_foods f left join public.profiles p on p.id = f.user_id
     where f.city_id = p_city and f.name_key = public.name_key(p_name)
       and (auth.uid() is null or f.user_id = auth.uid() or not public.blocked_between(auth.uid(), f.user_id))
       and (coalesce(p.visibility, 'public') <> 'off' or f.user_id = auth.uid())
  )
  select v.id, v.user_id, v.who, v.av, v.note, v.created_at,
         (select count(*) from public.food_replies x where x.food_id = v.id and public.person_seen(x.user_id))::int,
         (select v2.name from v v2 group by v2.name order by count(*) desc limit 1),
         (select count(*) from v)::int,
         case when v.photo_hidden then null else v.photo end
    from v
   where nullif(btrim(v.note), '') is not null
   order by v.created_at desc
   limit 100;
$$;
revoke all on function public.food_notes(text, text) from public;
grant execute on function public.food_notes(text, text) to anon, authenticated;

drop function if exists public.food_note_one(bigint);
create function public.food_note_one(p_id bigint)
returns table (id bigint, city_id text, shop text, user_id uuid, name text, avatar_url text, note text,
               created_at timestamptz, n_reply int, photo text)
language sql stable security definer set search_path = public as $$
  select f.id, f.city_id, f.name, f.user_id, coalesce(p.display_name, '여행자'), p.avatar_url, f.note, f.created_at,
         (select count(*) from public.food_replies x where x.food_id = f.id and public.person_seen(x.user_id))::int,
         case when f.photo_hidden then null else f.photo end
    from public.city_foods f left join public.profiles p on p.id = f.user_id
   where f.id = p_id and public.food_note_ok(p_id);
$$;
revoke all on function public.food_note_one(bigint) from public;
grant execute on function public.food_note_one(bigint) to anon, authenticated;

commit;

-- 확인: 넷 다 true 면 된 것
select exists (select 1 from storage.buckets where id = 'food-photos' and public) as 사진_통,
       to_regprocedure('public.food_photo_set(bigint,text)') is not null as 사진_달기,
       to_regprocedure('public.food_photo_report(bigint,text)') is not null as 사진_신고,
       exists (select 1 from information_schema.parameters a join information_schema.routines r on a.specific_name = r.specific_name
                where r.routine_name = 'city_foods_list' and a.parameter_name = 'note_photo') as 목록_사진;
