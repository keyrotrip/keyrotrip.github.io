/* ── 다녀온 뒤 묻기 (b880 에 통째로 다시 씀) ──────────────────────────
 * 여행이 끝나면 **별점 · 한줄평 · 맛집 추천** 셋만 묻습니다(사용자:
 * 「여행 다녀오면 별점&한줄평&맛집 추천만 하게 하자」).
 *
 * ── 전에 있던 것 ──────────────────────────────────────────────────
 * 「다녀오셨네요」 카드에는 여행 전체 별점 · 글 · 사진 · 「일행의 후기」가
 * 있었고, 그 카드가 **탭을 옮길 때마다 따라다녔습니다**(tabs.js 가 머리 셋을
 * 구역 맨 위로 옮겼습니다 — 사용자: 「일정 지출 준비 일행 어느 탭을 가도
 * 저게 상단에 떠 있는 게 싫어」).
 *
 * 걷은 까닭은 **쓰임을 추적해 봤기 때문입니다.** 여행 후기가 가는 곳은
 *   ① 같은 화면의 「일행의 후기」(혼자 간 여행이면 아무도 안 봄)
 *   ② 보관함 「여행 후기」 목록·숫자  ③ 배지 넷  ④ 내 자료 받기
 * 뿐이었고, **성향·지구본·추천·어워즈·분석에는 한 줄도 안 들어갑니다.**
 * 그것들을 굴리는 것은 전부 아래 «도시 별점»(city_ratings)입니다.
 * ⚠ 자료는 안 지웠습니다 — 표와 글·사진은 그대로입니다(db/136 머리말).
 *
 * ── 지금 모습 ─────────────────────────────────────────────────────
 *   · 끝난 여행을 열면 **가운데 팝업 카드**가 뜹니다(시안 A, 성향 바뀜
 *     알림(b854)과 같은 틀).
 *   · **여행 하나당 한 번**입니다. 「나중에」를 누르거나 닫으면 그 여행은
 *     다시 안 뜹니다 — 기기에 적습니다(localStorage, 사용자 결정).
 *     계정에 두려면 표가 하나 필요한데, 두 기기에서 한 번씩 보는 것은
 *     나쁜 일이 아니라 그냥 둡니다(b854 때와 같은 판단).
 *   · 평소에는 여행 머리줄의 「평가」 단추로 언제든 다시 엽니다(시안 C).
 *
 * ⚠ 별을 매기면 그 자리에서 **한줄평·맛집 추천**을 묻습니다(cmtask.js 의
 *   묻기 줄 — 평가 탭 목록과 같은 모양). 거기서는 ★4.5 이상만 묻지만
 *   **여기서는 문턱을 안 겁니다** — 다녀와서 한 번 묻는 자리라 「좋았던 곳만」
 *   으로 좁힐 이유가 없습니다.
 *
 * 층: dom.js · db.js · net.js · calc.js · stars.js · trip.js · cmtask.js */
import { $ } from './dom.js?v=b888';
import { sb } from './db.js?v=b888';
import { netTimeout } from './net.js?v=b888';
import { todayYmd } from './calc.js?v=b888';
import { trip, legs } from './trip.js?v=b888';

let ctx = { me: () => null, openReviewTrip: async () => {} };
export function setReviewCtx(o){ ctx = { ...ctx, ...o }; }

/* 이 여행에서 물을 도시들. `null` 이면 아직 안 받았거나 물을 것이 없습니다. */
let 도시 = null;
/* 이번에 연 여행에서 이미 띄웠나. `loadReview` 는 여러 번 불립니다
   (여행 열 때 · 구간을 고칠 때 · 실시간으로 바뀔 때) — 그때마다 뜨면 안 됩니다. */
let 띄운여행 = null;
let 열림 = false;

/* 「봤다」는 기기에 적습니다. ⚠ 사파리 비공개 창에서는 던질 수 있어 감쌉니다. */
const 치운키 = id => `t2:rvdone:${id}`;
const 치웠나 = id => { try { return localStorage.getItem(치운키(id)) === '1'; } catch { return false; } };
const 치움적기 = id => { try { localStorage.setItem(치운키(id), '1'); } catch {} };

