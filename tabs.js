/* ── 여행 상세의 탭과 쓸어 넘기기 ─────────────────────────────────────
 * 일정 · 지출 · 준비 · 일행 네 구역을 오가는 자리입니다. 탭을 눌러도 되고
 * **화면을 좌우로 쓸어도** 됩니다 — 폰에서는 쓸기가 더 빠릅니다.
 * 하단바에서도 같은 몸짓이 통합니다.
 *
 * 탭을 옮길 때 **열려 있던 폼은 닫습니다**(`FORMS`). 지출을 적다 말고
 * 일행 탭으로 갔다 오면 반쯤 채운 칸이 그대로 남아 헷갈립니다.
 * 그 탭에 지운 줄이 있으면 같이 불러옵니다(`TAB_TRASH`, trash.js).
 *
 * ── app.js 에서 떼어낸 스물여덟 번째 조각입니다(b352) ────────────────
 * app.js 만 아는 것은 둘 — 지금 어느 앱 탭인지, 앱 화면 켜기.
 * 밖으로 나가는 길은 `inTrip`(여행 상세가 열려 있나)과 `showTab` 둘입니다.
 *
 * ⚠ **1780 줄에서 끊었습니다.** 그 아래 '일정 추가·삭제' 는 좌표 찾기와
 * 얽혀 있어 탭과 상관이 없습니다 — 머리말이 붙어 있다고 한 덩어리가
 * 아닙니다(b345·b347·b350 과 같은 자리).
 *
 * 층: dom.js · trip.js · ui.js 와 이미 떼어낸 trash.js 를 씁니다. */
import { $ } from './dom.js?v=b823';
import { plans, tab, setTab, settleOn, todayOn } from './trip.js?v=b823';
import { TAB_TRASH, loadTrash } from './trash.js?v=b823';

let ctx = { appTab: () => '', showApp: () => {} };
export function setTabsCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 탭 ─────────────────────────────────────────────────────────────
 * 카드를 한 화면에 다 쌓아두면 예약·준비물까지 붙였을 때 감당이 안 됩니다.
 * DOM 순서는 그대로 두고 보이는 것만 고릅니다 — display:none 이라 사이가 안 벌어집니다. */
/* 지운 것(card-trash)이 일행 탭에 있었습니다. 일행과 아무 상관이 없고,
   **지운 것은 지운 자리에서 되살리는 것이 맞습니다.** 세 탭에 같이 걸고
   내용은 그 탭 것만 보여줍니다. DOM 에서는 맨 끝에 있어서 어느 탭에 나와도
   그 탭 카드들 뒤에 붙습니다 — 자리를 옮기지 않아도 됩니다. */
const TABS = {
  plans: ['card-today', 'card-plans', 'card-cand', 'plancard', 'importcard', 'card-trash'],
  exp:   ['card-exp', 'expcard', 'settlecard', 'card-trash'],
  prep:  ['card-book', 'bookcard', 'card-pack', 'card-link', 'card-trash'],
  mem:   ['card-mem'],
};
/* 탭을 옮기면 열려 있던 폼은 닫습니다 */

/* ══ 여행 구역 덱(b479) ══════════════════════════════════════════════════
 * 앱 탭 다섯을 가로 덱으로 만든 뒤(b474), 여행 안 구역 넷도 같은 방식을
 * 씁니다. 손가락으로 밀면 브라우저가 넘깁니다.
 *
 * ⚠ **여기는 「구역 = 화면」이 아니라 「구역 = 카드 묶음」이었습니다.**
 *   그래서 먼저 카드들을 구역 칸으로 **옮겨** 담습니다. DOM 순서가 바뀌지만
 *   CSS 는 거의 id 로 걸려 있어 탈이 없습니다(직계 자식 선택자였던
 *   `#tripview > .card` 는 아래에서 같이 걷습니다).
 * ⚠ **`card-trash` 는 세 구역이 같이 씁니다.** 내용은 구역마다 다른데
 *   (trash.js 의 TAB_TRASH) 카드는 하나입니다. 복제하면 안쪽 id 가 겹치므로,
 *   구역을 옮길 때마다 **그 칸으로 데려옵니다.** DOM 하나를 옮기는 것이라
 *   내용도 저절로 따라옵니다.
 * ⚠⚠ **머리(제목·후기·수정)도 칸 안으로 넣습니다(b568).** ⚠⚠
 *   b479 에는 「넷이 같이 쓰니 어느 칸에도 못 넣는다」로 보고 덱 위에
 *   고정했습니다. 결과는 **내용만 그 밑으로 흘러 들어가는** 화면이었고,
 *   「왜 이게 고정되냐」는 말을 두 번 들었습니다.
 *   하나를 넷이 쓰는 것은 맞지만, **보고 있는 칸으로 옮기면** 됩니다 —
 *   지운 것 카드가 이미 그러고 있었습니다. 복제가 아닌 **이동**이라
 *   id 가 겹치지 않고 핸들러도 그대로 따라옵니다.
 *   ⚠ ← 만 상단바로 빼 놨습니다(index.html) — 머리가 위로 사라졌을 때
 *     돌아갈 길까지 사라지면 안 됩니다. */
