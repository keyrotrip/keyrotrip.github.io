/* ── 여행 성향 — 서버에 묻고 적는 곳 (2026-10-16, 첫 «데이터 모듈») ─────────────────────────
 *
 * 왜: 화면 파일마다 `sb.from(…)` 을 직접 불러, 같은 표(city_ratings · profiles)를 어느 화면이 어떤 칸으로
 *     읽고 쓰는지 한눈에 볼 수 없었습니다(재 보니 질의가 있는 화면 파일 50개). 표나 칸을 바꿀 때 다 찾아야 합니다.
 *     기능별로 한 파일에 모읍니다 — 이 파일이 첫째, 성향 기능(pshift · persona · pmore)부터.
 *
 * 규칙
 *   - **질의만** 둡니다. 화면 판단(다시 해 보기 · 기기에 적기 · 오류 글)은 부르는 쪽에 그대로 남습니다.
 *   - 돌려주는 것은 예전에 화면이 만들던 **그 질의 그대로**입니다(같은 표 · 같은 칸 · 같은 거르기).
 *     그래서 부르는 쪽의 await · .then · netTimeout 이 예전과 똑같이 돕니다.
 *   - 새 기능의 질의를 화면에 바로 쓰지 말고 이런 파일에 더하십시오. 한꺼번에 옮기지는 않습니다(점진).
 *
 * 층: db 만 읽습니다. 화면 파일을 안 읽으므로 고리가 안 생깁니다.
 */
import { sb } from './db.js?v=b885';

/* 내 도시 별점 — 성향을 세는 재료. 칸은 부르는 곳마다 다릅니다(리포트는 한줄평·날짜까지, 바뀜 알림은 셈에 드는 것만). */
export const 성향재료칸 = {
  리포트: 'city_id,stars,want,comment,created_at,visits',   /* persona.js — 리포트 전체 */
  셈만:   'city_id,stars,visits',                           /* pshift.js — 바뀜 알림(별 있는 것만) */
};
export const 내별점읽기 = (uid, 칸, { 별있는것만 = false } = {}) => {
  const q = sb.from('city_ratings').select(칸).eq('user_id', uid);
  return 별있는것만 ? q.not('stars', 'is', null) : q;
};

/* 서버에 올려 둔 내 성향 코드(profiles.persona) — 흔들림 막기의 기준, 남의 화면이 읽는 값. */
export const 올린성향읽기 = uid =>
  sb.from('profiles').select('persona').eq('id', uid).maybeSingle();

/* 성향 올리기. `값들` = { persona } 또는 { persona, persona_ax }(db/110). 다시 해 보기는 pshift.js 가 정합니다. */
export const 성향올리기 = (uid, 값들) =>
  sb.from('profiles').update(값들).eq('id', uid);

/* 팔로우하는 사람들의 성향(db/119 friend_personas). 함수가 없으면 error — 부르는 쪽이 조용히 넘깁니다. */
export const 친구성향읽기 = () => sb.rpc('friend_personas');
