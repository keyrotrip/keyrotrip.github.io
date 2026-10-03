/* ── 연속 평가 — 넘기며 매기기 ────────────────────────────────────────
 * ⚠ **b680 에 「쭉 매기기」에서 이름을 바꿨습니다**(사용자: 「뭔말인지도
 *   모르겠고」). 화면 글자는 index.html 의 `#spreego` 에 있습니다.
 *   옛 이름으로 적힌 자료를 찾을 때를 위해 여기 한 번 남겨 둡니다.────
 * **한 화면에서 계속 넘기며 매깁니다(b409).** 사진 한 장 · 별 다섯 · 넘기기,
 * 매기면 바로 다음 도시가 올라옵니다.
 *
 * ⚠ **홈에서도 매길 수 있는데 왜 따로 만드나.** 홈의 히어로는 한 곳이고
 *   그 아래에 목록·발자국이 섞여 있어 **"쭉 매기는 흐름" 으로 안 읽힙니다.**
 *   여기는 화면에 그것 하나만 둡니다 — 다섯 곳이 30초입니다.
 *   재료는 이미 다 있습니다: 469곳에 사진과 설명이 붙어 있습니다.
 *
 * ⚠ **홈을 다시 그리지 않습니다.** 매길 때마다 `loadHome()` 을 부르면 화면이
 *   튀고 사진이 깜빡입니다. 여기서는 **지문만 비우고**(resetHomeSig) 나갈 때
 *   한 번 다시 그립니다. 홈에서 배운 것과 같습니다(b405).
 *
 * ⚠ **자기 우물을 씁니다.** 홈의 `quizPool` 을 같이 쓰면 두 화면이 서로의
 *   목록을 갉아먹습니다. 여기서 매긴 것은 서버에 남으므로 홈이 다음에
 *   그릴 때 자연히 빠집니다 — 그것으로 충분합니다.
 *
 * 층: dom.js · db.js · cities.js · citysearch.js · stars.js · rateui.js ·
 *     rate.js · rating.js · home.js(지문 비우기만). */
import { $, esc } from './dom.js?v=b824';
import { sb } from './db.js?v=b824';
import { cities } from './cities.js?v=b824';
import { loadCities } from './citysearch.js?v=b824';
import { paintStars } from './stars.js?v=b824';
import { rateHero, starValue } from './rateui.js?v=b824';
import { saveRate, 방금확정 } from './rating.js?v=b824';
import { resetHomeSig } from './home.js?v=b824';

/* ⚠ showApp 은 **기본값에도 둡니다.** 없으면 위 돌아가기() 가 조용히
   아무 일도 안 하는데, 그게 b423~b425 동안 그대로 나가 있었습니다. */
let ctx = { me: () => null, showApp: () => {} };
export function setSpreeCtx(o){ ctx = { ...ctx, ...o }; }

let 주머니 = [], 지금 = null, 센것 = 0, 도는중 = false;
/* ⚠ **센것과 건드림은 다릅니다(b413).** 센것은 **별을 준 곳**만 셉니다 —
   화면에 보여줄 숫자라 「안 가봤어요」를 스무 번 누른 것을 「20곳 매김」
   이라고 쓸 수는 없습니다. 건드림은 **자료가 바뀌었는가**입니다.
   skip·want 도 city_ratings 에 줄을 남깁니다(아래 누르기 참고).
   나갈 때 이걸로 갈라야 합니다 — 센것으로 가드를 걸었더니 「안 가봤어요」
   만 누르고 나온 사람의 홈이 **옛것 그대로**였습니다. */
let 건드림 = false;

/* ── 물어볼 도시 ─────────────────────────────────────────────────────
 * ⚠ **이미 답한 곳은 서버에 물어서 뺍니다.** 별점이든 ♡ 든 「안 가봤어요」든
 *   줄이 있으면 다시 안 묻습니다(홈의 fillQuiz 와 같은 규칙).
 * ⚠ **이름난 곳부터.** 처음 쭉 매기는 사람에게 생소한 곳을 먼저 주면 넘기다
 *   지칩니다. 유명도 안에서만 섞어 열 때마다 순서가 달라지게 합니다. */
