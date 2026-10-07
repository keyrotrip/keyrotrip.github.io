/* ── 화면 장치 ──────────────────────────────────────────────────────
 * 여행 자료(trip · plans · legs …)를 하나도 모르는 순수 화면 장치들입니다.
 * 그래서 app.js 에서 떼어낼 수 있었습니다 — 여기 있는 것은 전부
 * "DOM 을 어떻게 보이게 하느냐"만 압니다.
 *
 *   두 번 눌러 지우기 · 시트(팝업) · iOS 키보드 여백 · 좌우로 쓸기
 *
 * 층: dom.js 만 씁니다. app.js 를 거꾸로 부르지 않습니다 —
 * 하나 필요한 것(AI 시트 닫기)은 setSheetCloser 로 받아 둡니다. */
import { $ } from './dom.js?v=b834';

/* ── 좌우로 쓸기 ────────────────────────────────────────────────────
 * 상단의 구역 알약(일정·지출·준비·일행)은 화면 **왼쪽 위**에 있습니다.
 * 한 손으로 폰을 들면 엄지가 거기까지 안 갑니다 — 매번 손을 고쳐 잡아야 합니다.
 * 손가락이 이미 있는 자리(화면 가운데)에서 쓸어 넘길 수 있게 합니다.
 *
 * **여기는 무엇을 넘기는지 모릅니다.** 방향 둘만 알려주고 나머지는 부르는 쪽이
 * 정합니다 — 그래야 이 파일이 여행 탭을 몰라도 됩니다.
 *
 * 부딪히는 것 넷을 피합니다:
 *   지도(Leaflet)   — 지도를 옆으로 끄는 것이지 탭을 넘기는 게 아닙니다
 *   가로로 구르는 칸 — 그 안에서는 그 칸이 임자입니다
 *   시트·입력칸     — 시트는 아래로 끌어 닫고, 입력칸은 글자를 고릅니다
 *   화면 가장자리   — iOS 는 거기서 쓸면 **브라우저 뒤로가기**입니다.
 *                    빼앗으려 들면 둘 다 어정쩡해집니다. 양보합니다.
 */
const EDGE = 30;      /* 가장자리 몇 px 을 브라우저에 양보하나 */

