/* ── 별 그리기 ─────────────────────────────────────────────────────────
 * 별점은 홈("여기 가보셨어요?") · 도시 상세 · 보관함("내 평가") · 여행 후기 ·
 * 여행 끝난 뒤 화면까지 **다섯 군데**에서 같은 모양으로 나와야 합니다.
 * 그래서 그리는 방법만 여기 모읍니다.
 *
 * 여기 있는 셋은 **받은 것만 보고 화면만 만집니다.** 무엇을 몇 점 줬는지
 * (myRates · cityStat · visited)는 여전히 app.js 가 들고 있습니다 —
 * 그 자료는 네 화면이 같이 쓰는 것이라 여기로 옮기면 반쪽만 오게 됩니다.
 * calc.js 와 같은 규칙입니다: 앱 상태를 모르는 것만 여기 둡니다.
 */

/* 0.5 단위를 칸 너비(%)로 표현합니다. 반 개짜리 별 이미지를 따로 두지
   않으려고 안쪽 <i> 의 width 를 잘라 씁니다. */
/* ── 별점을 다섯 갈래로 (b727) ─────────────────────────────────────────
 * ⚠ **반 칸 규칙과 같은 자리에 둡니다.** 4.5 를 ★4점대로 칠지 ★5로 칠지는
 *   「반 칸을 어떻게 세느냐」와 같은 물음이고, 그 규칙은 이 파일 한 곳입니다(b491).
 * ⚠ **b727 전에는 shelf.js 안에만 있었습니다.** 분석 탭이 같은 분포를
 *   그리게 되면서 두 벌이 될 뻔했습니다 — 두 벌이면 언젠가 보관함의
 *   「★4점대 32곳」과 분석 탭의 막대가 다른 수를 말합니다.
 * ⚠ 4.5 를 ★5 에 넣으면 **★5 가 부풀고 정작 5.0 을 준 곳이 묻힙니다.**
 * ⚠ `null` 은 「아직 안 매김」입니다 — 이 앱에서 별점 없는 줄은
 *   「안 가봤어요」이기도 합니다(b407). 세는 쪽이 알아서 가릅니다. */
export const 별갈래 = s => s == null ? 'none'
                        : s >= 5    ? '5'
                        : s >= 4    ? '4'
                        : s >= 3    ? '3'
                        : s >= 2    ? '2' : '1';
/* 갈래 이름. **보관함 시트와 분석 탭이 같은 말을 써야** 같은 것으로 읽힙니다. */
export const BAND_NAME = { '5':'★5', '4':'★4점대', '3':'★3점대',
                           '2':'★2점대', '1':'★1점대 이하' };

export function starHtml(v){
  return [1,2,3,4,5].map(n => {
    const f = v == null ? 0 : Math.max(0, Math.min(1, v - (n - 1)));
    return `<span class="st" data-n="${n}"><i style="width:${(f*100).toFixed(0)}%"></i></span>`;
  }).join('');
}

/* ── 보여주기만 하는 별(b731) ─────────────────────────────────────────
 * ⚠⚠ **★ 는 CSS 가 그립니다**(`.st::before{content:'★'}`). 그래서 별 한 벌이
 *   접근성 트리에서는 **★ 다섯 개**로 읽힙니다. 남들 한줄평이 열 줄이면
 *   쉰 번입니다(외부 QA 2026-09-09: 「반복된 별표가 구조에 남는다」).
 * ⚠ `role="img"` 를 달면 **그 안쪽은 통째로 안 읽힙니다** — 라벨 한 마디만
 *   남습니다. 그래서 안쪽에 `aria-hidden` 을 따로 안 붙여도 됩니다.
 * ⚠⚠ **누르는 별에는 쓰면 안 됩니다.** 이건 「그림」이라고 선언하는 것이라,
 *   실제로 눌러서 매길 수 있는 별에 달면 **조작할 수 있다는 사실을 감춥니다.**
 *   누르는 별은 슬라이더(`role="slider"`)로 가야 하는데, 그건 반 칸 판정
 *   (`starValue` 의 x 좌표)과 끌기(b491)를 같이 봐야 해서 따로 합니다.
 * ⚠ `pointer-events:none` 을 인라인으로 세 곳에 적어 두었던 것을 `.ro`
 *   한 자리로 모읍니다(app.css). home.js 주석에 「`.ro` 를 달아 눌러도 안
 *   매겨지게 합니다」라고 적혀 있었는데 **그 클래스가 없었습니다.** */