/* ⚠⚠ **못 받은 것과 「다 봤다」는 다릅니다(b716, b698 점검 다섯째).** ⚠⚠
   여태 `if (r.error) return;` 이었습니다. 그러면 주머니가 처음 값 `[]` 인
   채로 남고, 그리기()는 그걸 「물어볼 도시를 다 봤어요」로 읽습니다 —
   **한 곳도 안 매긴 사람에게 다 매겼다고 말합니다.** 도시 목록을 못
   받았을 때도 같습니다. 못 받았으면 못 받았다고 해야 합니다. */
let 못받음 = false;
async function 채우기(){
  못받음 = false;
  await loadCities();
  const r = await sb.from('city_ratings')
    .select('city_id,stars,want').eq('user_id', ctx.me().id);
  if (r.error || !(cities || []).length){ 못받음 = true; 주머니 = []; return; }
  /* ⚠⚠ **«줄이 있다»와 «답했다»는 다릅니다(b755).** ⚠⚠
     여태는 `city_ratings` 에 줄만 있으면 걸러냈습니다. 그러면 별점도 없고
     「가보고 싶어요」도 아닌 줄(`been` 만 켠 줄) 때문에 그 도시가 여기서
     **통째로 빠집니다** — 답한 적이 없는데 답한 것으로 친 셈입니다.
     답한 것은 **별을 줬거나 「가보고 싶어요」를 누른 것**입니다.
     ⚠ b754 의 「사진에서 찾기」가 그런 줄을 만들었고 b756 에 그 기능을
       걷었지만, **이 가름은 그것과 상관없이 맞습니다** — 되돌리지 마십시오. */
  const 답한것 = new Set((r.data || [])
    .filter(x => x.stars != null || x.want).map(x => x.city_id));
  주머니 = (cities || []).filter(c => c.image_url && !답한것.has(c.id));
  주머니.sort((a, b) => (a.fame ?? 9) - (b.fame ?? 9));
  for (let i = 주머니.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    if ((주머니[i].fame ?? 9) === (주머니[j].fame ?? 9))
      [주머니[i], 주머니[j]] = [주머니[j], 주머니[i]];
  }
}

function 그리기(){
  const box = $('spreebox');
  if (!box) return;
  지금 = 주머니[0] || null;
  if (!지금 && 못받음){
    box.innerHTML = `<div class="card"><div class="empty" style="padding:28px 12px">
      지금은 불러오지 못했어요.<br>
      <span class="memo">잠시 뒤 다시 들어와 주세요.</span></div></div>`;
    return;
  }
  if (!지금){
    box.innerHTML = `<div class="card"><div class="empty" style="padding:28px 12px">
      물어볼 도시를 다 봤어요.${센것 ? `<br>
      <span class="memo">${센것}곳을 매기셨어요</span>` : ``}</div></div>`;
    /* ⚠ 0 일 때는 그 줄을 안 씁니다 — 「안 가봤어요」만 누르고 끝낸 사람에게
       「0곳을 매기셨어요」는 잘했다는 말도 아니고 뭘 하라는 말도 아닙니다. */
    return;
  }
  /* 홈·맛보기와 **같은 히어로**입니다(rateui.js). 안 그러면 같은 일을 하는
     화면이 앱 안에서 셋으로 갈립니다. */
  box.innerHTML = rateHero(지금, { id:'spreehero', ask:'다녀오셨다면 별점을 남겨주세요',
    /* ⚠ 이 화면은 이것 하나뿐이라 세로가 통째로 남습니다. 사진을 정방형으로
       키우고 글자·별을 사진 밖으로 뺍니다 — 여기서 사진은 장식이 아니라
       **판단 근거**입니다(rateui.js 의 모양 주석). */
    모양:'square' });
  /* ⚠ **다음 사진을 미리 받아 둡니다(b799, GPT 리포트에서 찾음).** 전에는 별을 누르고
     0.26초(넘기면 0.19초) 뒤 카드를 갈아끼울 때에야 다음 사진을 받기 시작해서, 넘길 때마다
     사진 칸이 비었다 채워졌습니다. 같은 주소로 받아 두면 갈아끼울 때 캐시에서 바로 뜹니다.
     한 장만 — 넘기지 않고 나가면 받은 것이 헛일이 되니까요. */
  const 다음도시 = 주머니[1];
  if (다음도시?.image_url){
    const 미리 = new Image();
    미리.decoding = 'async';
    /* 카드가 실제로 쓸 주소여야 캐시에서 뜹니다 — 카드는 큰 판을 먼저 씁니다(rateui.js). */
    미리.src = 다음도시.image_lg || 다음도시.image_url;
  }
}

