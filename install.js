/* ── 홈 화면에 추가 안내(b844) ──────────────────────────────────────────
 * 사용자: 「제일 처음에 사이트에 온 사람을 위해 홈화면에 추가하는 방법도 안내해주는 가이드도 만들어야해」
 *        → 「링크 공유를 통해서는 애플인지 안드로이드인지 알 수가 없으니 둘다 같이 안내해야하지 않을까?」
 *        → 시안을 보고: 「일단 로그인부터 하고 뜨는게 어때? 로그인 전에 저거부터 뜨니까 거부감드는데?
 *          3번 4번으로 살리는걸로」
 * ⚠⚠ **판은 저절로 안 뜹니다 — 누를 때만 엽니다(10-12 사용자 결정).** ⚠⚠ 남은 입구는 둘:
 *   ③ 로그인 전 첫 화면의 한 줄(#a2link) · ④ 로그인 뒤 기록 탭 칩(home.js, 브라우저로 쓰는 폰만).
 *   처음 온 사람에게 판을 한 번 저절로 띄우는 시안은 «거부감»으로 반려 — 다시 넣자고 하지 말 것.
 *
 * ⚠ **아이폰·안드로이드 둘 다 늘 보여줍니다.** 링크를 «연» 폰은 이름표(UA)로 알아볼 수 있어서
 *   그쪽을 위에 두고 「지금 이 폰」을 붙이지만, 틀릴 수 있습니다(아이패드는 맥으로 보이고 — 터치로 한 번
 *   더 가림 —, 안드로이드에서 「PC 버전」을 켜면 컴퓨터로 보임). 틀려도 아래에 다른 쪽이 있습니다.
 * ⚠ **아이폰은 로그인 «전»에 담는 게 낫습니다.** 홈 화면 앱은 Safari 와 저장소가 따로라(WebKit 버그 181849 —
 *   «일부러 그렇게 만든 것»), Safari 에서 로그인하고 담으면 앱에서 한 번 더 로그인해야 합니다.
 *   그래서 첫 화면 한 줄에 「아이폰은 로그인 전에 추가하세요」를 적고, 로그인 뒤(칩)에는 판의 아이폰 안내가
 *   「한 번 더 로그인」으로 바뀝니다. 안드로이드·컴퓨터는 브라우저와 같이 씁니다.
 * ⚠ iOS 26 부터 Safari 모양(간결/하단/상단)에 따라 공유 단추가 주소창 옆 「⋯」 안에 숨기도 합니다 —
 *   그래서 1단계에 「안 보이면 ⋯ 안에」를 같이 적습니다(MacRumors·애플 안내, 10-12 찾아봄).
 * ⚠ 안 띄우는 곳: 이미 홈 화면 앱으로 연 사람(standalone) · 카톡 같은 앱 안 브라우저(설치가 안 되고,
 *   index.html 첫 스크립트가 바깥으로 넘기는 중 — 그 판별을 `window.__앱안` 으로 받아 씁니다. 여기서 따로
 *   적으면 둘이 갈립니다).
 * ⚠ 안드로이드 크롬·엣지·삼성 인터넷처럼 설치 창을 띄울 수 있는 곳은 「앱 설치」 단추 하나로 끝납니다.
 *   그 창(beforeinstallprompt)은 모듈보다 먼저 올 수 있어 index.html 머리에서 `window.__설치창` 으로 붙잡아 둡니다. */
import { $ } from './dom.js?v=b852';

/* 링크를 연 기기. 앱 안 브라우저는 따로(위 ⚠). */
export function 기기알기(ua = navigator.userAgent || '', 터치 = navigator.maxTouchPoints || 0){
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 터치 > 1);
  const android = !ios && /Android/i.test(ua);
  const 폰 = ios ? 'ios' : android ? 'android' : 'pc';
  const 브라우저 = /SamsungBrowser/i.test(ua) ? 'samsung'
    : ios ? (/CriOS|FxiOS|EdgiOS|OPiOS|Whale/.test(ua) ? 'other' : 'safari')
    : /Edg\//.test(ua) ? 'edge' : /Chrome\//.test(ua) ? 'chrome' : 'other';
  return { 폰, 브라우저 };
}

