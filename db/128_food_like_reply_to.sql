-- 128 (한 번에 돌리는 묶음 — 사용자: 「sql은 다 합쳐서 한방에」)
--   ① 맛집 👍 알림  ② 답글에 답하기(, A안)
--
-- ① 맛집 👍 알림(b869, 사용자: 「다 알림오는데 맛집 추천 따봉 누른건 알림이 안오네」)
--   누가 👍 (= 이미 있는 가게에 새로 추천 한 줄)를 누르면 그 가게를 «처음» 추천한 사람에게 알림 하나.
--   한줄평 좋아요(122 review_like)처럼 안 읽은 같은 가게 알림이 있으면 그 줄을 고쳐 「○○님 외 N명이」로 묶고,
--   눌렀다 뗐다 해도 같은 사람은 하루 한 번만.
--   food_add 를 통째로 다시 만듭니다 — 125 와 다른 곳은 «새 줄이 들어갔을 때 알림» 블록뿐.
--   알림 줄 kind = 'food_like', city_id = 도시, food_id = 처음 추천 줄(누르면 앱이 그 도시 화면으로).

create or replace function public.food_add(p_city text, p_name text, p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 이름 text := btrim(coalesce(p_name, '')); 말 text := nullif(btrim(coalesce(p_note, '')), '');
        새 bigint; 새줄 boolean; 처음id bigint; 처음사람 uuid; n int; 누구 text; 도시 text; 알림 bigint;
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
  returning id, (xmax = 0) into 새, 새줄;

  -- 128: 새로 추천이 생겼고(고치기 아님) 그 가게를 먼저 올린 다른 사람이 있으면 → 그 사람에게 알림
  if 새줄 then
    select f.id, f.user_id into 처음id, 처음사람 from public.city_foods f
     where f.city_id = p_city and f.name_key = public.name_key(이름) and f.user_id <> me
     order by f.created_at limit 1;
    if 처음사람 is not null and not public.blocked_between(me, 처음사람) then
      select count(*) - 1 into n from public.city_foods
       where city_id = p_city and name_key = public.name_key(이름);          -- 처음 올린 사람 빼고 = 👍 수
      select coalesce(display_name, '누군가') into 누구 from public.profiles where id = me;
      select name into 도시 from public.cities where id = p_city;
      select id into 알림 from public.notifications
       where user_id = 처음사람 and kind = 'food_like' and food_id = 처음id and read_at is null
       order by created_at desc limit 1;
      if 알림 is not null then
        update public.notifications
           set body = 누구 || '님' || case when n > 1 then ' 외 ' || (n - 1) || '명이' else '이' end
                      || ' 내 「' || 이름 || '」 추천에 👍를 눌렀어요',
               actor_id = me, created_at = now()
         where id = 알림;
      elsif public.notify_wants(처음사람, 'food_like')
            and not exists (select 1 from public.notifications
                             where user_id = 처음사람 and actor_id = me and kind = 'food_like'
                               and food_id = 처음id and created_at > now() - interval '1 day') then
        insert into public.notifications (user_id, kind, body, actor_id, city_id, food_id)
        values (처음사람, 'food_like', 누구 || '님이 내 「' || 이름 || '」 추천에 👍를 눌렀어요', me, p_city, 처음id);
      end if;
    end if;
  end if;
  return 새;
end $$;
revoke all on function public.food_add(text, text, text) from public, anon;
grant execute on function public.food_add(text, text, text) to authenticated;

-- ② 답글에 답하기(b869, 사용자: 「댓글의댓글 기능」 → A안 인스타처럼)
--   답글 줄의 「답글 달기」를 누르면 칸에 「@이름 」이 들어가고, 보낼 때 그 사람(p_to)에게도 알림이 갑니다. 목록은 그대로 한 줄.
--   p_to 는 «그 대화에 답글을 단 적 있는 사람»만 받습니다(아무나 불러내기 막기) · 나·글 주인(이미 알림 감)·차단 사이는 건너뜀.
--   알림 줄에 ref_author(한줄평 쓴 사람)를 남겨 누르면 그 한줄평 화면으로 · 맛집은 food_id 로 그 추천 글로.
--   ⚠ 인자가 늘어 create or replace 로는 «둘째 함수»가 생겨 이름 붙인 호출이 헷갈립니다 — 옛것을 지우고 다시 만듭니다.
alter table public.notifications add column if not exists ref_author uuid;

drop function if exists public.review_reply_add(uuid, text, text);
create function public.review_reply_add(p_author uuid, p_city text, p_body text, p_to uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 새 bigint; 이름 text; 도시 text; 글 text := btrim(coalesce(p_body, ''));
        꼬리 text;
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  if char_length(글) = 0 then raise exception '답글을 적어 주세요'; end if;
  if char_length(글) > 300 then raise exception '답글은 300자까지예요'; end if;
  if not public.review_ok(p_author, p_city) then raise exception '볼 수 없는 한줄평이에요'; end if;
  if (select visibility from public.profiles where id = me) = 'off' then
    raise exception '비활성화한 계정은 답글을 달 수 없어요'; end if;
  if (select count(*) from public.review_replies
       where user_id = me and created_at > now() - interval '1 hour') >= 60 then
    raise exception '답글을 너무 많이 달았어요. 잠시 뒤에 다시 해 주세요'; end if;
  insert into public.review_replies (author, city_id, user_id, body) values (p_author, p_city, me, 글)
  returning id into 새;
  select coalesce(display_name, '누군가') into 이름 from public.profiles where id = me;
  select name into 도시 from public.cities where id = p_city;
  꼬리 := ': 「' || left(글, 40) || case when char_length(글) > 40 then '…' else '' end || '」';
  if p_author <> me and public.notify_wants(p_author, 'review_reply') then
    insert into public.notifications (user_id, kind, body, actor_id, city_id, ref_author)
    values (p_author, 'review_reply', 이름 || '님이 내 ' || coalesce(도시, '') || ' 한줄평에 답글을 달았어요' || 꼬리, me, p_city, p_author);
  end if;
  if p_to is not null and p_to <> me and p_to <> p_author
     and exists (select 1 from public.review_replies x where x.author = p_author and x.city_id = p_city and x.user_id = p_to)
     and not public.blocked_between(me, p_to) and public.notify_wants(p_to, 'review_reply') then
    insert into public.notifications (user_id, kind, body, actor_id, city_id, ref_author)
    values (p_to, 'review_mention', 이름 || '님이 내 답글에 답했어요(' || coalesce(도시, '') || ' 한줄평)' || 꼬리, me, p_city, p_author);
  end if;
  return 새;
end $$;
revoke all on function public.review_reply_add(uuid, text, text, uuid) from public, anon;
grant execute on function public.review_reply_add(uuid, text, text, uuid) to authenticated;

drop function if exists public.food_reply_add(bigint, text);
create function public.food_reply_add(p_id bigint, p_body text, p_to uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); 새 bigint; 주인 uuid; 도시 text; 가게 text; 이름 text; 글 text := btrim(coalesce(p_body, '')); 꼬리 text;
begin
  if me is null then raise exception '로그인이 필요합니다'; end if;
  if char_length(글) = 0 then raise exception '답글을 적어 주세요'; end if;
  if char_length(글) > 300 then raise exception '답글은 300자까지예요'; end if;
  if not public.food_note_ok(p_id) then raise exception '볼 수 없는 추천 글이에요'; end if;
  if (select visibility from public.profiles where id = me) = 'off' then
    raise exception '비활성화한 계정은 답글을 달 수 없어요'; end if;
  if (select count(*) from public.food_replies
       where user_id = me and created_at > now() - interval '1 hour') >= 60 then
    raise exception '답글을 너무 많이 달았어요. 잠시 뒤에 다시 해 주세요'; end if;
  insert into public.food_replies (food_id, user_id, body) values (p_id, me, 글) returning id into 새;
  select f.user_id, f.city_id, f.name into 주인, 도시, 가게 from public.city_foods f where f.id = p_id;
  select coalesce(display_name, '누군가') into 이름 from public.profiles where id = me;
  꼬리 := ': 「' || left(글, 40) || case when char_length(글) > 40 then '…' else '' end || '」';
  if 주인 <> me and public.notify_wants(주인, 'food_reply') then
    insert into public.notifications (user_id, kind, body, actor_id, city_id, food_id)
    values (주인, 'food_reply', 이름 || '님이 내 「' || 가게 || '」 추천에 답글을 달았어요' || 꼬리, me, 도시, p_id);
  end if;
  if p_to is not null and p_to <> me and p_to <> 주인
     and exists (select 1 from public.food_replies x where x.food_id = p_id and x.user_id = p_to)
     and not public.blocked_between(me, p_to) and public.notify_wants(p_to, 'food_reply') then
    insert into public.notifications (user_id, kind, body, actor_id, city_id, food_id)
    values (p_to, 'food_mention', 이름 || '님이 내 답글에 답했어요(「' || 가게 || '」 추천)' || 꼬리, me, 도시, p_id);
  end if;
  return 새;
end $$;
revoke all on function public.food_reply_add(bigint, text, uuid) from public, anon;
grant execute on function public.food_reply_add(bigint, text, uuid) to authenticated;

-- 확인: 셋 다 true 면 된 것
select pg_get_functiondef('public.food_add(text,text,text)'::regprocedure) like '%food_like%' as 따봉_알림,
       to_regprocedure('public.review_reply_add(uuid,text,text,uuid)') is not null as 한줄평_답글에답,
       to_regprocedure('public.food_reply_add(bigint,text,uuid)') is not null as 맛집_답글에답;