const 구역카드 = {
  plans: ['card-today', 'card-plans', 'card-cand', 'plancard', 'importcard'],
  exp:   ['card-exp', 'expcard', 'settlecard'],
  prep:  ['card-book', 'bookcard', 'card-pack', 'card-link'],
  mem:   ['card-mem'],
};
const 구역순서 = () =>
  [...document.querySelectorAll('#tstrip button[data-t]')].map(b => b.dataset.t);

const 여행덱 = document.createElement('div');
여행덱.id = 'tripdeck';
{
  const 첫 = $('card-today');
  if (첫){
    첫.parentNode.insertBefore(여행덱, 첫);
    for (const t of 구역순서()){
      const 칸 = document.createElement('div');
      칸.className = 'trippane';
      칸.dataset.t = t;
      (구역카드[t] || []).forEach(id => { const e = $(id); if (e) 칸.appendChild(e); });
      여행덱.appendChild(칸);
    }
  }
}
const 구역칸 = t => 여행덱.querySelector(`.trippane[data-t="${t}"]`);
const 여행칸폭 = () => 여행덱.clientWidth || 1;
const 여행지금칸 = () => Math.round(여행덱.scrollLeft / 여행칸폭());

/* 옮기는 동안에는 판정을 잠급니다 — 앱 덱과 같은 이유입니다(b476).
   지나가는 칸에 반응하면 알약이 두 번 깜빡입니다. */
let 여행잠금 = false, 여행잠금타이머 = 0;
function 여행덱으로(t, 부드럽게){
  const i = 구역순서().indexOf(t);
  if (i < 0) return;
  여행잠금 = true;
  clearTimeout(여행잠금타이머);
  const 목표 = i * 여행칸폭(), 시작 = 여행덱.scrollLeft;
  if (!부드럽게) 여행덱.style.scrollBehavior = 'auto';
  여행덱.scrollLeft = 목표;
  if (!부드럽게) 여행덱.style.scrollBehavior = '';
  /* ⚠⚠ **CSS `scroll-behavior:smooth` 가 대입을 삼킵니다(b492).**
   *   탭 덱에서 실제로 겪었습니다 — 하단바만 바뀌고 화면은 그대로였습니다.
   *   여기도 같은 구조라 같은 방어를 둡니다. 자세한 것은 app.js 의 `덱으로`. */
  if (부드럽게 && 목표 !== 시작) setTimeout(() => {
    if (여행덱.scrollLeft !== 시작) return;      /* 돌고 있습니다 — 둡니다 */
    여행덱.style.scrollBehavior = 'auto';
    여행덱.scrollLeft = 목표;
    여행덱.style.scrollBehavior = '';
  }, 150);
  여행잠금타이머 = setTimeout(() => { 여행잠금 = false; }, 부드럽게 ? 520 : 0);
}
const FORMS = ['plancard', 'expcard', 'bookcard', 'card-cand', 'importcard'];

export function showTab(t, 이미덱에){
  setTab(t);
  /* 한 id 가 여러 탭에 걸리게 되면서, 예전처럼 탭마다 따로 끄면 뒤 탭 차례에
     방금 켠 것이 다시 꺼집니다. 켤 것을 먼저 모아두고 한 번에 정합니다. */
  const on = new Set(TABS[t].filter(id => !FORMS.includes(id)));
  if (!settleOn) on.delete('settlecard');
  /* 오늘 일정도 같습니다. drawToday 가 비어서 숨겨도 여기서 다시 켜고 있었습니다 —
     지도 위에 **내용 없는 흰 카드**가 하나 떠 있던 것이 이것입니다. */
  if (!todayOn) on.delete('card-today');
  /* 지운 것은 있을 때만 켭니다. loadTrash 가 세어보고 다시 정합니다 —
     여기서는 일단 끄고, 되살릴 게 있으면 그쪽에서 켭니다. */
  on.delete('card-trash');

  for (const ids of Object.values(TABS))
    for (const id of ids) $(id).classList.toggle('hide', !on.has(id));

  /* ⚠ **지운 것 카드를 이 구역으로 데려옵니다(b479).** 세 구역이 같이 쓰는데
     내용은 구역마다 다릅니다. 복제하면 안쪽 id 가 겹치므로 DOM 하나를
     옮깁니다 — 내용도 저절로 따라옵니다. */
  const 칸 = 구역칸(t);
  const 휴지 = $('card-trash');
  if (칸 && 휴지 && 휴지.parentNode !== 칸) 칸.appendChild(휴지);

  /* ⚠ **머리 셋을 이 칸 맨 앞으로 데려옵니다(b568).** 위 머리말 참고.
     ⚠ **거꾸로 꽂습니다.** 하나씩 맨 앞에 넣으므로 마지막에 넣은 것이
       제일 위로 갑니다 — 결과는 머리 · 후기 · 수정 순서입니다.
     ⚠ 이미 그 칸에 있어도 그냥 다시 꽂습니다. 제자리로 넣는 것은 브라우저가
       알아서 아무 일도 안 합니다 — 「지금 어디 있나」를 따질 필요가 없습니다. */
  if (칸) for (const id of ['editcard', 'reviewbox', 'thead']){
    const e = $(id);
    if (e) 칸.insertBefore(e, 칸.firstChild);
  }

  $('editcard').classList.add('hide');
  document.querySelectorAll('#tstrip button').forEach(b =>
    b.classList.toggle('is-on', b.dataset.t === t));
  /* 지운 것은 열 때만 받아옵니다. 대부분은 볼 일이 없어서 미리 받으면 낭비입니다. */
  if (TAB_TRASH[t]) loadTrash();

  /* ⚠ **손가락으로 밀어서 온 경우에는 덱을 다시 옮기지 않습니다.** 이미 그
     칸에 서 있는데 또 옮기면 방금 멎은 스크롤을 건드려 튑니다(b474 와 같음). */
  if (!이미덱에) 여행덱으로(t, true);
  /* 구역을 옮기면 그 칸의 맨 위부터 봅니다 — 지출을 보다가 일행으로 갔는데
     중간부터 보이면 어디인지 모릅니다. 각 칸이 제 스크롤을 가지므로
     `window` 가 아니라 그 칸을 올립니다. */
  if (칸) 칸.scrollTop = 0;
}

