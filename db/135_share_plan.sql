-- ════════════════════════════════════════════════════════════════════
-- 135 · 일정 공유 2·3단계 (b880)
--
-- 사용자: 「내가 짠 일정을 다른 사람이 달라고 했을 경우나 카톡으로 공유하고
--   싶을 때」 → 1단계는 그림 카드(b879). 여기서 ② 보기 전용 링크와
--   ③ 「나도 이대로 가기」를 엽니다.
--
-- ⚠⚠ **서버 쪽은 db/001 에 이미 있었습니다** — `get_shared_trip` ·
--   `rotate_share_token` · `disable_share` 셋과 `trips.share_token` 칸까지.
--   한 번도 쓰이지 않은 채 두 해를 있었습니다. 그래서 여기서 하는 일은
--   **둘뿐**입니다:
--     ① `get_shared_trip` 에서 **메모를 뺍니다**(사용자 결정).
--     ② `copy_shared_trip` 을 새로 만듭니다(「나도 이대로 가기」).
-- ════════════════════════════════════════════════════════════════════

-- ── ① 메모는 안 내보냅니다 ───────────────────────────────────────────
-- ⚠⚠ **이것이 이 파일에서 제일 중요한 줄입니다.** ⚠⚠
-- 전에는 `memo` 가 그대로 나갔습니다. db/001 의 머리말은 「예약번호·주소·전화가
-- 딸려 가면 안 됨」이라고 적어 두었는데, **정작 그것들이 들어 있는 칸이 메모**
-- 입니다 — 앱은 거기에 「주소: …」 「예약: …」 「1,000엔」을 적게 해 뒀습니다
-- (planline.js 의 parseMemo). 적어둔 뜻과 실제가 어긋나 있었습니다.
--
-- 사용자 결정(b880): 「안 보여주기」. 그림 카드·글과 같은 규칙입니다.
-- ⚠ `move_note`(「긴자선 3정거장」)는 **남깁니다** — 길 찾는 데 쓰는 말이지
--   예약 정보가 아니고, 받는 사람에게 제일 쓸모 있는 한 줄입니다.
-- ⚠ 좌표(lat·lng)도 남깁니다 — 보기 화면의 지도가 그걸로 찍힙니다. 주소를
--   글로 주는 것과 좌표를 주는 것은 다릅니다(좌표는 「그 장소」까지만 말합니다).
create or replace function public.get_shared_trip(p_token text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when t.id is null then null else jsonb_build_object(
    'trip', jsonb_build_object(
      'title', t.title, 'destination', t.destination,
      'start_date', t.start_date, 'end_date', t.end_date,
      'timezone', t.timezone, 'hero_image', t.hero_image,
      'center_lat', t.center_lat, 'center_lng', t.center_lng),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
               'date', p.date, 'start_time', p.start_time, 'end_time', p.end_time,
               'category', p.category, 'title', p.title,
               'move_note', p.move_note, 'lat', p.lat, 'lng', p.lng)
             order by p.date, p.start_time nulls last, p.sort_order)
        from public.plans p
       where p.trip_id = t.id and p.deleted_at is null), '[]'::jsonb)
  ) end
  from public.trips t
  where t.share_token = nullif(trim(p_token), '')
    and t.share_token is not null;
$$;

grant execute on function public.get_shared_trip(text) to anon, authenticated;


-- ── ② 「나도 이대로 가기」 ────────────────────────────────────────────
-- 링크를 받은 사람이 그 일정을 **제 여행으로** 가져갑니다.
--
-- ⚠ **날짜는 내 출발일로 옮깁니다**(사용자 결정). Day 1·2·3 사이의 간격은
--   그대로 두고 통째로 밉니다 — 남의 «지난» 여행을 가져와도 바로 쓸 수 있어야
--   합니다. `p_start` 를 안 주면 원래 날짜 그대로입니다.
-- ⚠ **메모는 복사하지 않습니다.** 위 ①에서 안 내보내기로 한 것을 여기서
--   넣으면 같은 것이 옆문으로 나가는 셈입니다. 받는 사람은 애초에 그 글을
--   본 적도 없습니다.
-- ⚠ 지출·일행·일기·준비물·대화도 복사하지 않습니다 — 그것들은 «그 사람들의
--   여행»에 속한 것이지 일정이 아닙니다.
-- ⚠ 걷는 속도·환승 계수 같은 값은 **안 넘깁니다.** `trips_fill_city` 트리거가
--   도시에서 다시 채웁니다(db/001) — 새 여행을 만들 때와 똑같은 길입니다.
-- ⚠ `created_by` 는 기본값 `auth.uid()` 입니다. security definer 안에서도
--   `auth.uid()` 는 **부르는 사람**을 가리킵니다(역할이 아니라 토큰을 봅니다).
--   그래서 `on_trip_created` 트리거가 그 사람을 owner 로 넣습니다.
create or replace function public.copy_shared_trip(p_token text, p_start date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_src   public.trips%rowtype;
  v_new   uuid;
  v_shift int;
  v_cnt   int;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;

  select * into v_src from public.trips
   where share_token = nullif(trim(p_token), '') and share_token is not null;
  if v_src.id is null then
    raise exception '링크가 만료되었어요';
  end if;

  /* 이미 내가 가진 여행을 또 가져가는 것은 막습니다 — 제 일정을 제가
     복사하면 똑같은 여행이 둘이 되어 어느 쪽을 고쳐야 할지 모르게 됩니다. */
  if v_src.created_by = auth.uid() then
    raise exception '내가 만든 여행이에요';
  end if;

  v_shift := coalesce(p_start, v_src.start_date) - v_src.start_date;

  insert into public.trips
    (title, city_id, destination, country, start_date, end_date,
     timezone, currency, home_currency, local_lang, center_lat, center_lng, hero_image)
  values
    (v_src.title, v_src.city_id, v_src.destination, v_src.country,
     v_src.start_date + v_shift, v_src.end_date + v_shift,
     v_src.timezone, v_src.currency, v_src.home_currency, v_src.local_lang,
     v_src.center_lat, v_src.center_lng, v_src.hero_image)
  returning id into v_new;

  insert into public.plans
    (trip_id, date, start_time, end_time, category, title, move_note, lat, lng, sort_order)
  select v_new, p.date + v_shift, p.start_time, p.end_time, p.category,
         p.title, p.move_note, p.lat, p.lng, p.sort_order
    from public.plans p
   where p.trip_id = v_src.id and p.deleted_at is null;

  get diagnostics v_cnt = row_count;
  if v_cnt = 0 then
    /* 일정이 하나도 없는 링크였습니다 — 빈 여행만 남기면 사람이 어리둥절합니다. */
    delete from public.trips where id = v_new;
    raise exception '그 링크에는 일정이 없어요';
  end if;

  return v_new;
end $$;

-- 로그인한 사람만. 익명에게 주면 주인 없는 여행이 생깁니다.
revoke all on function public.copy_shared_trip(text, date) from public;
grant execute on function public.copy_shared_trip(text, date) to authenticated;