export function isRvPopOpen(){ return 열림; }

export function closeRvPop(fromPop){
  /* ⚠ 앱의 다른 판과 같은 수법 — 손으로 닫을 때는 뒤로만 가고, 실제로 닫는
     일은 그 `popstate` 에서만 합니다(card.js 의 시트닫기 주석 참고). */
  if (!fromPop && history.state?.t2 === 'rvask'){ history.back(); return; }
  열림 = false;
  $('rvpop')?.classList.add('hide');
  if (trip?.id) 치움적기(trip.id);      /* 닫은 것이 곧 「봤다」입니다(b854 와 같은 규칙) */
}

export function openRvPop(){
  if (!$('rvpop') || !도시?.length) return;
  열림 = true;
  그리기();
  $('rvpop').classList.remove('hide');
  if (history.state?.t2 !== 'rvask') history.pushState({ t2:'rvask' }, '');
}

/* ⚠ 이름을 그대로 둡니다 — opentrip.js · legs.js · app.js 넷이 부릅니다. */
export async function loadReview(){
  /* ⚠ 여행이 없을 때도 불릴 수 있습니다(로그아웃·여행 닫기 뒤) — 막지 않으면
     `trip.end_date` 에서 터집니다. 실제로 터뜨려 봤습니다. */
  if (!trip){ 도시 = null; $('rvbtn')?.classList.add('hide'); return; }
  const 끝남 = trip.end_date < todayYmd();
  도시 = null;
  $('rvbtn')?.classList.add('hide');
  if (!끝남 || !ctx.me()) return;

  const ids = legs.map(l => l.city_id).filter(Boolean);
  if (!ids.length) return;              /* 도시를 모르면 물을 것이 없습니다 */

  const r = await netTimeout(sb.from('city_ratings')
    .select('city_id,stars,comment').eq('user_id', ctx.me().id).in('city_id', ids));
  if (r.error) return;                  /* 조용히 넘깁니다 — 없어도 되는 화면입니다 */

  const 매긴 = Object.fromEntries((r.data || []).map(x => [x.city_id, x]));
  도시 = legs.filter(l => l.city_id).map(l => ({
    id: l.city_id, name: l.destination,
    stars: 매긴[l.city_id]?.stars ?? null,
    comment: 매긴[l.city_id]?.comment || '',
  }));

  $('rvbtn')?.classList.remove('hide');

  /* 저절로 뜨는 것은 **아직 안 매긴 곳이 있을 때만**입니다. 다 매겼으면
     물을 것이 없는데 판만 뜹니다. */
  const 남음 = 도시.some(c => c.stars == null);
  if (남음 && !치웠나(trip.id) && 띄운여행 !== trip.id){
    띄운여행 = trip.id;
    openRvPop();
  }
}

function 그리기(){
  /* 제목만 바꿉니다 — 묻는 것은 다음 화면이 합니다(index.html 의 #rvpop 주석). */
  $('rv_title').textContent = 도시.length > 1
    ? `${trip.title}, 어떠셨어요?`
    : `${도시[0].name}, 어떠셨어요?`;
}

if (typeof document !== 'undefined' && $('rvpop')){
  $('rv_later').addEventListener('click', () => closeRvPop());
  /* ⚠ 「평가하러 가기」는 **닫고 나서** 엽니다. 안 닫으면 평가 화면 위에 덮개가
     남습니다 — 팝업은 `position:fixed` 라 그 화면보다 위에 섭니다. */
  $('rv_go').addEventListener('click', () => { const id = trip?.id; closeRvPop(); ctx.openReviewTrip(id); });
  $('rvpop').addEventListener('click', e => {
    if (e.target === $('rvpop')) closeRvPop();      /* 덮개를 눌러도 닫힘 */
  });
  $('rvbtn')?.addEventListener('click', () => {
    /* 머리줄 단추는 팝업을 거치지 않고 **바로** 평가 화면으로 갑니다 —
       스스로 누른 사람에게 「평가하러 가기」를 한 번 더 묻는 것은 군더더기입니다. */
    ctx.openReviewTrip(trip.id);
  });
}