/* 몇 곳 매겼는지. **이게 없으면 언제 그만둘지 모릅니다** — 끝이 없는 화면은
   금방 지칩니다. 숫자가 올라가는 것이 그만두게도 하고 더 하게도 합니다. */
function 세기(){
  const el = $('spreecount');
  if (el) el.textContent = 센것 ? `${센것}곳 매김` : '';
}

/* ── 5곳째를 매긴 순간(b822) ──────────────────────────────────────────
 * 「확정」인지는 rating.js 가 압니다(저장은 전부 saveRate 를 지나므로 거기서 저장 전·후를 셉니다).
 * 여기서는 별 저장이 끝날 때마다 물어보고, 그렇다면 「N곳 매김」 자리에 「성향 확정 · 내 여행 성향 보기 ›」를
 * 띄웁니다. ⚠ 새 줄을 끼우지 않습니다 — 카드가 밀리면 다음 별을 잘못 누릅니다(index.html 주석).
 * ⚠ 안 누르고 계속 매겨도 됩니다. 저장만 했다고 다른 탭으로 데려가지 않습니다. */
function 확정줄(){
  if (!도는중 || !방금확정()) return;
  $('spreecount')?.classList.add('hide');
  $('spreepersona')?.classList.remove('hide');
}
/* 눌렀으면 「그만」과 같은 길로 나갑니다(closeSpree — 뒤로가기 기록을 걷어야 합니다). 닫힌 «뒤»에 갈 곳만
   성향 칸입니다(아래 돌아가기). 여기서 바로 탭을 옮기면 showApp 이 closeSpree(true) 로 닫아서 뒤로가기
   기록이 하나 남습니다 — 뒤로를 한 번 더 눌러야 나가는 앱이 됩니다. */
let 성향으로 = false;
$('spreepersona')?.addEventListener('click', () => { 성향으로 = true; closeSpree(); });

/* 다음으로. 별을 매겼든 넘겼든 여기로 옵니다. */
function 다음(){
  주머니 = 주머니.filter(c => c.id !== 지금?.id);
  그리기();
}