const 설치됨 = () => !!navigator.standalone ||
  matchMedia('(display-mode: standalone)').matches;
/* 안내할 만한 곳인가 — 홈 화면 앱도 앱 안 브라우저도 아님. */
export const 안내할까 = () => !설치됨() && !window.__앱안;

/* 그림 — 화면에서 실제로 찾을 단추 모양 그대로(공유 □↑ · ⋯ · ⋮ · ≡ · 더하기 네모). */
const 그림 = {
  공유: '<path d="M12 3.5v11"/><path d="M8 7.3 12 3.5l4 3.8"/><path d="M7 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1"/>',
  가로점: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  세로점: '<circle cx="12" cy="5.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/>',
  줄셋: '<path d="M5 7h14M5 12h14M5 17h14"/>',
  더하기: '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  폰: '<rect x="7" y="2.8" width="10" height="18.4" rx="2.2"/><path d="M11 18h2"/><path d="M12 8v5M9.5 10.5h5"/>',
};
const 아이콘 = (이름, 채움) => `<span class="a2k" aria-hidden="true"><svg viewBox="0 0 24 24" ${채움
  ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'}>${그림[이름]}</svg></span>`;
export const 폰그림 = 아이콘('폰');

const 단계 = (줄들) => `<ol class="a2steps">${줄들.map(([글, 밑]) =>
  `<li><span>${글}</span>${밑 ? `<small>${밑}</small>` : ''}</li>`).join('')}</ol>`;

function 아이폰칸(지금, 로그인됨){
  return `<section class="a2sec${지금 ? ' now' : ''}">
    <h3>아이폰${지금 ? '<em>지금 이 폰</em>' : ''}</h3>
    ${단계([
      [`${아이콘('공유')} 공유 버튼을 눌러요`, `안 보이면 주소창 옆 ${아이콘('가로점', 1)} 를 누르고 「공유」`],
      [`${아이콘('더하기')} 「홈 화면에 추가」를 눌러요`, '안 보이면 목록을 아래로 내려 보세요'],
      ['오른쪽 위 「추가」를 눌러요'],
    ])}
    <p class="a2note">${로그인됨
      ? '홈 화면 앱은 Safari와 로그인이 따로라, 추가한 앱에서 <b>한 번 더 로그인</b>해야 해요.'
      : '홈 화면 앱은 Safari와 로그인이 따로예요. <b>먼저 추가하고</b>, 추가한 앱에서 로그인해 주세요.'}</p>
    <p class="a2memo">크롬 같은 다른 앱에서도 공유 버튼으로 똑같이 돼요.</p>
  </section>`;
}

function 안드로이드칸(지금, 브라우저, 설치창){
  const 크롬 = [[`오른쪽 위 ${아이콘('세로점', 1)} 를 눌러요`],
               ['「홈 화면에 추가」 또는 「앱 설치」를 눌러요'], ['「설치」를 눌러요']];
  const 삼성 = [[`아래 ${아이콘('줄셋')} 를 눌러요`],
               ['「현재 페이지 추가」 → 「홈 화면」'], ['「추가」를 눌러요']];
  const 삼성이면 = 지금 && 브라우저 === 'samsung';
  return `<section class="a2sec${지금 ? ' now' : ''}">
    <h3>안드로이드 <span class="a2sub">갤럭시 등</span>${지금 ? '<em>지금 이 폰</em>' : ''}</h3>
    ${지금 && 설치창 ? `<button type="button" class="primary a2go" data-a2install="1">앱 설치</button>
      <p class="a2memo">누르면 바로 설치돼요. 안 되면 아래처럼 해 주세요.</p>` : ''}
    ${단계(삼성이면 ? 삼성 : 크롬)}
    <p class="a2memo">${삼성이면
      ? `크롬은 오른쪽 위 ${아이콘('세로점', 1)} → 「홈 화면에 추가」`
      : `삼성 인터넷은 아래 ${아이콘('줄셋')} → 「현재 페이지 추가」 → 「홈 화면」`}</p>
  </section>`;
}