export const starLabel = v =>
  v == null ? '별점 없음' : `별점 ${Number(v)}점`;
export const starsRo = v =>
  `<span class="stars ro" role="img" aria-label="${starLabel(v)}">${starHtml(v)}</span>`;

/* 별을 누르면 그 자리에서 바로 칠합니다. 저장을 기다렸다 다시 그리면
   그 사이에 아무 일도 안 일어난 것처럼 보이고, 다시 그리는 순간
   정렬이 바뀌어 줄이 위로 튀어 오릅니다 — 눌렀는지 알 수가 없습니다. */
export function paintStars(wrap, v, animate){
  [...wrap.querySelectorAll('.st')].forEach((st, n) => {
    const f = Math.max(0, Math.min(1, (v ?? 0) - n));
    st.querySelector('i').style.width = (f * 100).toFixed(0) + '%';
    if (!animate) return;
    st.classList.remove('pop');
    if (f <= 0){ st.style.animationDelay = ''; return; }
    /* 같은 애니메이션을 다시 틀려면 한 번 끊어줘야 합니다.
       offsetWidth 를 읽으면 브라우저가 그 자리에서 계산해 흐름이 끊깁니다. */
    void st.offsetWidth;
    st.style.animationDelay = (n * 55) + 'ms';   /* 왼쪽부터 차례로 */
    st.classList.add('pop');
  });
}

/* ⚠ **「★ 4 기록」 딱지(markRated)를 걷었습니다(b823, 사용자: 「이게 안뜨게 하면 되잖아」).** 별을 누르면 목록
   줄의 이름 옆에 붙던 것인데, 375px 폭에서 이름 밑으로 넘어가 줄이 24px 늘고 **아래 줄이 통째로 밀렸습니다**
   — 연달아 매기다 다음 별을 잘못 누르게 됩니다(b822 에 재서 찾음). 점수는 바로 옆 칠해진 별이 이미 말합니다.
   평가 탭 목록(rating.js)과 보관함(shelf.js) 두 곳이 쓰던 것이라 둘 다 걷었습니다. 되살리려거든 줄 높이를
   바꾸지 않는 자리에 두십시오. */

/* ── 눌린 자리에서 별점을 읽습니다 ────────────────────────────────────
 * **반 칸(0.5점)은 왼쪽 절반**입니다.
 * ⚠ **rateui.js 에 있던 것을 여기로 내렸습니다(b491).** 거기 주석에는
 *   「세 화면이 같은 규칙을 써야 하므로 여기 한 곳에 둔다」고 적혀 있었는데,
 *   정작 **rating.js · review.js · shelf.js 가 같은 식을 손으로 베껴** 쓰고
 *   있었습니다(넉 벌). 그 셋은 rateui 를 import 하지 않습니다 — 별을 쓰는
 *   여섯 화면이 다 닿는 가장 아래층은 여기(stars.js)입니다.
 *   rateui.js 는 이 이름을 그대로 다시 내보내므로 부르는 쪽은 안 바뀝니다. */
export function starValue(st, clientX){
  const b = st.getBoundingClientRect();
  /* ⚠ **별 왼쪽 «밖»이면 그 별 아래입니다(b494).** 첫 별이면 **0** — 즉
     「지우기」입니다. 손가락으로 끌어 맨 왼쪽까지 갔을 때 0.5 에 붙어
     있으면 별점을 취소할 길이 없습니다.
     ⚠ 톡 누를 때는 이 가지를 절대 안 탑니다 — 누른 요소 밖의 좌표가
       나올 수 없습니다. 아래 끌기가 만들어 보내는 클릭만 여기로 옵니다. */
  if (clientX < b.left) return +st.dataset.n - 1;
  return +st.dataset.n - ((clientX - b.left) < b.width / 2 ? 0.5 : 0);
}

/* 통 안에서 x 가 가리키는 별점. 통 **밖으로 나가도** 양 끝으로 붙잡습니다 —
   끌다가 손가락이 별을 벗어나면 값이 사라져 되돌아가 보입니다. */