export async function openSpree(){
  if (도는중) return;
  도는중 = true;
  $('tabdeck').classList.add('hide');   /* 덱 한 덩어리로(b474) */
  $('spreeview').classList.remove('hide');
  /* ⚠ **탭 바를 진짜로 숨겨야 합니다(b410).** `hastab` 은 본문 아래 **여백**만
     없앱니다 — 탭 바는 `position:fixed` 라 그대로 떠 있고, 여백만 없애면
     내용이 그 밑으로 깔립니다. 재보고 알았습니다(#appbar 가 화면에 남아
     있었습니다). 이 화면은 나가는 길이 「그만」 하나뿐이라 숨겨도 갇히지
     않습니다. 닫을 때 반드시 되돌립니다 — 안 되돌리면 앱을 못 씁니다. */
  $('appbar').classList.add('hide');
  document.body.classList.remove('hastab');    /* 화면에 이것 하나만 둡니다 */
  window.scrollTo({ top:0 });
  if (history.state?.t2 !== 'spree') history.pushState({ t2:'spree' }, '');
  센것 = 0; 건드림 = false; 세기();
  /* 머리줄은 늘 「N곳 매김」으로 엽니다. 지난번에 확정만 하고 안 보러 갔으면 아래 확정줄() 이 다시 띄웁니다. */
  $('spreecount')?.classList.remove('hide');
  $('spreepersona')?.classList.add('hide');
  성향으로 = false;
  $('spreebox').innerHTML =
    `<div class="empty"><span class="load">불러오는 중…</span></div>`;
  await 채우기();
  그리기();
  확정줄();
}

/* ── 나가면 **들어온 자리**로 돌아갑니다(b423) ────────────────────────
 * 홈의 「넘기며 매기기」 줄로 들어와서 「그만」 을 누르면 **기록 탭에 떨어졌습니다.**
 * 홈에서 여는 길이 `ctx.showApp('rate')` 로 기록 탭에 간 뒤 거기 있는 시작
 * 단추를 누르는 방식이라, 닫을 때는 이미 기록 탭이 제자리였기 때문입니다.
 * 들어온 사람 입장에서는 **엉뚱한 화면으로 떨어진** 것입니다.
 *
 * ⚠ **home.js 가 이걸 직접 부르지 않습니다.** 그러면 spree → home
 *   (resetHomeSig) → spree 로 **고리**가 생깁니다. app.js 가 둘 다 알고
 *   있으므로 거기서 home 의 ctx 에 넣어 줍니다(setHomeCtx).
 * ⚠ 한 번 쓰고 **바로 비웁니다.** 남겨두면 다음에 기록 탭에서 연 사람도
 *   홈으로 튕깁니다. */
let 돌아갈곳 = null;
export function spreeBackTo(tab){ 돌아갈곳 = tab; }
function 돌아가기(){
  const t = 돌아갈곳; 돌아갈곳 = null;
  /* 「내 여행 성향 보기 ›」로 나온 것이면 들어온 자리 대신 분석 탭 성향 칸으로(b822). 여는 길은 #openpersona
     하나입니다(평가 탭 안내 줄의 data-go 와 같은 단추) — 칸 고르기·맨 위로까지 거기서 합니다(app.js 성향보기). */
  if (성향으로){ 성향으로 = false; $('openpersona')?.click(); return; }
  if (t) ctx.showApp?.(t);
}

export function closeSpree(fromPop){
  if (!fromPop && history.state?.t2 === 'spree'){ history.back(); return; }
  도는중 = false;
  $('spreeview').classList.add('hide');
  $('tabdeck').classList.remove('hide');
  /* 숨긴 것을 반드시 되돌립니다 — 여기서 빠뜨리면 앱에 탭 바가 영영 없습니다. */
  $('appbar').classList.remove('hide');
  document.body.classList.add('hastab');
  /* 매긴 것이 있으면 홈과 기록을 다시 그리게 합니다 — **지문만 비웁니다.**
     여기서 직접 부르면 안 보이는 화면을 그리느라 나가는 길이 느려집니다. */
  if (건드림) { resetHomeSig(); ctx.afterSpree?.(); }
  /* ⚠ **지문을 비운 뒤에 옮깁니다.** 순서가 반대면 홈으로 가서 옛 화면을
     한 번 보여준 다음 다시 그립니다 — 숫자가 눈앞에서 바뀝니다. */
  돌아가기();
}

$('spreeclose')?.addEventListener('click', () => closeSpree());