function 컴퓨터칸(설치창){
  return `<section class="a2sec now">
    <h3>컴퓨터<em>지금 이 기기</em></h3>
    ${설치창 ? `<button type="button" class="primary a2go" data-a2install="1">앱 설치</button>` : ''}
    <p class="a2memo">크롬·엣지는 주소창 오른쪽의 설치 아이콘을 눌러도 돼요. 폰에서 이 주소를 열면 폰에 맞는 순서가 위에 나와요.</p>
  </section>`;
}

/* 판 그리기. `기기` 는 시험용으로 바꿔 넣을 수 있습니다(시안·자가검사). */
function 그리기(기기 = 기기알기()){
  /* ⚠ `!x?.classList…` 꼴은 쓰지 않습니다 — 없으면 「보인다」가 됩니다(b647 덫, tools/optneg.pl). */
  const 안 = $('signedin');
  const 로그인됨 = !!안 && !안.classList.contains('hide');
  const 창 = !!window.__설치창;
  const 칸들 = 기기.폰 === 'android'
    ? [안드로이드칸(true, 기기.브라우저, 창), 아이폰칸(false, 로그인됨)]
    : 기기.폰 === 'ios'
      ? [아이폰칸(true, 로그인됨), 안드로이드칸(false, 기기.브라우저, 창)]
      : [컴퓨터칸(창), 아이폰칸(false, 로그인됨), 안드로이드칸(false, 기기.브라우저, 창)];
  $('a2body').innerHTML =
    `<p class="a2lead">한 번 누르면 바로 열리고, 여행 중 알림도 받을 수 있어요.</p>${칸들.join('')}
     <div class="a2foot"><button type="button" class="primary" data-a2close="1">알겠어요</button></div>`;
}

let 시험기기 = null;
const 열림 = () => { const 판 = $('a2hs'); return !!판 && !판.classList.contains('hide'); };

export function 설치안내열기(기기){
  시험기기 = 기기 || null;
  그리기(기기 || undefined);
  $('a2hs').classList.remove('hide');
  if (history.state?.t2 !== 'a2hs') history.pushState({ t2: 'a2hs' }, '');
}
export function 설치안내닫기(뒤로온것){
  if (!열림()) return;
  if (!뒤로온것 && history.state?.t2 === 'a2hs'){ history.back(); return; }
  $('a2hs').classList.add('hide');
}

/* 로그인 전 첫 화면이 보인 순간(app.js). 한 줄 단추만 켭니다 — 판은 눌러야 열립니다(위 ⚠⚠, 사용자 결정).
   앱 안 브라우저(인스타 등)에서는 그 자리에 「다른 브라우저에서 열기 · 링크 복사」를 켭니다(b847, 아래). */
export function 설치안내첫화면(){
  $('a2link')?.classList.toggle('hide', !안내할까());
  $('a2copy')?.classList.toggle('hide', 설치됨() || !window.__앱안);
}

/* ── 다른 브라우저에서 열기 · 링크 복사(b847) ────────────────────────────────
 * 사용자: 「링크 복사할 수 있는 기능 하나만 넣어주면 되는거아냐? 인스타에서 해도 되고 다른 브라우저에서 해도되고」.
 * 앱 안 브라우저(카톡·인스타·페북·네이버…)에서도 로그인이 되므로(사용자가 해 봄 — b846·b847 인스타, b848 전부)
 * «막는 판»과 저절로 넘기기를 걷고 고를 수 있게 둡니다 — 그대로 써도 되고, 복사해서 사파리·크롬에 붙여 넣어도
 * 됩니다(홈 화면에 추가는 거기서만 됩니다).
 * ⚠ 복사하는 주소는 `window.__첫주소`(index.html 첫 스크립트) — app.js 가 ?join= 같은 꼬리를 곧바로 지우므로
 *   지금 주소(location.href)를 쓰면 초대 코드가 빠집니다.
 * ⚠ 클립보드는 앱 안 브라우저에서 막힐 수 있어 둘째 길(숨은 글칸 + execCommand)을 두고, 그것도 안 되면 주소를 보여줍니다. */
