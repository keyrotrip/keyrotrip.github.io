/* ── 여행·일정 — 서버에서 읽는 곳 (2026-10-16, 두 번째 «데이터 모듈») ─────────────────────
 *
 * personadata.js(성향)에 이어 두 번째입니다. 여행을 «열 때» 읽는 넷부터 옮겼습니다:
 *   여행 목록(triplist) · 여행 하나(opentrip) · 그 여행의 일정(tripview) · 구간(legs).
 * 규칙은 personadata.js 머리말과 같습니다 —
 *   - **질의만** 둡니다. 캐시로 버티기 · 늦은 답 버리기 · 오류 글은 부르는 화면에 그대로 남습니다.
 *   - 돌려주는 것은 예전에 화면이 만들던 **그 질의 그대로**(같은 표 · 칸 · 거르기 · 순서)라,
 *     부르는 쪽의 await · netTimeout 이 예전과 똑같이 돕니다.
 *   - 쓰기(insert·update·delete)는 아직 화면에 있습니다 — 다음 차례(점진).
 * 층: db 만 읽습니다(고리 없음). */
import { sb } from './db.js?v=b887';

/* 여행 목록 — 다가오는(지금 포함)·다녀온 갈래. `today` 는 YYYY-MM-DD(부르는 쪽이 셈). */
export function 여행목록읽기(갈래, today){
  const q = sb.from('trips')
    .select('id,title,destination,start_date,end_date,currency,timezone,' +
            /* `country` 는 사진 대체에 씁니다(triplist.js 의 fillTripPhotos). */
            'transit_factor,city_id,country,cities(image_url,image_lg),' +
            'trip_members(user_id,role),trip_reviews(user_id,stars)');
  /* 날짜가 지나면 저절로 "다녀온"으로 넘어갑니다 — 손으로 옮길 일이 없습니다. */
  return 갈래 === 'past'
    ? q.lt('end_date', today).order('start_date', { ascending:false })
    : q.gte('end_date', today).order('start_date', { ascending:true });
}

/* 여행 한 줄 + 누가 함께하는지 */
export const 여행읽기 = id =>
  sb.from('trips').select('*, trip_members(user_id,role)').eq('id', id).maybeSingle();

/* 그 여행의 일정 — 숨긴 것(deleted_at) 빼고, 날짜·시각(없는 것은 뒤)·차례 순 */
export const 일정읽기 = tripId =>
  sb.from('plans')
    .select('id,date,start_time,end_time,category,title,memo,move_note,sort_order,lat,lng')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('date').order('start_time', { nullsFirst:false }).order('sort_order');

/* 그 여행의 구간 — travel() 이 쓰는 도보·대중교통 상수 다섯과 좌표 기준점(center_*)까지(legs.js 머리말) */
export const 구간읽기 = tripId =>
  sb.from('trip_legs')
    .select('id,city_id,destination,country,start_date,end_date,timezone,currency,' +
            'center_lat,center_lng,' +
            'walk_max_km,walk_min_per_km,walk_base_min,transit_factor,transit_base_min')
    .eq('trip_id', tripId).order('start_date');