/* ── 손가락으로 넘기기 (b643, 사용자 요청 「틴더처럼」) ────────────────
 * 옆으로 밀면 카드가 손가락을 따라가다 날아가고 다음 도시가 옵니다.
 * 뜻은 **「다른 여행지」 단추와 똑같습니다** — `stars:null` 을 남겨
 * 다시 안 묻게 합니다. 두 길이 다른 일을 하면 어느 쪽을 썼는지에 따라
 * 기록이 갈립니다.
 * ⚠ **단추는 그대로 둡니다**(사용자 지시). 스와이프는 «더한» 길입니다 —
 *   미는 것을 모르는 사람에게 화면이 막다른 곳이 되면 안 됩니다.
 *
 * ⚠⚠ **별 위에서 시작한 손짓은 가로채면 안 됩니다.** 별점은 좌우로 끌어
 *   반 칸을 고르는 물건입니다(stars.js). 여기서 카드를 끌면 별을 못 매깁니다.
 *   단추도 같습니다 — 눌러야 할 것을 끌어버리면 안 눌립니다.
 * ⚠⚠ **세로로 시작한 손짓은 화면 스크롤에 넘깁니다.** 처음 몇 px 로
 *   방향을 정하고, 세로면 그 손짓은 통째로 놓아 줍니다. `touch-action:pan-y`
 *   가 그 절반을 하고(세로는 브라우저가 가져감), 나머지 절반이 이 판단입니다.
 * ⚠ 움직이는 것은 `transform` 과 `opacity` 뿐입니다 — 손가락을 따라가는
 *   동안 자리(layout)를 건드리면 폰에서 덜덜거립니다(b567 에서 겪은 것).
 * ⚠ 날아간 뒤 **씻어내는 것을 잊으면** 다음 카드가 화면 밖에서 시작합니다.
 *   `다음()` 으로 안쪽을 갈아끼운 «뒤» 통의 transform 을 지웁니다. */
{
  const 통 = $('spreebox');
  let 잡음 = false, 가로냐 = null, x0 = 0, y0 = 0, dx = 0, 시작id = null;

  /* 애니메이션 없이 즉시 제자리로. 카드를 갈아끼운 뒤에 씁니다. */
  const 씻기 = () => {
    if (!통) return;
    통.style.transition = 'none';
    통.style.transform = ''; 통.style.opacity = '';
    void 통.offsetWidth;                 /* 지운 값을 지금 반영시킵니다 */
    통.style.transition = '';
  };
  /* 덜 밀었을 때 스르르 돌아옵니다. */
  const 되돌리기 = () => {
    if (!통) return;
    통.style.transition = 'transform .22s ease-out, opacity .22s ease-out';
    통.style.transform = ''; 통.style.opacity = '';
  };

  통?.addEventListener('pointerdown', e => {
    /* ⚠⚠ **`도는중` 은 「불러오는 중」이 아니라 「넘기며 매기기가 열려 있다」
       입니다**(96·137줄). 처음에 `if (도는중) return` 으로 막았다가,
       화면이 열려 있는 «동안 내내» 스와이프가 죽었습니다 — 가드가 정확히
       거꾸로였습니다. 화면에서 밀어보고 잡았습니다(transform 이 계속 none).
       ⚠ **이름만 보고 뜻을 짐작하면 안 됩니다.** 「-는 중」이라고 다
         「바쁘다」가 아닙니다. 세우는 곳과 내리는 곳을 보고 쓸 것. */
    if (!지금) return;
    if (e.target.closest('.stars, button, a, select, input')) return;
    잡음 = true; 가로냐 = null; dx = 0;
    x0 = e.clientX; y0 = e.clientY; 시작id = 지금.id;
  });

  통?.addEventListener('pointermove', e => {
    if (!잡음) return;
    const ax = e.clientX - x0, ay = e.clientY - y0;
    if (가로냐 === null){
      if (Math.abs(ax) < 8 && Math.abs(ay) < 8) return;   /* 아직 방향을 모릅니다 */
      가로냐 = Math.abs(ax) > Math.abs(ay);
      if (!가로냐){ 잡음 = false; return; }                /* 세로 — 스크롤에 넘깁니다 */
      통.style.transition = 'none';
      /* ⚠⚠ **`setPointerCapture` 는 던질 수 있습니다.** 그 손가락이 이미
         놓였거나 다른 요소가 잡고 있으면 `NotFoundError` 가 납니다.
         그러면 **이 아래가 통째로 안 돌아** 카드가 손가락을 안 따라옵니다
         — 오류도 화면에 안 뜨고 그냥 «안 되는» 상태가 됩니다.
         잡는 것은 «있으면 좋은 것»이지 없으면 못 하는 일이 아닙니다
         (손가락이 카드 밖으로 나가도 따라오게 해줄 뿐입니다).
         ⚠ 옵셔널 체이닝(`?.`)은 **없을 때만** 막아줍니다. 던지는 것은
           못 막습니다 — try 로 감싸야 합니다. */
      try { 통.setPointerCapture?.(e.pointerId); } catch {}
    }
    dx = ax;
    통.style.transform = `translateX(${dx}px) rotate(${dx / 26}deg)`;
    통.style.opacity = String(Math.max(.4, 1 - Math.abs(dx) / 560));
  });

  const 끝내기 = () => {
    if (!잡음) return;
    잡음 = false;
    /* 화면 폭의 4분의 1이나 110px 중 작은 쪽. 좁은 폰에서 너무 멀면
       한 손으로 못 밉니다. */
    const 넘길까 = Math.abs(dx) > Math.min(110, window.innerWidth * .25);
    if (!넘길까 || !지금 || 지금.id !== 시작id){ 되돌리기(); return; }
    const 끝점 = dx > 0 ? window.innerWidth : -window.innerWidth;
    통.style.transition = 'transform .2s ease-out, opacity .2s ease-out';
    통.style.transform = `translateX(${끝점}px) rotate(${끝점 / 26}deg)`;
    통.style.opacity = '0';
    /* 「다른 여행지」와 **같은 뜻**입니다 — 기다리지 않습니다(위 누르기 주석). */
    saveRate(시작id, { stars: null }, true);
    건드림 = true;
    setTimeout(() => { 다음(); 씻기(); }, 190);
  };
  통?.addEventListener('pointerup', 끝내기);
  통?.addEventListener('pointercancel', () => { 잡음 = false; 되돌리기(); });
}