/* 손가락이 시작한 자리가 "남의 것"인가. 위로 거슬러 올라가며 봅니다. */
function ownedByOthers(el, root){
  for (let n = el; n && n !== root; n = n.parentElement){
    /* 지도 둘. 일정 지도(Leaflet)와 세계지도(#worldsvg)는 **손가락으로 끌어
       옮기는 것**이 본래 일입니다. 세계지도는 setPointerCapture 로 손가락을
       잡지만 이벤트는 그래도 document 까지 올라오므로, 여기서 안 걸러내면
       지도를 옆으로 끌 때마다 탭이 넘어갑니다. */
    if (n.closest?.('.leaflet-container')) return true;
    if (n.id === 'worldsvg' || n.closest?.('#worldsvg')) return true;
    const t = n.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || n.isContentEditable) return true;
    if (n.classList?.contains('assheet') || n.classList?.contains('aisheet')) return true;
    /* 실제로 가로로 구르는 칸만 셉니다. overflow 설정만 보면 안 됩니다 —
       `overflow-x:auto` 인데 내용이 짧아 안 구르는 칸이 훨씬 많습니다. */
    if (n.scrollWidth > n.clientWidth + 4){
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

/* el 위에서 좌우로 쓸면 onLeft(다음)·onRight(이전)을 부릅니다.
   `active()` 가 거짓을 주면 아무 일도 안 합니다 — 그 화면이 아닐 때를 위해서입니다.

   **el 은 화면을 덮는 것이어야 합니다(대개 document).** 내용에 따라 크기가
   변하는 요소에 걸면, 내용이 짧을 때 그 아래 빈 자리에서는 손가락이 닿을 것이
   없어 아무 일도 안 일어납니다. 보는 사람에게는 다 같은 화면인데 위쪽 절반만
   되는 셈이라 "될 때도 있고 안 될 때도 있다"로 느껴집니다. 실제로 그랬습니다. */
export function onSwipeX(el, { onLeft, onRight, active = () => true,
                               skip = () => false }){
  let x0 = 0, y0 = 0, t0 = 0, id = null, live = false, dead = false;

  el.addEventListener('pointerdown', e => {
    id = null;
    if (!active()) return;
    /* 마우스는 왼쪽 단추만. 펜·손가락은 그대로 받습니다. */
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.clientX < EDGE || e.clientX > innerWidth - EDGE) return;
    /* 부르는 쪽이 "여기서 시작한 것은 내 것이 아니다"라고 말할 수 있게 합니다.
       화면 전체에 걸어두고 그중 한 조각만 다른 쓸기에 넘겨줄 때 씁니다. */
    if (skip(e)) return;
    if (ownedByOthers(e.target, el)) return;
    id = e.pointerId; x0 = e.clientX; y0 = e.clientY; t0 = e.timeStamp;
    live = false; dead = false;
  });

  el.addEventListener('pointermove', e => {
    if (e.pointerId !== id || dead) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (!live){
      /* 아직 어느 쪽인지 정하기 전입니다. 8px 은 넘어야 손이 움직였다고 봅니다 —
         누를 때 손가락은 늘 1~2px 씩 흔들립니다. */
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      /* **세로가 조금이라도 이기면 포기합니다.** 여기서 인색하지 않으면
         목록을 위아래로 굴릴 때마다 탭이 넘어갑니다. 그쪽이 훨씬 자주 하는 일입니다. */
      if (Math.abs(dx) < Math.abs(dy) * 1.4){ dead = true; return; }
      live = true;
    }
    /* 세로로 많이 흘렀으면 쓸기가 아니라 비스듬한 스크롤입니다. */
    if (Math.abs(dy) > 60) dead = true;
  });

  const end = e => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - x0, dt = e.timeStamp - t0;
    id = null;
    if (!live || dead) return;
    /* 멀리 끌었거나, 짧아도 빠르게 튕겼으면 넘깁니다.
       거리만 보면 급하게 넘기는 사람이 매번 실패합니다. */
    const far  = Math.abs(dx) >= 64;
    const fast = Math.abs(dx) >= 28 && dt > 0 && Math.abs(dx) / dt > 0.45;
    if (!far && !fast) return;
    (dx < 0 ? onLeft : onRight)?.();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', e => { if (e.pointerId === id) id = null; });
}

/* ── 두 번 눌러 지우기 ───────────────────────────────────────────────
 * 확인창(confirm)이 내장 브라우저에서 막히기 때문에 버튼 글자를 바꿔 묻습니다.
 * 그런데 물어본 채로 두면 나중에 그 버튼을 무심코 눌렀을 때 바로 지워집니다.
 * 다른 데를 누르면 원래대로 돌아오게 합니다. */
export function arm(b, label){
  if (b.dataset.orig == null) b.dataset.orig = b.textContent;
  b.dataset.armed = '1';
  b.textContent = label;
  b.style.fontWeight = '600';
}
export function disarm(b){
  if (b.dataset.armed !== '1') return;
  b.dataset.armed = '';
  if (b.dataset.orig != null) b.textContent = b.dataset.orig;
  b.style.fontWeight = '';
}
/* 실제 처리보다 먼저 돌아야 하므로 잡아채는 단계(capture)에서 봅니다. */
document.addEventListener('click', e => {
  document.querySelectorAll('[data-armed="1"]').forEach(b => {
    if (b !== e.target && !b.contains(e.target)) disarm(b);
  });
}, true);

/* ── 폼을 팝업으로 ───────────────────────────────────────────────────
 * 폼을 여는 자리가 여기저기라 부르는 쪽을 다 고치는 대신, 이 카드들이
 * 보이게 되는 순간을 지켜보다가 알아서 팝업으로 만듭니다.
 * 여는 쪽 코드는 그대로 두고 모양만 바뀝니다. */
const SHEETS = ['plancard', 'card-cand', 'expcard', 'bookcard', 'editcard', 'newcard',
                'importcard'];
/* AI 시트는 뒤로가기 기록까지 다루므로 닫는 법이 다릅니다. 그건 app.js 가
   압니다 — 여기서 app.js 를 부르면 서로 부르는 꼴이 되므로 받아 둡니다.
   (net.js 의 setOnDrained · setErrLogger 와 같은 방식입니다.)
   안 넣어주면 아무 일도 안 합니다 — 시트를 못 닫을 뿐 앱은 안 죽습니다. */
let closeAi = () => {};
export function setSheetCloser(fn){ closeAi = fn; }

export function syncSheets(){
  let any = false;
  for (const id of SHEETS){
    const el = $(id); if (!el) continue;
    const on = !el.classList.contains('hide');
    el.classList.toggle('assheet', on);
    if (on) any = true;
  }
  /* 여행 비서 시트도 뒷판을 씁니다. 여기서 같이 봐야 닫힐 때만 걷힙니다. */
  if (!$('aiview').classList.contains('hide')) any = true;
  $('sheetbg').classList.toggle('hide', !any);
  document.body.classList.toggle('sheeton', any);
}
{
  const ob = new MutationObserver(syncSheets);
  SHEETS.forEach(id => $(id) &&
    ob.observe($(id), { attributes:true, attributeFilter:['class'] }));
  /* 뒤를 누르면 열려 있던 것을 닫습니다. 취소 버튼을 못 찾는 사람이 많습니다. */
  $('sheetbg').addEventListener('click', () => {
    if (!$('aiview').classList.contains('hide')) return closeAi();
    SHEETS.forEach(id => $(id)?.classList.add('hide'));
    syncSheets();
  });

  /* 위에 그려둔 손잡이가 장식이기만 했습니다. 끌어내리면 닫히게 합니다 —
     그 모양을 보면 누구나 그렇게 해봅니다. */
  const grab = e => {
    const sheet = e.target.closest('.assheet, .aisheet');
    if (!sheet) return;
    /* 새 여행은 화면을 꽉 채우므로 끌어내릴 것이 아닙니다. 게다가 그 자리에
       뒤로가기 단추가 있어서, 잡으면 단추를 못 누릅니다. */
    if (sheet.classList.contains('wiz')) return;
    /* 손잡이 자리(위쪽 26px)에서 시작한 것만 잡습니다. 안쪽 스크롤과 안 부딪칩니다. */
    if (e.clientY - sheet.getBoundingClientRect().top > 26) return;
    const y0 = e.clientY;
    const bg = $('sheetbg');
    let dy = 0;
    /* 속도는 **직전 지점과 지금 지점**의 차이로 잽니다.
       손 뗀 순간만 보면 마지막 move 와 좌표가 같아 늘 0 이 나옵니다. */
    let py = y0, pt = performance.now(), v = 0;
    const EASE = 'cubic-bezier(.32,.72,0,1)';   /* 아이폰 시트와 같은 느낌 */

    /* 시트를 여는 애니메이션(sheetup)이 transform 을 건드립니다.
       그냥 style.transform 으로 넣으면 애니메이션이 살아 있는 동안 밀립니다.
       important 로 넣어야 무슨 일이 있어도 손가락을 따라옵니다. */
    const put = v => sheet.style.setProperty('transform', v, 'important');
    const clearPut = () => sheet.style.removeProperty('transform');

    const move = ev => {
      dy = Math.max(0, ev.clientY - y0);
      sheet.style.transition = 'none';
      put(`translateY(${dy}px)`);
      /* 내릴수록 뒷판도 같이 걷힙니다. 시트만 움직이면 "닫히는 중"이 아니라
         "미끄러진 것"처럼 보입니다. */
      if (bg){ bg.style.transition = 'none';
               bg.style.opacity = String(Math.max(0, 1 - dy / 320)); }

      const now = performance.now(), dt = now - pt;
      if (dt > 8){                       /* 너무 잦게 재면 값이 튑니다 */
        v = (ev.clientY - py) / dt;      /* px/ms, 아래로 갈수록 + */
        py = ev.clientY; pt = now;
      }
    };

    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      /* 살짝만 내렸어도 **아래로 던졌으면** 닫는 게 맞습니다.
         손가락이 빠르면 사람은 이미 닫을 마음을 먹은 것입니다.
         손을 멈춘 채 오래 들고 있었으면 던진 것이 아니므로 속도를 버립니다. */
      if (performance.now() - pt > 120) v = 0;
      const shut = dy > 90 || (dy > 24 && v > 0.5);

      if (!shut){
        /* 제자리로. 뒷판도 같이 돌아옵니다. */
        sheet.style.transition = `transform var(--t) ${EASE}`;
        put('translateY(0px)');        /* 0 으로 되돌려야 애니메이션이 보입니다 */
        if (bg){ bg.style.transition = 'opacity .22s'; bg.style.opacity = ''; }
        setTimeout(clearPut, 240);     /* 다 돌아온 뒤에 걷습니다 */
        setTimeout(() => { sheet.style.transition = ''; if (bg) bg.style.transition = ''; }, 240);
        return;
      }

      /* ── 닫기 ──
         예전에는 여기서 transform 을 '' 로 되돌리고 곧바로 숨겼습니다.
         그러면 끌어내리던 시트가 **위로 튕겨 올라갔다가** 사라져서,
         쓸어내렸는데 닫기 단추를 누른 것처럼 뚝 끊겼습니다.
         내리던 방향 그대로 끝까지 내려보내고, 다 내려간 뒤에 숨깁니다. */
      const h = sheet.getBoundingClientRect().height || window.innerHeight;
      sheet.style.transition = `transform .24s ${EASE}`;
      put(`translateY(${h}px)`);
      if (bg){ bg.style.transition = 'opacity .24s'; bg.style.opacity = '0'; }

      setTimeout(() => {
        /* 다음에 열 때 내려간 채로 있으면 안 됩니다. 숨기기 **전에** 지웁니다. */
        sheet.style.transition = ''; clearPut();
        if (bg){ bg.style.transition = ''; bg.style.opacity = ''; }
        if (sheet.id === 'aiview') closeAi();
        else { sheet.classList.add('hide'); syncSheets(); }
      }, 230);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  document.addEventListener('pointerdown', grab);
}

/* ── 키보드 ─────────────────────────────────────────────────────────
 * iOS 에서 키보드가 올라오면 폼 아래 버튼이 가려 아무것도 못 누릅니다.
 * 보이는 높이를 재서 그만큼 바닥에 여백을 줘 스크롤로 닿게 합니다.
 * (도쿄 앱이 --kb 로 하던 것과 같은 방식입니다.) */
/* 홈 화면에 담은 앱인가. 사파리와 창 구조가 달라서 같은 계산이 다른 자리를
   가리킵니다(아래 --below). navigator.standalone 은 iOS 전용이고,
   display-mode 는 안드로이드·데스크톱까지 봅니다. 둘 다 봅니다. */
const STANDALONE = !!navigator.standalone ||
  matchMedia('(display-mode: standalone)').matches;

/* ⚠⚠ **위쪽 빈 띠(`--edge`)를 안 켭니다(b763, 사용자 결정: 「상단영역
 *   공간이 너무 커 그냥 원래대로 해줘」).** ⚠⚠
 *   b762 에 44px 을 비웠습니다 — iOS 가 흐리는 자리에 아무것도 두지
 *   않으려던 것입니다. 그런데 b761 이 상태바를 OS 에 돌려준 뒤라
 *   **시스템 바(약 59pt) 위에 빈 띠 44px 이 겹쳐** 위쪽이 100pt 넘게
 *   비었습니다. 흐림보다 그쪽이 더 거슬린다는 판단입니다.
 * ⚠ **`--edge` 자체는 살아 있습니다**(app.css, 32px). 다만 «몸통을 미는
 *   값»이 아니라 «기록 탭에 얹힌 로고와 「자세히」만 내리는 값»으로
 *   좁혔습니다 — 자리 손해가 0 입니다. 자세한 것은 그 자리 주석에.
 * ⚠ 다시 몸통째 밀어야 하면 여기가 아니라 `.tabpane` 의 위 여백입니다
 *   (여행 안의 상단바까지 밀면 안 됩니다). */

/* ── 화면(브라우저) 확대를 막습니다(b562) ─────────────────────────────
 * ⚠⚠ **이 앱은 자리를 «재서» 잡습니다** — --vvh(보이는 창 높이) ·
 *   --deck-top(탭 화면이 시작하는 y) · --tabh(탭바 높이) · 덱 칸폭.
 *   손가락 둘로 «화면»을 확대하면 그 자가 통째로 어긋나 레이아웃이
 *   무너집니다. 사용자가 두 가지로 겪었습니다:
 *     · 「두 번 두드려 화면이 커지고 나서 줄이면 레이아웃이 무너지네」
 *     · 「여행 탭 머리가 고정된 영역이 아닌데 고정되면서 무너져」
 *   둘 다 확대 뒤에 잰 값이 남아서 생긴 것입니다.
 * ⚠ **글자가 작아 확대하던 사람을 버리는 것이 아닙니다.** 설정 →
 *   화면 → 글자 크기가 이미 있고, 그쪽은 레이아웃을 안 깹니다.
 *   막는 대신 그 길을 남겨 두는 것이 맞습니다.
 * ⚠ **iOS 사파리는 `user-scalable=no` 를 무시합니다.** 실제로 막으려면
 *   `gesturestart` 를 막아야 합니다. 두 번 두드려 커지는 것은 CSS 의
 *   `touch-action:manipulation` 이 맡습니다(app.css).
 * ⚠ **지구본의 «손가락 둘로 집기»와 안 다툽니다.** 지구본은 pointer
 *   이벤트로 제가 처리하고 `touch-action:none` 이라, 여기서 막는 것은
 *   그 바깥의 «화면» 확대뿐입니다. */
for (const t of ['gesturestart', 'gesturechange', 'gestureend'])
  document.addEventListener(t, e => e.preventDefault(), { passive:false });

if (window.visualViewport){
  const vv = window.visualViewport;
  /* 키보드가 올라왔는지는 "글을 쓸 수 있는 칸에 커서가 있는가"로 봅니다.
     높이 차이만 보면 **크롬(iOS)에서 틀립니다** — 크롬은 아래 툴바가 있어서
     키보드가 없어도 innerHeight 와 visualViewport 가 100px 넘게 벌어집니다.
     그걸 키보드로 착각해 body 여백이 늘고 화면이 밀렸습니다. */
  const typing = () => {
    const el = document.activeElement;
    if (!el) return false;
    const t = el.tagName;
    return t === 'TEXTAREA' || el.isContentEditable ||
           (t === 'INPUT' && !/^(button|submit|checkbox|radio|file|range|color)$/i
                                .test(el.type || 'text'));
  };
  /* ── 키보드와 ∧ ∨ ✓ 막대 뒤 덮기 ──────────────────────────────────
     b174 의 자 두 벌이 답을 줬습니다(홈 화면 앱, 키보드 올린 상태).

       빨강 F(position:fixed)   → 레이아웃 바닥에서 **잘렸습니다**
       파랑 A(position:absolute) → 막대 뒤로 **계속 이어졌습니다**
       레이아웃 바닥이 문서 좌표 926, 막대 뒤가 대략 937~982

     즉 그 자리에 그려지는 것은 **문서의 계속되는 부분**입니다. 그래서 세계지도가
     비쳤습니다. 시트는 fixed 라 아무리 키워도 926 에서 잘립니다 — b170·b171 에서
     시트와 box-shadow 로 두 번 시도해 두 번 다 실패한 이유가 이것입니다.
     **문서 안에 덮개를 넣으면 덮입니다.** 파랑 자가 거기 그려진 것이 증거입니다. */
  let kbCover = null;
  const coverBelow = (on) => {
    /* 시트가 없을 때는 덮으면 안 됩니다 — 그때 아래가 보이는 것은 정상입니다. */
    if (!on || !document.body.classList.contains('sheeton')){
      kbCover?.remove(); kbCover = null;
      return;
    }
    if (!kbCover){
      kbCover = document.createElement('div');
      /* **뒷판(#sheetbg, 1200)보다 아래**에 둡니다. 그러면 화면 안쪽은 뒷판이
         위에서 덮으므로 보이는 그림이 하나도 안 바뀌고, 뒷판이 닿지 못하는
         막대 뒤에서만 이 덮개가 드러납니다. 위에 두면 시트 위 24px 틈까지
         시트 색이 되어 둥근 모서리가 묻힙니다. */
      kbCover.style.cssText = 'position:absolute; left:0; right:0; top:0;' +
                              'z-index:1199; pointer-events:none';
      document.body.appendChild(kbCover);
    }
    /* 열려 있는 시트의 색을 그대로 씁니다. AI 시트는 --parchment,
       나머지 시트는 --canvas 라 하나로 못 박으면 한쪽이 어긋납니다. */
    const sheet = document.querySelector('.aisheet:not(.hide), .assheet:not(.hide)');
    kbCover.style.background = sheet
      ? getComputedStyle(sheet).backgroundColor : 'var(--canvas)';

    /* **좌표를 쓰지 않습니다.** b175(scrollY)·b176(rect 로 보정) 둘 다 자리를
       계산했고 둘 다 틀렸습니다. 아이폰에서 잰 것:

         눈금자   scrollY 511, 덮개 rect 793~1302 (맞다고 나옴)
         사진     화면 위에 보이는 파랑 자가 A505 → 실제 스크롤은 133쯤
         차이     378 ≈ 키보드 높이 369

       **iOS 는 키보드가 올라오면 scrollY 를 키보드 높이만큼 부풀려 보고하고,
       absolute 요소의 rect 는 문서→뷰포트 변환에 그 scrollY 가 끼므로 같이
       틀립니다.** 그래서 rect 로 보정해도 같은 거짓말을 두 번 믿을 뿐입니다.
       (fixed 요소의 rect 는 정확합니다 — 뷰포트 기준이라 scrollY 를 안 탑니다.
        시트 bot 424 는 사진과 맞았습니다. 그래서 진작 알아채지 못했습니다.)

       **파랑 자는 정확히 그려졌습니다.** 그것은 좌표를 안 썼기 때문입니다 —
       top:0 에 두고 높이만 문서 높이로 줬습니다. **길이는 오프셋 오차를 안 탑니다.**
       덮개도 똑같이 만듭니다. 문서 전체를 깔면 어디가 막대 뒤인지 알 필요가
       없습니다. 그 자리가 문서 안이라는 것은 파랑 자가 이미 증명했습니다. */
    kbCover.style.height =
      Math.max(document.documentElement.scrollHeight, 레이아웃높이()) + 'px';
  };

  /* ⚠ **같은 값이면 안 씁니다(b575).** `setProperty` 는 값이 같아도 그
     아래를 전부 다시 따지게 만듭니다. 아래에서 `fit` 을 여러 번 부르게
     되었으므로, 안 바뀐 값을 거르지 않으면 그만큼 낭비가 쌓입니다. */
  /* ⚠⚠ **`window.innerHeight` 를 «레이아웃 높이»로 쓰지 마십시오(b576).** ⚠⚠
   *   눈금자 실측(아이폰 홈 화면 앱, 2026-08-31, b575):
   *       키보드 없음 : inner 793 · client 793
   *       키보드 올림 : **inner 424** · client 793 · vv.h 424 · off 369
   *   즉 이 iOS 는 `innerHeight` 를 **보이는 창**에 맞춰 줄입니다. 이 파일의
   *   셈은 전부 「inner = 레이아웃 높이」를 전제로 쓰였는데 그 전제가
   *   깨졌습니다. 그래서 「키보드 올라왔나」가 `424 − 424 = 0` 이 되어
   *   **늘 거짓**이었고, 시트 여백도 덮개도 안 걸렸습니다.
   *   ⚠ 이 파일 위쪽의 옛 표(inner 793 · vv.h 424)는 **그때의 iOS** 값입니다.
   *     숫자를 규칙으로 적으면 언젠가 조용히 틀립니다 — 세 번째입니다.
   *   `clientHeight`(레이아웃 뷰포트)와 큰 쪽을 씁니다. 어느 쪽이 무엇을
   *   따라가든 «레이아웃 높이»는 둘 중 큰 값입니다. */
  const 레이아웃높이 = () =>
    Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

  const 지난값 = {};
  const 넣기 = (k, v) => {
    if (지난값[k] === v) return;
    지난값[k] = v;
    document.documentElement.style.setProperty(k, v);
  };

  const fit = () => {
    /* **offsetTop 을 빼면 안 됩니다.** iOS 는 키보드가 올라올 때 레이아웃을
       줄이는 게 아니라 보이는 화면을 밀어 올립니다. 그러면 offsetTop 이 딱
       키보드 높이만큼 커져서, 빼는 순간 식이 스스로를 상쇄해 0 이 됩니다.
       실측(아이폰 사파리): inner 695, vv.h 392, offsetTop 303 → 695-392-303 = 0.
       ⚠⚠ **이 줄의 `inner` 는 2026-08 초의 iOS 값입니다. 지금은 다릅니다** —
         `innerHeight` 가 보이는 창을 따라가게 바뀌었습니다(b576, 아래 참고).
         **이 파일에 적힌 숫자를 규칙으로 믿지 마십시오.** 세 번 틀렸습니다.
       그래서 --kb 가 0 이 되고 높이 제한이 안 걸려, 시트가 86vh(632)로 그려져
       보이는 높이 392 를 넘어 위로 240px 잘려 나갔습니다.
       키보드가 먹은 높이는 그냥 innerHeight - vv.height 입니다. */
    /* **offsetTop 을 다시 뺍니다.** b165 에서 이걸 지웠는데, 지금 쓰는 용도로는
       그게 맞는 식이었습니다. 여기서 필요한 값은 "키보드 높이"가 아니라
       **레이아웃 안에서 키보드가 가린 높이**입니다. 둘은 환경에 따라 다릅니다.

         사파리    inner 695 − off 303 − vv.h 392 = 0
                   → 보이는 창이 레이아웃 바닥에서 끝나므로 가린 것이 없습니다
         홈화면앱  inner 852 − off 0   − vv.h 549 = 303
                   → 키보드가 레이아웃 안을 303 가립니다

       시트는 bottom:0 이라 레이아웃 바닥에 붙습니다. 그 바닥이 키보드에
       가려진 만큼만 안쪽 여백으로 밀어 올리면 두 환경이 같이 맞습니다.
       b165 에서 이 값을 높이 제한에 쓰려다 0 이 나와 지운 것이 실수였습니다 —
       높이는 --vvh(보이는 높이)가 맡고, 이 값은 여백이 맡습니다. */
    const kb = typing()
      ? Math.max(0, 레이아웃높이() - vv.offsetTop - vv.height) : 0;
    /* ⚠ **숫자가 아니면 안 넣습니다(b502).** `--kb` 가 'NaNpx' 가 되면
       그것을 쓰는 calc 가 통째로 무효가 되어 **아래 여백이 0 이 됩니다** —
       실험으로 재현했습니다(body padding-bottom 84px → 0px). 죽은 var 는
       조용히 무시되는 게 아니라 그 줄을 통째로 죽입니다. */
    넣기('--kb', (Number.isFinite(kb) ? Math.round(kb) : 0) + 'px');
    /* 시트는 --kb 를 안 씁니다. iOS 는 키보드가 뜨면 **화면을 스크롤**하기 때문에
       레이아웃 바닥이 곧 보이는 화면의 바닥입니다(off 303 → 보이는 영역 303~695).
       거기서 bottom 을 또 올리면 그만큼 떠버립니다 — 실측 bot 89, 보이는 높이 392.
       시트는 bottom:0 에 두고, 높이만 "지금 보이는 높이"로 잡습니다. */
    넣기('--vvh', Math.round(vv.height) + 'px');
    /* **보이는 창이 레이아웃의 어디서 시작하는가.** 이것이 없어서 새 여행 시트가
       키보드 뒤에 앉았습니다. 홈 화면 앱에서 잰 값(b240):
         inner 793 · vv.h 424 · off 0
       iOS 가 화면을 **안 밀었으므로**(off 0) 보이는 곳은 위쪽 0~424 인데,
       시트는 bottom:0(=레이아웃 바닥 793)에 높이 424 라 369~793 에 앉습니다 —
       정확히 키보드 자리입니다. 진행 막대만 55px 보였습니다.
       사파리는 off 303 이라 bottom:0 이 우연히 맞아서 여태 안 보였습니다.
       위에 붙이면 둘 다 맞습니다: 홈앱 0~424, 사파리 303~695(=바닥). */
    넣기('--vvtop', Math.round(vv.offsetTop) + 'px');

    /* **보이는 창의 바닥이 레이아웃의 어디인가.**
       위 주석이 "레이아웃 바닥이 곧 보이는 화면의 바닥"이라고 적어둔 것은
       **사파리에서만** 맞았습니다(off 303 이라 우연히 맞음). 홈 화면 앱은
       off 0 이라 보이는 곳이 0~424 인데 `bottom:0` 은 793 을 가리킵니다 —
       그래서 일정 추가 시트가 키보드 뒤에 앉아 제목만 잘려 보였습니다.
       새 여행 시트(.wiz)만 --vvtop 으로 고쳐뒀고 **나머지 시트는 그대로**였습니다.
       한 곳만 고치고 같은 병을 앓는 형제를 안 본 것입니다.
       바닥에서 얼마나 띄워야 하는지를 재두면 `bottom:var(--vvbot)` 한 줄로
       두 환경이 다 맞습니다 — 사파리는 0 이 나와서 지금과 똑같이 돕니다.

       **키보드가 올라와 있을 때만 씁니다.** 사파리는 주소창이 접히거나
       고무줄 스크롤이 나는 순간에도 offsetTop 이 잠깐 흔들리는데, 그때마다
       시트가 튀면 안 됩니다. 키보드가 없으면 어차피 두 바닥이 같습니다. */
    const vvbot = typing()
      ? Math.max(0, 레이아웃높이() - vv.offsetTop - vv.height) : 0;
    넣기('--vvbot', Math.round(vvbot) + 'px');

    /* ── 레이아웃 바깥에 그려지는 자리 ──
       사파리는 화면(screen 852) 중 아래쪽을 레이아웃 밖에 두면서(inner 695)
       **그 자리에도 페이지를 계속 그립니다.** 시트는 bottom:0 이라 695 까지만
       덮으니 딱 157px 이 비쳐서, 시트 아래로 주소 알약과 일정 글자가 보였습니다.
       실측: screen 852 − inner 695 = 157, 눈금자의 두 ★ 이 같은 값이었습니다.
       홈 화면 앱은 도구막대가 없어 이 값이 0 이 되므로 그대로 두면 됩니다.
       레이아웃은 안 건드리고 이 높이만 시트 색으로 덮습니다(app.css 의 box-shadow). */
    /* **홈 화면 앱에서는 이 뺄셈이 위쪽을 잽니다.** 실측 2026-08-05:
         사파리    screen 852 − inner 695 = 157 → 아래 도구막대 (맞음)
         홈화면앱  screen 852 − inner 793 =  59 → 위 상태바   (틀림)
       홈 화면 앱은 도구막대가 없고 대신 레이아웃이 상태바 **아래**에서
       시작합니다. 그래서 같은 뺄셈인데 나온 자리가 반대입니다.
       그걸 모르고 시트 아래를 59 칠하고 있었습니다 — 없는 자리를 칠한 것입니다.
       standalone 이면 아래에 덮을 것이 없습니다. */
    const below = STANDALONE ? 0
      : Math.max(0, Math.round((screen.height || 0) - 레이아웃높이()));
    넣기('--below', below + 'px');
    /* 시트가 키보드 위에 얹히면 아래 탭바는 키보드 뒤로 숨습니다.
       그 자리를 비워두던 여백을 걷으라고 알려줍니다. 60px 은 주소창이 접히고
       펴질 때 생기는 잔떨림을 키보드로 오해하지 않으려고 둔 선입니다. */
    document.body.classList.toggle('kbon', kb > 60);

    /* **키보드가 올라왔는지는 --kb 로 알 수 없습니다.** 두 환경 다 0 입니다
       (사파리 695−303−392, 홈화면앱 793−369−424). 레이아웃이 줄지 않고
       보이는 창만 작아지므로, 판정은 그 차이로 합니다. */
    /* ⚠ **여기가 `innerHeight` 때문에 늘 거짓이었습니다(b576).** 실측
       inner 424 · vv.h 424 → 차이 0. 레이아웃 높이로는 793 − 424 = 369 입니다. */
    const kbUp = typing() && (레이아웃높이() - vv.height) > 60;
    coverBelow(kbUp);
    /* body.kbon 은 --kb 로 판정하는데 그 값이 두 환경 다 0 이라 안 켜집니다.
       **키보드가 떠 있는지를 물어야 하는 CSS 는 이쪽을 봐야 합니다.** */
    document.body.classList.toggle('kbup', kbUp);
  };
  /* ── 안쪽이 따로 구르는 화면에서 쓰던 칸 붙잡아 두기 ────────────────
     새 여행 화면은 가운데(.wizbody)만 구릅니다. 키보드가 올라오면 그 칸이
     짧아지는데, 브라우저는 **페이지**를 스크롤해 입력칸을 보여주려 합니다 —
     안쪽 스크롤은 안 건드리므로 정작 쓰고 있는 칸이 밖으로 밀려 사라졌습니다.
     여기서 안쪽을 직접 굴려 데려옵니다.

     **이미 보이면 아무것도 안 합니다.** 그 조건이 없으면, 손으로 조금
     내려볼 때마다 도로 끌어올려서 화면을 못 움직이게 됩니다. */
  /* ⚠⚠ **「안쪽이 따로 구르는 곳」은 새 여행 화면만이 아닙니다(b578).** ⚠⚠
   *   b473 에 이 함수를 만들 때는 `.wizbody` 만 봤습니다. 그 뒤로 탭 다섯과
   *   여행 구역 넷이 **전부 제 스크롤러**가 되었는데(b474·b479) 여기는
   *   그대로였습니다. 세어 보니 그런 칸이 일곱 있습니다 —
   *   설정 탭(이름·신고 사유·계정 삭제 확인) · 평가 탭 검색 · 관리자 셋.
   *   iOS 는 칸을 보이게 하려고 **페이지**를 굴리지 육안 스크롤러는 안
   *   건드리므로, 거기서는 쓰던 칸이 밖으로 밀립니다.
   * · 그래서 **가장 가까운 스크롤러**를 찾아서 그것을 굴립니다.
   * · 문서가 스크롤러면 아무것도 안 합니다 — 그건 브라우저가 잘합니다.
   * ⚠ **이미 보이면 아무것도 안 합니다.** 그 조건이 없으면 손으로 조금
   *   내려볼 때마다 도로 끌어올려서 화면을 못 움직이게 됩니다. */
  /* 화면 위 흐림 띠가 끝나는 줄(b790). 홈 화면 앱은 OS 가 위 90pt 쯤을 흐리고,
     또렷해야 하는 것은 `--sat + --edge + 6px` 밑에 둡니다(app.css 의 --edge).
     변수가 env() 라 숫자로 못 읽으므로 그 줄에 안 보이는 핀을 꽂아 잽니다 —
     fixed 요소의 자리는 키보드가 떠도 맞게 나옵니다. */
  let 핀 = null;
  const 흐림밖 = () => {
    if (!핀){
      핀 = document.createElement('i');
      핀.setAttribute('aria-hidden', 'true');
      핀.style.cssText = 'position:fixed; left:0; width:0; height:0; visibility:hidden;' +
                          'pointer-events:none; top:calc(var(--sat, 0px) + var(--edge, 0px) + 6px)';
      document.body.appendChild(핀);
    }
    return 핀.getBoundingClientRect().top;
  };
  const 굴릴칸 = el => {
    let p = el?.parentElement;
    while (p && p !== document.body && p !== document.documentElement){
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 4)
        return p;
      p = p.parentElement;
    }
    return null;
  };

  function keepInView(){
    const el = document.activeElement;
    if (!el || !el.closest) return;
    const body = 굴릴칸(el);
    if (!body) return;
    const er = el.getBoundingClientRect(), br = body.getBoundingClientRect();
    /* ⚠ **크기가 0 이면 손대지 않습니다.** 접혀 있는 칸(이름 바꾸기·신고·
       계정 삭제)은 rect 가 0,0 이라 그대로 셈하면 판을 엉뚱한 데로 굴립니다 —
       실측으로 75px 이 나왔습니다. 숨은 칸에 커서가 갈 일은 없지만, 재 보고
       0 이 나오는 길이 있으면 막아 둡니다. */
    if (!er.height || !br.height) return;

    /* **아래 SAFE 만큼은 없는 자리로 칩니다.** iOS 는 키보드 위에 ∧ ∨ ✓
       막대를 그리는데, 그건 브라우저가 그린 것이 아니라 visualViewport 에
       안 잡힙니다 — 잴 방법이 없습니다. 그래서 좌표로 딱 맞추려 하지 않고
       넉넉히 비워둡니다. 남으면 그냥 여백이고, 모자라면 쓰던 칸이 가려집니다.
       한쪽 실패만 아픈 상황에서는 안 아픈 쪽으로 넉넉히 갑니다.
       ⚠ **시트는 이미 키보드 «위»에 앉아 있습니다**(bottom:var(--vvbot)).
         거기까지 120 을 비우면 짧은 폼이 위로 붕 뜹니다. 떠 있는 판인지
         (position:fixed) 보고 가릅니다.
       ⚠ 페이지 안쪽 스크롤러는 바닥이 키보드 뒤까지 뻗어 있습니다. 그때는
         **잰 키보드 높이**를 씁니다 — 예전의 못 박은 120 은 이번에 iOS 가
         값을 바꾸면서 뜻이 달라졌습니다(b576). */
    const 떠있나 = getComputedStyle(body).position === 'fixed';
    const 가린높이 = Math.max(0, 레이아웃높이() - vv.height);
    const SAFE = 떠있나 ? 24 : (가린높이 ? 가린높이 + 60 : 120);
    /* ⚠⚠ **위 줄은 «흐림 띠 밖»입니다(b790).** 판 맨 위 16px 로 끌어올렸더니
       홈 화면 앱에서 이름 칸이 시계 밑 흐림 속까지 올라가고 사진·이름이
       밀려났습니다(사용자 사진 · 「입력창이 조금만 아래로 내려오게 해줘」).
       떠 있는 시트는 제 자리가 따로라 예전 그대로 둡니다. */
    const top = 떠있나 ? br.top + 16 : Math.max(br.top + 16, vv.offsetTop + 흐림밖());
    const bottom = br.bottom - SAFE;
    /* ── 칸과 단추를 한 덩어리로(`data-kbkeep`, b790) ─────────────────────
       이름 바꾸기처럼 칸 바로 밑에 「저장」이 있는 곳. 칸만 맨 위로 보내면
       위 맥락(사진·이름)이 다 밀려나고, 칸만 키보드 위에 맞추면 단추가
       키보드 뒤로 숨습니다. 그래서 **덩어리가 다 보이면 안 굴리고**, 아니면
       **단추가 키보드 위에 막 걸릴 만큼만** 올립니다(칸이 위 줄을 넘지는 않게).
       값은 덩어리의 끝이 될 요소 id 입니다 — 안내 글까지 올릴 필요는 없습니다. */
    const 묶음 = !떠있나 && el.closest('[data-kbkeep]');
    if (묶음){
      const 끝 = document.getElementById(묶음.dataset.kbkeep) || 묶음;
      const 끝아래 = 끝.getBoundingClientRect().bottom;
      /* 아래 줄은 «보이는 창» 기준입니다 — iOS 가 창을 밀었어도(offsetTop) 맞습니다.
         60 은 키보드 위 ∧∨✓ 막대 몫입니다(visualViewport 에 안 잡힘). */
      const 아래 = Math.min(br.bottom - 16, vv.offsetTop + vv.height - 60);
      if (er.top >= top && 끝아래 <= 아래) return;
      /* 덩어리 끝을 아래 줄에 맞춥니다 — 위로 끌어올릴 때도(단추가 가려짐), 누가
         너무 올려 둔 것을 되돌릴 때도(칸이 흐림 속) 같은 식입니다. 칸이 위 줄을
         넘어가면 거기서 멈춥니다. */
      let 이동 = 끝아래 - 아래;
      if (er.top - 이동 < top) 이동 = er.top - top;
      body.scrollTop += 이동;
      return;
    }
    if (er.top >= top && er.bottom <= bottom) return;
    /* 가운데가 아니라 **위쪽으로** 데려옵니다. 가운데로 두면 칸이 아래
       절반에 앉는데, 가려지는 곳이 바로 거기입니다. */
    body.scrollTop += er.top - top;
  }
  /* 키보드가 올라오는 동안 높이가 몇 번에 걸쳐 바뀝니다. 한 번만 재면
     올라오기 전 크기로 계산하게 됩니다. 몇 박자 나눠 다시 봅니다. */
  const keepSoon = () => [0, 150, 350].forEach(t => setTimeout(keepInView, t));

  /* ⚠⚠ **한 번 재고 끝내면 값이 낡습니다(b575).** ⚠⚠
   *   실측(아이폰 홈 화면 앱, 눈금자 사진 2026-08-31, b574):
   *       inner 793 · vv.h 424 · off 0 → 키보드가 가린 높이 **369**
   *       그런데 저장돼 있던 `--kb` 는 **0px**
   *   같은 프레임에 살아 있는 값은 369 인데 저장된 값이 0 이었습니다.
   *   **왜 낡았는지와 상관없이, 낡았다는 것 자체가 증거입니다.**
   *   (짚이는 것: iOS 는 키보드를 올리며 `offsetTop` 을 0 ↔ 369 로 뒤집는데,
   *    그 뒤집히는 순간에 `resize` 가 늘 오지는 않습니다. 이 파일 위쪽에
   *    「off 는 규칙으로 적을 수 있는 값이 아니다」라고 적어둔 그 문제입니다.)
   *   그래서 **키보드가 올라오는 동안 여러 박자로 다시 잽니다.** 위의 `넣기`
   *   가 안 바뀐 값을 거르므로 여러 번 불러도 값이 같으면 공짜입니다.
   * ⚠ 시트가 열려 있는 동안에는 느린 파수꾼도 하나 둡니다 — 위 셋(resize ·
   *   scroll · focusin)이 다 안 오는 경우가 실제로 있었기 때문입니다.
   *   시트가 없으면 아무 일도 안 합니다. */
  const fitSoon = () => [0, 60, 150, 300, 500, 800].forEach(t => setTimeout(fit, t));

  vv.addEventListener('resize', () => { fitSoon(); keepSoon(); });
  vv.addEventListener('scroll', fit);   /* 구를 때는 안 붙잡습니다 — 손을 이겨버립니다 */
  /* 커서가 어디 있는지로 판단하므로 커서가 옮겨갈 때도 다시 재야 합니다.
     focusout 은 다음 칸으로 옮겨가는 중에도 한 번 뜨므로 한 박자 늦춥니다 —
     안 그러면 칸을 옮길 때마다 여백이 깜빡입니다. */
  addEventListener('focusin',  () => { fitSoon(); keepSoon(); });
  addEventListener('focusout', () => setTimeout(fit, 60));
  setInterval(() => {
    if (document.body.classList.contains('sheeton')) fit();
  }, 400);
  fit();

  /* ── 키보드 눈금자 (개발용) ───────────────────────────────────────
   * 키보드가 올라왔을 때 레이아웃이 밀리는데, 저는 아이폰 키보드를 띄워서
   * 재볼 수가 없습니다. 숫자를 화면에 찍어 사진 한 장으로 갈리게 합니다.
   *
   *   켜기 : 주소 끝에 ?kb=1     끄기 : ?kb=0
   * 한 번 켜면 기억합니다 — 홈 화면 앱으로 열어도 그대로 나옵니다.
   * 평소에는 아무에게도 안 보입니다. */
  {
    const q = new URLSearchParams(location.search).get('kb');
    if (q === '1') localStorage.setItem('t2:kbdbg', '1');
    if (q === '0') localStorage.removeItem('t2:kbdbg');

    /* 홈 화면 앱은 사파리와 저장 공간이 따로라 ?kb=1 이 안 넘어갑니다.
       그래서 **정작 고쳐야 하는 곳에서 숫자를 한 번도 못 봤습니다** —
       사파리 숫자로 홈 화면 앱을 맞추려 했으니 계속 틀렸습니다.
       관리자면 저절로 켜지게 합니다. 주소에 뭘 붙일 필요가 없어집니다. */
    /* ── 막대 뒤에 그려지는 것은 무엇인가 (자 두 벌) ──────────────────
       b173 에서 contenteditable 로 막대를 없애려다 실패했습니다(vv.h 424 그대로).
       없앨 수 없다면 덮어야 하는데, 그러려면 **그 자리에 무엇의 어느 부분이
       그려지는지**를 알아야 합니다. 그걸 모르는 채로 b170·b171 에서 두 번
       헛짚었습니다. 이번에는 자를 대고 사진으로 읽습니다.

         왼쪽 빨강 F###  = position:fixed   (뷰포트 기준 좌표)
         오른쪽 파랑 A### = position:absolute (문서 기준 좌표)

       키보드를 올린 사진에서 **막대 뒤에 어느 색 몇 번이 비치는지**가 답입니다.
         빨강이 비친다  → fixed 가 그 자리에도 그려진다. 시트를 늘리면 덮인다.
         파랑만 비친다  → fixed 는 잘린다. 문서 안에 덮개를 넣어야 한다.
         아무것도 안 비친다 → 그 자리는 페이지가 아니라 브라우저가 그린다.
       눈금자 상자를 **손가락으로 누르면** 켜지고 꺼집니다 — 홈 화면 앱은
       주소로 값을 넘길 수 없어서(사파리와 저장 공간이 다릅니다) 이 길뿐입니다. */
    const probe = (on) => {
      document.querySelectorAll('.kbprobe').forEach(n => n.remove());
      if (!on) return;
      [true, false].forEach(fx => {
        const h = fx ? window.innerHeight
                     : Math.max(document.documentElement.scrollHeight,
                                window.innerHeight);
        const d = document.createElement('div');
        d.className = 'kbprobe';
        d.style.cssText =
          `position:${fx ? 'fixed' : 'absolute'}; ${fx ? 'left' : 'right'}:0; top:0;` +
          `width:54px; height:${h}px; z-index:99998; pointer-events:none;` +
          `background:${fx ? 'rgba(210,0,0,.78)' : 'rgba(0,70,220,.78)'};` +
          `color:#fff; font:bold 12px/1 ui-monospace,monospace`;
        let s = '';
        for (let y = 0; y < h; y += 40)
          s += `<span style="position:absolute; top:${y}px; left:3px;` +
               `border-top:1px solid #fff; width:48px; padding-top:1px">` +
               `${fx ? 'F' : 'A'}${y}</span>`;
        d.innerHTML = s;
        document.body.appendChild(d);
      });
      /* b820: **화면 높이(screen.height)만큼** 긴 초록 띠 하나 더(가운데). 새로 담은 홈 화면 앱에서 레이아웃이
         화면보다 59 짧게 잡혀 탭바가 떴습니다(사용자 사진). 그 59 자리를 «우리가 칠할 수 있나»가 고치는 길을
         가릅니다 — 초록 S 눈금이 화면 맨 아래까지 보이면 칠할 수 있는 자리, 793 근처에서 잘리면 iOS 자리. */
      const g = document.createElement('div');
      g.className = 'kbprobe';
      const gh = Math.round(screen.height || 0);
      g.style.cssText = `position:fixed; left:calc(50% - 27px); top:0; width:54px; height:${gh}px; z-index:99998;` +
        'pointer-events:none; background:rgba(0,150,60,.8); color:#fff; font:bold 12px/1 ui-monospace,monospace';
      let gs = '';
      for (let y = 0; y < gh; y += 40)
        gs += `<span style="position:absolute; top:${y}px; left:3px; border-top:1px solid #fff; width:48px;` +
              `padding-top:1px">S${y}</span>`;
      g.innerHTML = gs;
      document.body.appendChild(g);
    };
    /* b820: 안전영역(env)은 JS 로 바로 못 읽어서 잠깐 상자를 세워 잽니다. */
    const 안전영역 = () => {
      const t = document.createElement('div');
      t.style.cssText = 'position:fixed; top:0; left:0; width:1px; visibility:hidden; pointer-events:none;' +
        'padding-top:env(safe-area-inset-top); padding-bottom:env(safe-area-inset-bottom)';
      document.body.appendChild(t);
      const cs = getComputedStyle(t), r = [parseFloat(cs.paddingTop) || 0, parseFloat(cs.paddingBottom) || 0];
      t.remove();
      return r;
    };

    window.startRuler = () => {
      if (window.__ruler) return;
      window.__ruler = true;
      const box = document.createElement('div');
      /* pointer-events 를 살려야 눌러서 자를 켤 수 있습니다. 눈금자는 화면
         왼쪽 위 구석이라 앱의 무엇도 가리지 않습니다. */
      box.style.cssText =
        'position:fixed; left:6px; top:6px; z-index:99999; pointer-events:auto;' +
        'background:rgba(0,0,0,.82); color:#0f0; font:11px/1.45 ui-monospace,monospace;' +
        'padding:6px 8px; border-radius:8px; white-space:pre; max-width:70vw';
      /* **누르는 순간 preventDefault 해야 합니다.** 안 그러면 입력칸에서 커서가
         빠져 키보드가 내려갑니다 — 키보드가 올라와 있을 때만 볼 수 있는 것을
         재려는데 누르는 행동이 그 상태를 없앱니다. click 을 기다리지 않고
         touchstart 에서 바로 처리합니다(preventDefault 하면 click 이 안 옵니다). */
      const toggle = (e) => {
        e.preventDefault();
        window.__probe = !window.__probe;
        probe(window.__probe);
      };
      box.addEventListener('touchstart', toggle, { passive:false });
      box.addEventListener('mousedown',  toggle);
      document.body.appendChild(box);

      const show = () => {
        /* position:fixed 는 iOS 에서 **키보드로 줄어들지 않는 바깥 화면**을
           기준으로 붙습니다. 키보드가 올라와 화면이 밀리면 눈금자가 위로
           사라집니다 — 정작 봐야 할 순간에 안 보였습니다.
           보이는 화면(visualViewport)을 따라오게 매 프레임 자리를 잡아줍니다. */
        box.style.top = (vv.offsetTop + 6) + 'px';
        const el = document.activeElement;
        const s  = $('aiview');
        const r  = s && !s.classList.contains('hide') ? s.getBoundingClientRect() : null;
        const kb = getComputedStyle(document.documentElement)
                     .getPropertyValue('--kb').trim();
        /* 눈금자가 0/0 이라는데 화면은 안 맞았습니다. 그러면 눈금자가 못 보는
           구간이 있는 것입니다. 사파리는 아래 도구막대 자리에도 페이지를 계속
           그리는데, innerHeight 와 visualViewport 는 그 자리를 안 셉니다.
           그걸 재려면 화면 전체 높이와 견줘봐야 합니다. */
        const dpr  = window.devicePixelRatio || 1;
        const scrH = Math.round(screen.height);          /* 기기 화면 (CSS px) */
        const cliH = document.documentElement.clientHeight;
        /* 시트 바닥을 레이아웃 기준으로 환산합니다. rect 는 보이는 화면 기준입니다. */
        const botLay = r ? Math.round(r.bottom + vv.offsetTop) : null;
        /* 위에서 이미 s 로 잡아뒀습니다. 여기서 또 const s 를 쓰면
           "Identifier 's' has already been declared" 로 **app.js 가 통째로
           파싱에 실패합니다** — 눈금자 안이든 밖이든 문법 오류는 앱을 죽입니다. */
        const tf = s?.style.transform || '(없음)';

        box.textContent =
          /* **화면 버전을 안 찍고 있었습니다.** 그래서 사진을 받고도 이게 고친
             판인지 옛 판인지 가릴 수가 없었습니다. 배포는 캐시 때문에 늦게
             오는데, 그동안의 사진을 "안 고쳐졌다"로 잘못 읽을 뻔했습니다.
             재는 장치에는 **무엇을 재고 있는지**가 늘 함께 있어야 합니다. */
          `화면      ${$('build')?.textContent || '?'}\n` +
          /* **rect 는 더 이상 안 찍습니다.** absolute 요소의 rect 는 부풀려진
             scrollY 를 타서 "793~1302, 맞음"이라고 거짓말했습니다(b176).
             지금 덮개는 문서 전체를 깔므로 볼 것은 높이 하나뿐입니다. */
          `덮개      ${kbCover
             ? `h ${parseInt(kbCover.style.height)} / 문서 ` +
               `${document.documentElement.scrollHeight}`
             : '없음'}\n` +
          /* 덮개가 없으면 **왜** 없는지가 갈려야 합니다. 조건이 둘입니다. */
          `덮개조건  시트 ${document.body.classList.contains('sheeton') ? 'Y' : 'N'}` +
          `  키보드차 ${Math.round(Math.max(document.documentElement.clientHeight,
                                          window.innerHeight) - vv.height)} (>60이어야)\n` +
          /* b175 가 안 먹은 것이 자리 계산 때문인지 보려면 두 기준을 견줘야
             합니다. 같으면 계산은 죄가 없고 다른 곳이 원인입니다. */
          `좌표기준  scrollY ${Math.round(window.scrollY)}` +
          `  rect ${Math.round(-document.documentElement.getBoundingClientRect().top)}\n` +
          `--kb      ${kb}\n` +
          `inner     ${window.innerHeight}   outer ${window.outerHeight}` +
          `   (레이아웃 ${Math.max(cliH, window.innerHeight)})\n` +
          `client    ${cliH}   screen ${scrH}   dpr ${dpr}\n` +
          `vv.h      ${Math.round(vv.height)}  off ${Math.round(vv.offsetTop)}` +
          `  합 ${Math.round(vv.height + vv.offsetTop)}\n` +
          `재는중?   ${typing() ? 'Y' : 'N'}  <${(el?.tagName || '-').toLowerCase()}>` +
          `${el?.isContentEditable ? ' CE' : ''}  ${STANDALONE ? '홈앱' : '사파리'}\n` +
          /* b820: 새 홈 화면 앱에서 탭바가 59 떠 있던 것을 재려고 — 안전영역과 탭바가 실제로 어디 앉았는지. */
          `안전영역  위 ${안전영역()[0]}  아래 ${안전영역()[1]}\n` +
          `탭바      ${(() => { const t = document.querySelector('.tabbar'); if (!t) return '없음';
            const q = t.getBoundingClientRect(); return `top ${Math.round(q.top)}  bottom ${Math.round(q.bottom)}`; })()}\n` +
          /* b173 에서 contenteditable 로 바꿔봤지만 vv.h 가 424 그대로였습니다.
             **iOS 는 contenteditable 에도 그 막대를 붙입니다.** 없앨 수 없습니다.
             남은 길은 덮는 것이고, 그러려면 자(위 probe)를 눌러 켜서
             막대 뒤에 어느 색 몇 번이 비치는지 사진으로 읽어야 합니다. */
          `자    ${window.__probe ? '켜짐 — 막대 뒤 색·번호를 읽으세요' : '꺼짐 (여기를 누르세요)'}\n` +
          `transform ${tf}\n` +
          (r ? `시트 top ${Math.round(r.top)}  h ${Math.round(r.height)}\n` +
               `시트 bot ${Math.round(r.bottom)}  레이아웃기준 ${botLay}\n` +
               `★ 안 덮인 아래  ${scrH - (botLay ?? 0)}  (screen-시트바닥)\n` +
               `★ inner 밖      ${scrH - window.innerHeight}  (screen-inner)`
             : '시트 닫힘');
        requestAnimationFrame(show);
      };
      show();
    };
    /* 주소로 켠 경우 (사파리). 관리자면 loadAdmin 이 로그인 뒤에 부릅니다. */
    if (localStorage.getItem('t2:kbdbg') === '1') window.startRuler();
  }
}

/* ── 탭바 높이를 재둡니다(b502 · b503 에 고침) ────────────────────────
 * 아래 여백을 84px 로 박아뒀더니 두 가지에 걸렸습니다.
 *   ① 탭바가 글자 크기(--ts)를 타서 자랍니다 — 실측 ts 1 에 58.2px,
 *      1.2 에 61.4, 1.35 에 63.8. 박아둔 값으로는 여유가 8px 까지 줄었습니다.
 *   ② 고칠 때마다 두 군데(body.hastab · .tabpane)를 같이 고쳐야 했습니다.
 * 재서 --tabh 하나로 넘깁니다. CSS 는 여기에 12(바닥에서 뜬 만큼)와
 * 24(숨쉴 자리)를 더해 씁니다.
 *
 * ⚠⚠ **ResizeObserver 로 했다가 한 번도 안 불렸습니다(b503).** ⚠⚠
 *   `.hide` 가 `display:none !important` 라, 로그인 전에는 탭바에 **상자가
 *   아예 없습니다.** 그래서 첫 측정이 0 으로 나와 건너뛰는데, 로그인해서
 *   보이게 된 뒤에도 관찰자가 안 왔습니다(재봤습니다 — 기록 0건).
 *   상자가 없는 요소는 관찰 대상에서 빠지는 것으로 봐야 합니다.
 *   **클래스가 바뀌는 것을 봅니다** — 그게 실제로 일어나는 일입니다.
 * ⚠ 0 은 안 넣습니다. 숨었을 때 0 을 넣으면 돌아왔을 때 여백이 36px 뿐이라
 *   마지막 줄이 또 가립니다. CSS 쪽에 `var(--tabh, 58px)` 로 대비도 둡니다 —
 *   이 파일이 통째로 안 돌아도 예전 값과 비슷하게는 갑니다.
 * ⚠ 글자 크기는 창을 안 바꾸므로 resize 로 못 잡습니다. 바꾸는 쪽
 *   (profile.js 의 글자 크기)에서 이 함수를 직접 부릅니다. */
export function fitTabBar(){
  const 바 = document.querySelector('.tabbar');
  if (!바) return;
  const h = Math.round(바.getBoundingClientRect().height);
  if (h > 0) document.documentElement.style.setProperty('--tabh', h + 'px');
}
fitTabBar();
addEventListener('resize', fitTabBar);
/* 글꼴이 늦게 실리면 탭바 글자가 커지면서 한 번 더 자랍니다. */
document.fonts?.ready?.then(fitTabBar);
{
  const 바 = document.querySelector('.tabbar');
  if (바) new MutationObserver(fitTabBar)
    .observe(바, { attributes:true, attributeFilter:['class'] });
}
