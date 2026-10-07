/* ── 사진 크게 보기 ── 일기와 후기가 «같이» 씁니다(b581) ───────────────
 * 사용자 지적: 「사진 누르면 사진이 확대가 안 되네」.
 *
 * ⚠ **후기 사진 CSS 에는 이미 「원본 비는 눌러서 크게 볼 때 지킵니다」라고
 *   적혀 있었습니다.** 적어만 두고 안 만들었습니다. 그래서 일기 쪽만
 *   만들지 않고 **한 벌로 만들어 둘 다 씁니다** — 두 벌이면 언젠가 한쪽만
 *   고칩니다(이 저장소에서 이미 여러 번 겪은 일입니다).
 *
 * ⚠⚠ **넘기기는 브라우저에게 맡깁니다**(scroll-snap). 일기장·탭 덱과 같은
 *   수법입니다. 손가락을 직접 받아 자리를 옮기는 방식은 b469 에 만들었다가
 *   b470 에 되돌렸습니다(관성이 남은 채 자리 옮김, 반쯤 걸친 채 멈춤).
 *
 * ⚠ **뒤로가기로 닫힙니다.** 전체 화면을 덮는 것을 열었으면 뒤로가기가
 *   그것부터 닫아야 합니다. `tripview.js` 의 popstate 사슬 **맨 위**에
 *   있어야 합니다 — 나중에 열린 것이 화면 위에 있으니까요.
 */
import { $, esc } from './dom.js?v=b833';

let 목록 = [], 지금 = 0, 판 = null;

function 만들기(){
  if (판) return 판;
  판 = document.createElement('div');
  판.id = 'pvview';
  판.className = 'hide';
  판.innerHTML =
    '<div class="pvtop">' +
      /* ⚠ 숫자와 ✕ 사이를 «빈 칸»이 밉니다(b582). 전에는 숫자에
         `flex:1` 을 줬는데, 이제 숫자가 제 바탕(알약)을 지고 다녀서
         늘이면 그 알약이 화면 폭만큼 길어집니다. */
      '<span class="pvnum"></span><span class="pvgap"></span>' +
      '<button type="button" class="pvx" aria-label="닫기">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
             'stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      '</button>' +
    '</div><div class="pvrow"></div>';
  document.body.appendChild(판);

  판.querySelector('.pvx').addEventListener('click', () => closePhotos());
  /* ⚠ **사진을 누르면 닫히면 안 됩니다.** 크게 보려고 연 것인데 손이 스치면
     닫혀버립니다. 사진 «바깥»(검은 자리)만 닫습니다. */
  판.addEventListener('click', e => {
    if (e.target.closest('img, .pvtop')) return;
    closePhotos();
  });
  /* 몇째 장인지. 일기장과 같은 셈입니다 — 한 칸 폭을 직접 재서 씁니다
     (clientWidth 로 세면 장마다 오차가 쌓입니다, b539). */
  판.querySelector('.pvrow').addEventListener('scroll', () => {
    const 줄 = 판.querySelector('.pvrow');
    const 칸 = 줄.querySelector('.pvcell');
    const 폭 = (칸?.offsetWidth || 줄.clientWidth) || 1;
    지금 = Math.min(목록.length - 1, Math.max(0, Math.round(줄.scrollLeft / 폭)));
    세기();
  }, { passive:true });
  return 판;
}

function 세기(){
  const n = 판?.querySelector('.pvnum');
  if (n) n.textContent = 목록.length > 1 ? `${지금 + 1} / ${목록.length}` : '';
}

/* 여러 장 중 `index` 번째부터 봅니다. */
export function openPhotos(list, index = 0){
  목록 = (list || []).filter(Boolean);
  if (!목록.length) return;
  지금 = Math.min(목록.length - 1, Math.max(0, index));
  const p = 만들기();
  const 줄 = p.querySelector('.pvrow');
  /* ⚠ `loading="lazy"` 를 **안 씁니다.** 크게 보려고 연 화면인데 늦게 오면
     빈 검은 판을 봅니다. 장 수가 여덟까지라 미리 받아도 쌉니다. */
  줄.innerHTML = 목록.map(u =>
    `<div class="pvcell"><img src="${esc(u)}" alt=""></div>`).join('');
  p.classList.remove('hide');
  document.body.classList.add('pvon');
  /* ⚠ **`scroll-behavior` 를 잠깐 끄고 넣습니다.** 부드러움이 걸려 있으면
     대입이 삼켜집니다(b492·b539 에서 두 번 겪은 것). 여는 순간은 애니메이션
     없이 그 장에 서 있어야 합니다. */
  const 칸 = 줄.querySelector('.pvcell');
  줄.style.scrollBehavior = 'auto';
  줄.scrollLeft = 지금 * ((칸?.offsetWidth || 줄.clientWidth) || 1);
  줄.style.scrollBehavior = '';
  세기();
  if (history.state?.t2 !== 'photo') history.pushState({ t2:'photo' }, '');
}

export const photosOpen = () => !!판 && !판.classList.contains('hide');

export function closePhotos(fromPop){
  if (!photosOpen()) return;
  /* 단추로 닫을 때는 **뒤로가기를 대신 눌러 줍니다** — 그래야 기록에
     빈 칸이 안 남습니다(다른 화면들과 같은 규칙). */
  if (!fromPop && history.state?.t2 === 'photo'){ history.back(); return; }
  판.classList.add('hide');
  document.body.classList.remove('pvon');
  /* 큰 사진을 물고 있지 않게 비웁니다. 여덟 장이면 꽤 됩니다. */
  판.querySelector('.pvrow').innerHTML = '';
  목록 = [];
}

/* Esc 는 데스크톱에서만 쓸모가 있지만, 있으면 시험할 때 편합니다. */
addEventListener('keydown', e => {
  if (e.key === 'Escape' && photosOpen()) closePhotos();
});