/* ── 어느 구역에 서 있나 — 앱 덱과 같은 방식입니다(b474 주석 참고) ────── */
function 여행닿았다(el){
  if (여행잠금) return;
  const t = el?.dataset?.t;
  if (!t || t === tab) return;
  showTab(t, true);
}
{
  const 눈 = new IntersectionObserver(목록 => {
    const 온전한 = 목록
      .filter(e => e.isIntersecting && e.intersectionRatio >= 0.6)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (온전한) 여행닿았다(온전한.target);
  }, { root: 여행덱, threshold: [0.6, 0.9] });
  [...여행덱.children].forEach(el => 눈.observe(el));

  let 타이머 = 0;
  const 나중에 = () => {
    clearTimeout(타이머);
    타이머 = setTimeout(() => 여행닿았다(여행덱.children[여행지금칸()]), 130);
  };
  여행덱.addEventListener('scroll', 나중에, { passive:true });
  여행덱.addEventListener('scrollend', 나중에, { passive:true });
  여행덱.addEventListener('pointerdown', () => {
    여행잠금 = false; clearTimeout(여행잠금타이머);
  }, { passive:true });
}
$("tstrip").addEventListener("click", e => {
  const b = e.target.closest("button[data-t]");
  if (b) showTab(b.dataset.t);
});
/* ⚠ **여행 안 좌우 쓸기를 걷었습니다(b479).** 구역 넷이 이제 가로 스크롤
   덱이라, 손가락으로 미는 것은 **브라우저가** 받습니다. 여기서 또 받으면
   한 번 민 것이 두 칸을 넘어갑니다(앱 탭에서 b474 에 겪은 것과 같음).
   구역 알약은 그대로 둡니다 — 쓸기는 알려주지 않으면 아무도 모릅니다. */

/* ⚠ **하단바 쓸어 넘기기를 걷었습니다(b781, 사용자 결정: 「1,2만 끄자」).**
   여행 안에서 하단바를 좌우로 쓸면 앱 탭이 바뀌던 것입니다(탭 덱 스와이프와
   같이 걷음 — app.css 의 #tabdeck 주석). 하단바는 누르기만 합니다.
   ⚠ 여행 안 구역(일정·지출·준비·일행) 넘기기는 #tripdeck 의 가로 스크롤이라
     여기와 무관하게 남습니다. */

/* 여행 안이냐 밖이냐. 상단바가 이걸 보고 모양을 바꿉니다 —
   안이면 구역 넷이 나오고 앱 이름이 접힙니다. */
export function inTrip(on){
  document.body.classList.toggle('intrip', on);
  $('tstrip').classList.toggle('hide', !on);
  /* ⚠ **다시 재라고 알립니다(b759).** 상단바가 여행 안에서만 나오므로
     들고 날 때마다 화면이 시작하는 y(`--deck-top`)가 달라집니다.
     app.js 의 `덱높이맞추기` 가 듣습니다 — 곧바로 부르지 않고 이벤트로
     알리는 것은 **import 고리를 만들지 않기 위해서**입니다(tabs ↔ app).
   ⚠ 한 박자 미룹니다. 지금은 아직 옛 자리라 재봐야 옛 값이 나옵니다. */
  setTimeout(() => dispatchEvent(new Event('t2:remeasure')), 0);
}