/* ── 누르기 ──────────────────────────────────────────────────────────
 * 상자 하나에만 답니다. 안쪽은 매번 갈아끼웁니다. */
$('spreebox')?.addEventListener('click', async e => {
  const st = e.target.closest('.st');
  if (st){
    const wrap = st.closest('.stars');
    const v = starValue(st, e.clientX);
    paintStars(wrap, v, true);
    센것++; 건드림 = true; 세기();
    /* ⚠ **기다렸다 넘기지 않습니다.** 홈은 1.5초를 두고 되돌릴 틈을 줍니다만,
       여기는 **쭉 매기는 것이 목적**이라 그 1.5초가 다섯 번이면 7초입니다.
       잘못 눌렀으면 기록 탭에서 고칠 수 있습니다. */
    /* 안 기다립니다 — 끝나면 5곳째였는지만 봅니다(위 확정줄, b822). */
    saveRate(wrap.dataset.city, { stars: v }, true).then(확정줄);
    setTimeout(다음, 260);
    return;
  }
  const b = e.target.closest('[data-rate]');
  if (!b || !지금) return;
  /* 「안 가봤어요」는 **별점 없는 줄**을 남깁니다 — 다시 안 묻기 위한 것입니다.
     홈과 같은 규칙입니다(home.js 의 herobar 주석). */
  saveRate(지금.id, b.dataset.rate === 'want' ? { want: true } : { stars: null }, true);
  건드림 = true;
  다음();
});
