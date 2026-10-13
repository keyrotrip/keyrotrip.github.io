-- 130 맛집 사진 고침(b870 올리기 전 검토에서 찾음) — 쓰는 중에 돌려도 되게 한 묶음
--   ① 사진 주소는 «우리 저장소의 내 폴더»만(앞에 아무 주소나 붙여 남의 사이트를 걸 수 있었음)
--   ② 신고로 숨긴 사진은 주인이 새 사진으로 덮어 되살릴 수 없게(빼기는 됨)
--   ③ 내 폴더 파일 목록 보기(탈퇴 전에 앱이 내 사진을 지우려고 — 파일이 남으면 계정이 안 지워짐)
--   ④ 관리자는 사진 파일을 지울 수 있게(신고된 사진 「사진 지우기」)
--   ⑤ 관리자 「최근 신고와 오류」에 누가 보냈는지 · 처리함 · 지우기
begin;

create or replace function public.food_photo_set(p_id bigint, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 주소 text := nullif(btrim(coalesce(p_url, '')), ''); 숨김 boolean;
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  select photo_hidden into 숨김 from public.city_foods where id = p_id and user_id = me;
  if not found then raise exception '내 추천이 아니에요'; end if;
  if 주소 is not null then
    if 주소 not like 'https://qahqqhjleqfrsjiixnas.supabase.co/storage/v1/object/public/food-photos/' || me::text || '/%'
       or 주소 ~ '[''"()<>\s\\]' then
      raise exception '올릴 수 없는 사진 주소예요'; end if;
    if 숨김 then raise exception '신고된 사진이 있어 확인이 끝날 때까지 새 사진을 올릴 수 없어요'; end if;
    update public.city_foods set photo = 주소 where id = p_id;
  else
    update public.city_foods set photo = null, photo_hidden = false where id = p_id;
  end if;
end $$;
revoke all on function public.food_photo_set(bigint, text) from public, anon;
grant execute on function public.food_photo_set(bigint, text) to authenticated;

drop policy if exists fphotos_read_own on storage.objects;
create policy fphotos_read_own on storage.objects for select
  using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists fphotos_admin_delete on storage.objects;
create policy fphotos_admin_delete on storage.objects for delete
  using (bucket_id = 'food-photos' and public.is_admin());

-- ⑤ 관리자 「최근 신고와 오류」 — 누가 보냈는지 · 지우기(사용자: 「최근 신고와 오류도 내가 지우거나 할 수 있게 · 누가 제보했는지는 알아야지」)
--   돌려주는 칸이 늘어 지우고 다시 만듭니다(040 그대로 + id · 누구 · 사람 id · 사람 수).
drop function if exists public.admin_feed();
create function public.admin_feed()
returns table (kind text, body text, build text, at timestamptz, n bigint, id bigint, who text, who_id uuid, people bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있습니다'; end if;
  return query
  select '신고'::text, r.body, r.build, r.created_at, 1::bigint, r.id,
         coalesce(p.display_name, case when r.user_id is null then '탈퇴한 사람' else '이름 없음' end), r.user_id, 1::bigint
    from public.reports r left join public.profiles p on p.id = r.user_id
   where r.handled_at is null
   order by r.created_at desc
   limit 20;
  -- 오류는 메시지로 묶습니다. 한 사람에게서만 났으면 그 이름, 여럿이면 사람 수.
  return query
  select '오류'::text, e.message, max(e.build), max(e.created_at), count(*), null::bigint,
         case when count(distinct e.user_id) = 1 then coalesce(max(p.display_name), '이름 없음')
              when count(distinct e.user_id) = 0 then '로그인 전'
              else null end,
         case when count(distinct e.user_id) = 1 then (array_agg(e.user_id) filter (where e.user_id is not null))[1] end,
         count(distinct e.user_id)
    from public.client_errors e left join public.profiles p on p.id = e.user_id
   where e.created_at > now() - interval '30 days'
   group by e.message
   order by count(*) desc
   limit 20;
end $$;
revoke all on function public.admin_feed() from public, anon;
grant execute on function public.admin_feed() to authenticated;

-- 버그 신고·의견: 처리함(목록에서 빠짐) / 지우기
create or replace function public.admin_report_act(p_id bigint, p_del boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  if p_del then delete from public.reports where id = p_id;
  else update public.reports set handled_at = now() where id = p_id; end if;
end $$;
revoke all on function public.admin_report_act(bigint, boolean) from public, anon;
grant execute on function public.admin_report_act(bigint, boolean) to authenticated;

-- 오류 지우기 — 같은 메시지로 묶인 것을 통째로(고친 오류를 목록에서 걷을 때)
create or replace function public.admin_error_del(p_message text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  delete from public.client_errors where message = p_message;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.admin_error_del(text) from public, anon;
grant execute on function public.admin_error_del(text) to authenticated;

commit;

-- 확인: 셋 다 true 면 된 것
select pg_get_functiondef('public.food_photo_set(bigint,text)'::regprocedure) like '%qahqqhjleqfrsjiixnas%' as 주소_묶음,
       to_regprocedure('public.admin_error_del(text)') is not null as 오류_지우기,
       exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'fphotos_admin_delete') as 관리자_지우기;
