/* ── 맛보기 평가 — 남은 것은 «옮기기» 하나(b799) ─────────────────────
 * b406~b798: 로그인 화면(`#signedout`)에서 로그인 없이 도시를 매기고 성향 카드까지
 *   보던 조각이었습니다(「카드 봄 → 로그인 → 도시 5곳」의 벽 둘을 뒤집으려던 깔때기).
 * **b799 에 화면을 걷었습니다** — 사용자: 「로그인 화면에 이것도 지워버리자」(사진 카드 ·
 *   별 · 「다른 여행지 ›」 · 「♡ 가보고 싶어요」 전부). 그리던 코드는 git 의 b798 에 있습니다.
 *
 * ⚠ **옮기기(`claimTryRates`)는 남깁니다.** b798 까지 맛보기로 매겨 두고 아직 로그인 안 한
 *   사람의 별점이 브라우저(`t2:try`)에 남아 있습니다 — 로그인하는 순간 계정으로 따라가야
 *   합니다(「로그인했더니 날아갔다」가 제일 나쁩니다). 담아 둔 것이 없으면 아무것도 안 합니다.
 * ⚠ 궁합 링크(?mate=)는 이것과 상관없이 삽니다 — 코드는 mate.js 가 sessionStorage 에 담고,
 *   로그인 뒤 분석 탭 맨 위(persona.js 의 #matehere)에 뜹니다. 로그인 «전»의
 *   「친구는 ○○ 유형 — 다섯 곳만 매기면 궁합」 한 줄만 없어졌습니다. */
import { sb } from './db.js?v=b821';

/* 담아 두던 자리(localStorage). 이제 새로 담는 곳은 없고 읽어서 옮기기만 합니다. */
const KEY = 't2:try';
const 읽기 = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
                     catch { return {}; } };

/* ── 로그인하면 계정으로 옮깁니다 ────────────────────────────────────
 * app.js 의 `render(session)` 이 사람을 알아낸 직후에 부릅니다.
 *
 * ⚠ **덮어쓰지 않습니다.** 이미 계정에 있는 도시는 건드리지 않습니다 —
 *   맛보기는 대개 처음 온 사람이지만, 로그아웃했다 돌아온 사람일 수도
 *   있습니다. 그 사람이 예전에 매긴 별점을 맛보기가 덮으면 안 됩니다.
 * ⚠ **옮기고 나서 지웁니다.** 안 지우면 다음 로그인 때 또 옮기려 듭니다.
 *   옮기다 실패하면 **안 지웁니다** — 다음 기회에 다시 시도합니다. */
export async function claimTryRates(userId){
  const 담긴것 = 읽기();
  /* ⚠ **「안 가봤어요」(skip)도 같이 옮깁니다(b407).** 안 옮기면 로그인하는
     순간 방금 넘긴 도시들이 도로 나옵니다 — 사용자 눈에는 "아까 안 가봤다고
     했는데" 입니다. 별점 없는 줄로 남기면 로그인 뒤 홈에서도 안 묻습니다
     (fillQuiz 가 줄이 있는 도시를 뺍니다). 로그인 전후가 같아야 합니다. */
  const 줄 = Object.entries(담긴것)
    .filter(([, v]) => v?.stars != null || v?.want || v?.skip)
    .map(([city_id, v]) => ({ user_id: userId, city_id,
                              ...(v.stars != null ? { stars: v.stars } : {}),
                              ...(v.want ? { want: true } : {}) }));
  if (!줄.length) return 0;

  const 이미 = await sb.from('city_ratings').select('city_id')
    .eq('user_id', userId).in('city_id', 줄.map(r => r.city_id));
  if (이미.error) return 0;                      /* 못 물어봤으면 그냥 둡니다 */
  const 있는것 = new Set((이미.data || []).map(r => r.city_id));
  const 넣을것 = 줄.filter(r => !있는것.has(r.city_id));

  if (넣을것.length){
    const r = await sb.from('city_ratings')
      .upsert(넣을것, { onConflict: 'user_id,city_id' }).select('city_id');
    if (r.error) return 0;                       /* 지우지 않습니다 — 다음에 다시 */
  }
  localStorage.removeItem(KEY);
  return 넣을것.length;
}