let 복사타이머 = 0;
async function 링크복사(){
  const 주소 = window.__첫주소 || location.href;
  let 됨 = false;
  try { await navigator.clipboard.writeText(주소); 됨 = true; } catch {}
  if (!됨){
    try {
      const t = document.createElement('textarea');
      t.value = 주소; t.setAttribute('readonly', '');
      t.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(t); t.select(); t.setSelectionRange(0, 주소.length);
      됨 = document.execCommand('copy');
      t.remove();
    } catch {}
  }
  const 글 = $('a2copygo');
  if (!글) return;
  if (!됨){ window.prompt('이 주소를 길게 눌러 복사하세요', 주소); return; }
  글.textContent = '복사했어요';
  clearTimeout(복사타이머);
  복사타이머 = setTimeout(() => { 글.textContent = '링크 복사'; }, 2500);
}

$('a2link')?.addEventListener('click', () => 설치안내열기());
$('a2copy')?.addEventListener('click', 링크복사);
$('a2hs')?.addEventListener('click', async e => {
  if (e.target.closest('[data-a2close]')) return 설치안내닫기();
  if (!e.target.closest('[data-a2install]')) return;
  const 창 = window.__설치창;
  if (!창) return 그리기(시험기기 || undefined);
  창.prompt();
  /* 한 번 쓴 창은 다시 못 씁니다 — 비우고 다시 그려 단추를 걷습니다(설치하면 아래 appinstalled 가 닫음). */
  try { await 창.userChoice; } catch {}
  window.__설치창 = null;
  if (열림()) 그리기(시험기기 || undefined);
});
/* 설치 창이 판을 연 «뒤»에 오면 단추를 넣으러 다시 그립니다. */
window.addEventListener('설치창옴', () => { if (열림()) 그리기(시험기기 || undefined); });
window.addEventListener('appinstalled', () => {
  $('a2link')?.classList.add('hide');
  document.querySelector('.gchips > [data-chip="install"]')?.remove();
  if (열림()) 설치안내닫기();
});
window.addEventListener('popstate', () => { if (열림()) 설치안내닫기(true); });

/* ── 자가검사 — 콘솔에서 __installCheck(). 이름표(UA)로 기기를 맞게 가르는지 봅니다. ── */
if (typeof window !== 'undefined') window.__installCheck = () => {
  const 경우 = [
    ['아이폰 사파리', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1', 5, 'ios', 'safari'],
    ['아이폰 크롬', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/139.0.0.0 Mobile/15E148 Safari/604.1', 5, 'ios', 'other'],
    ['아이패드(컴퓨터 모드)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15', 5, 'ios', 'safari'],
    ['맥 사파리', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15', 0, 'pc', 'other'],
    ['갤럭시 크롬', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36', 5, 'android', 'chrome'],
    ['갤럭시 삼성 인터넷', 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36', 5, 'android', 'samsung'],
    ['윈도우 크롬', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', 0, 'pc', 'chrome'],
    ['윈도우 엣지', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', 0, 'pc', 'edge'],
  ];
  return 경우.map(([이름, ua, 터치, 폰, 브라우저]) => {
    const r = 기기알기(ua, 터치);
    return { 항목: 이름, 결과: r.폰 === 폰 && r.브라우저 === 브라우저 ? '✓' : `✗ ${r.폰}/${r.브라우저}` };
  });
};