function 끌린값(wrap, x){
  const 별 = [...wrap.querySelectorAll('.st')];
  if (!별.length) return null;
  const 첫 = 별[0].getBoundingClientRect();
  const 끝 = 별[별.length - 1].getBoundingClientRect();
  /* ⚠ **맨 왼쪽 밖은 0 입니다(b494).** 0.5 로 붙잡아 두면 끌어서 별점을
     **취소할 길이 없습니다** — 사용자가 바로 짚은 것이 이것입니다.
     0 은 앱 전체에서 「지우기」로 통합니다(rating.js 의 saveRate 참고). */
  if (x <= 첫.left)  return 0;
  if (x >= 끝.right) return 별.length;
  const st = 별.find(s => { const b = s.getBoundingClientRect();
                            return x >= b.left && x <= b.right; });
  return st ? starValue(st, x) : null;
}

/* ── 끌어서 매기기(b491) ──────────────────────────────────────────────
 * 별 위에서 좌우로 끌면 따라 칠해지고, 떼는 자리의 점수로 매겨집니다.
 *
 * ⚠ **매기는 처리는 여기서 안 합니다.** 여섯 화면이 매긴 뒤에 할 일이
 *   다 다릅니다(홈은 다음 도시로, 맛보기는 다섯 곳 채우면 카드, 연속
 *   평가는 세면서 넘김, 기록·후기·보관함은 같은 점수를 다시 주면 지움).
 *   그래서 뗄 때 **그 자리에 «누른 것»을 만들어 보냅니다** — 여섯 화면의
 *   기존 click 처리가 그대로 받습니다. 새 경로를 만들지 않습니다.
 *
 * ⚠ **native click 을 막아야 합니다.** 손가락을 끌었다 떼면 브라우저가
 *   click 을 한 번 더 냅니다. 그러면 같은 별을 두 번 매기게 되고, 기록
 *   탭처럼 「같은 점수를 다시 누르면 지움」인 화면에서는 **매기자마자
 *   지워집니다.** 우리가 만든 것은 표시를 달아 통과시키고 나머지는 막습니다.
 *
 * ⚠ **끌린 뒤에만 가로챕니다.** 그냥 톡 누른 것은 손대지 않습니다 —
 *   기존 동작이 그대로여야 합니다(문턱 4px).
 *
 * ⚠ CSS 에서 `.stars{ touch-action:pan-y }` 여야 합니다. `manipulation`
 *   이면 가로 제스처를 브라우저가 가져가 **탭이 넘어갑니다**(#tabdeck).
 *   세로는 브라우저에 남겨 둡니다 — 별 위에서 시작해도 화면은 굴러야
 *   합니다(일정 손잡이에서 배운 것, app.css 의 .ev .grip 주석). */
let 끌기 = null, 막을클릭 = false;

