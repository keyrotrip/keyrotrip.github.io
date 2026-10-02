/* ── 설정: 목록 → 항목 화면(b790) ─────────────────────────────────────
 * 사용자: 「우리 설정창이 너무 복잡해 — 첨부한 이미지처럼(카카오톡 설정)
 *   각 영역을 한 번 더 들어가서 설정을 바꾸는 걸로 하자」.
 *   카드 일곱에 항목 스물이 한 화면에 길게 늘어서 있었습니다.
 *
 * 첫 화면은 목록(`#setlist`)뿐이고, 줄을 누르면 `.setsub[data-sp]` 하나만 보입니다.
 * ⚠ 안의 카드·스위치는 **그대로**입니다 — id 도 처리기도 안 바꾸고 감싸기만
 *   했습니다. 스위치가 하는 일은 notify.js · friends.js · profile.js · account.js
 *   · admin.js 가 전과 똑같이 합니다.
 * ⚠ 들어갈 때 뒤로가기 기록을 한 칸 쌓습니다('setsub'). 뒤로가기는 tripview.js
 *   사슬이 `closeSetSub(true)` 로 받고, ← 단추는 app.js 가 여기로 넘깁니다.
 * ⚠ 설정을 열고 닫을 때(app.js 의 showProfile) `resetSetNav()` 로 늘 목록부터.
 */
import { $, toTop } from './dom.js?v=b823';

let 지금 = null;                  /* 열린 항목(data-sp) — 목록이면 null */

export const isSetSubOpen = () =>
  !!지금 && !!$('setpane') && !$('setpane').classList.contains('hide');

/* 목록 오른쪽 값. 따로 적어 두지 않고 **열 때마다 화면에서 읽습니다** —
   값의 주인은 각 카드(메일은 app.js, 글자 크기는 profile.js)라 두 벌로
   들고 있으면 한쪽만 바뀝니다. 「공개 범위」의 「비공개」는 friends.js 가
   잠금 스위치를 읽거나 바꿀 때 직접 적습니다. */
function 목록값(){
  const 메일 = ($('mail')?.textContent || '').trim();
  if ($('sv_acct')) $('sv_acct').textContent = 메일 === '—' ? '' : 메일;
  if ($('sv_screen')) $('sv_screen').textContent =
    document.querySelector('#tsbtns .on')?.textContent.trim() || '';
}

function 보이기(key){
  지금 = key;
  $('setlist')?.classList.toggle('hide', !!key);
  document.querySelectorAll('#setpane .setsub').forEach(s =>
    s.classList.toggle('hide', s.dataset.sp !== key));
  if ($('setback')) $('setback').textContent = key ? '← 설정' : '← 프로필';
  if (!key) 목록값();
}

export function openSetSub(key){
  if (!document.querySelector(`#setpane .setsub[data-sp="${key}"]`)) return;
  보이기(key);
  toTop($('setpane'));
  if (history.state?.t2 !== 'setsub') history.pushState({ t2:'setsub' }, '');
}

export function closeSetSub(fromPop){
  if (!지금) return;
  if (!fromPop && history.state?.t2 === 'setsub'){ history.back(); return; }
  보이기(null);
  toTop($('setpane'));
}

/* 설정을 열 때·닫을 때 — 늘 목록부터 보이게. 기록은 건드리지 않습니다. */
export function resetSetNav(){ 보이기(null); }

$('setlist')?.addEventListener('click', e => {
  const 줄 = e.target.closest('[data-sp]');
  if (줄) openSetSub(줄.dataset.sp);
});