export function armStarDrag(){
  if (armStarDrag.done) return;    /* 두 번 달면 한 번 끌 때 두 번 매깁니다 */
  armStarDrag.done = true;

  /* ⚠⚠ **iOS 는 `pointermove` 의 preventDefault 로 안 멈춥니다(b493).** ⚠⚠
   *   b491 에서 그것만 걸어 두었더니 **폰에서 가로 끌기가 잘 안 됐습니다.**
   *   밑에서 도는 `touchmove` 가 그대로 굴러서 사파리가 세로 팬으로 판단하고
   *   `pointercancel` 을 던졌고, 우리 쪽은 원래 값으로 되돌리니 아무 일도
   *   안 일어난 것처럼 보였습니다.
   *   `planview.js` 의 일정 끌기에서 **이미 겪고 적어둔 함정**인데 여기서
   *   똑같이 걸렸습니다 — 그쪽 주석: 「iOS 에서는 이 줄이 있어야 멈춥니다」.
   * ⚠ **끌기가 시작된 뒤에만** 막습니다. 늘 막으면 별 위에서 시작한 세로
   *   스크롤이 죽습니다 — 기록 탭은 줄마다 별이 있어 목록을 못 굴립니다.
   * ⚠ `passive:false` 여야 preventDefault 가 먹습니다.
   * ⚠ **통에 답니다.** 터치 이벤트는 손가락이 벗어나도 «시작한 요소»로
   *   갑니다. 문서에 non-passive 로 달면 앱 전체 스크롤이 무거워집니다. */
  const 굴림막기 = e => { if (끌기?.끌림) e.preventDefault(); };

  document.addEventListener('pointerdown', e => {
    if (e.button != null && e.button !== 0) return;
    const st = e.target.closest?.('.st');
    const wrap = st?.closest('.stars');
    if (!wrap) return;
    끌기 = { wrap, id:e.pointerId, x0:e.clientX, y0:e.clientY, 끌림:false, 포기:false,
             처음:[...wrap.querySelectorAll('.st i')]
                    .reduce((s, i) => s + (parseFloat(i.style.width) || 0) / 100, 0) };
    wrap.addEventListener('touchmove', 굴림막기, { passive:false });
  });

  document.addEventListener('pointermove', e => {
    if (!끌기 || e.pointerId !== 끌기.id || 끌기.포기) return;
    const dx = e.clientX - 끌기.x0, dy = e.clientY - 끌기.y0;
    if (!끌기.끌림){
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      /* ⚠ **세로가 이기면 포기합니다.** `touch-action:pan-y` 라 세로는
         브라우저 것입니다 — 여기서 붙잡으면 목록을 굴리려던 손가락이
         별점을 매깁니다. 하단바 쓸기(ui.js 의 onSwipeX)와 같은 규칙입니다. */
      if (Math.abs(dx) <= Math.abs(dy)){ 끌기.포기 = true; return; }
      끌기.끌림 = true;
      /* 손가락이 별을 벗어나도 계속 받습니다. */
      try { 끌기.wrap.setPointerCapture(e.pointerId); } catch {}
    }
    const v = 끌린값(끌기.wrap, e.clientX);
    if (v != null) paintStars(끌기.wrap, v, false);
    e.preventDefault();
  }, { passive:false });

  const 끝내기 = e => {
    const d = 끌기; 끌기 = null;
    if (!d) return;
    /* 다른 손가락의 끝은 무시하되, 내 것이면 반드시 뒷정리합니다 —
       안 떼면 통마다 touchmove 가 쌓여 스크롤이 점점 무거워집니다. */
    if (e.pointerId !== d.id){ 끌기 = d; return; }
    d.wrap.removeEventListener('touchmove', 굴림막기, { passive:false });
    try { d.wrap.releasePointerCapture(e.pointerId); } catch {}
    if (!d.끌림) return;                       /* 톡 누른 것 — 기존 click 에 맡깁니다 */
    if (e.type === 'pointercancel'){ paintStars(d.wrap, d.처음, false); return; }

    const v = 끌린값(d.wrap, e.clientX);
    const 별 = [...d.wrap.querySelectorAll('.st')];
    /* 0(지우기)은 **첫 별의 왼쪽 밖**을 누른 셈으로 보냅니다 — starValue 가
       그것을 0 으로 되읽습니다(위). 0 을 나타낼 별 자체가 없으므로 이렇게
       합니다. */
    const st = v === 0 ? 별[0] : 별.find(s => +s.dataset.n === Math.ceil(v));
    if (!st){ paintStars(d.wrap, d.처음, false); return; }
    /* 반 칸이면 그 별의 왼쪽 절반, 아니면 오른쪽 절반을 누른 셈으로 보냅니다 —
       받는 쪽은 starValue 로 되읽으므로 x 가 정확해야 합니다. */
    const b = st.getBoundingClientRect();
    const x = v === 0 ? b.left - 4
            : b.left + (Number.isInteger(v) ? b.width * 0.75 : b.width * 0.25);
    const ev = new MouseEvent('click', { bubbles:true, cancelable:true,
                                         clientX:x, clientY:b.top + b.height / 2 });
    ev.끌어서 = true;
    st.dispatchEvent(ev);
    막을클릭 = true;                            /* 뒤따라오는 native click 하나를 막습니다 */
    setTimeout(() => { 막을클릭 = false; }, 400);
  };
  document.addEventListener('pointerup', 끝내기);
  document.addEventListener('pointercancel', 끝내기);

  document.addEventListener('click', e => {
    if (!막을클릭 || e.끌어서) return;
    if (!e.target.closest?.('.stars')) return;
    막을클릭 = false;
    e.stopPropagation(); e.preventDefault();
  }, true);
}
