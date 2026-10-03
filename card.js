/* ── 성향 카드 그리기 ────────────────────────────────────────────────
 * 여행 성향과 리포트를 카드로 그리고, 원하면 그림 파일로 만들어 줍니다.
 * 여기 있는 것은 전부 **그리는 일**입니다 — 무엇을 그릴지는 부르는 쪽이
 * 정해서 넘깁니다. 그래서 여행 자료도 로그인한 사람도 모릅니다.
 *
 * 화면 쪽(openPersona · closePersona)은 app.js 에 남겼습니다.
 * 그쪽은 me · loadCities · showApp 을 쓰기 때문입니다 — 여기 끌고 오면
 * 이 파일도 앱 전체를 알아야 합니다.
 *
 * 층: dom.js 만 씁니다. */
import { $, esc, toast, josa, flagSprite, flagSvgOf } from './dom.js?v=b828';
/* 모험력이 서울에서의 거리를 씁니다. calc.js 는 아무것도 import 하지 않는
   잎이라 고리가 안 생깁니다. */
import { distKm, distN, fameN, SEOUL } from './calc.js?v=b828';

/* ── 성향 카드 ───────────────────────────────────────────────────────
 * "나는 뭐로 나올까"가 궁금해서 평가를 더 하게 만드는 것이 목적입니다.
 * MBTI 가 도는 이유와 같습니다.
 *
 * **AI 를 안 씁니다.** 같은 사람은 항상 같은 결과가 나와야 하기 때문입니다.
 * AI 에 맡기면 매번 달라지고, 매번 바뀌는 MBTI 는 아무도 안 합니다.
 * AI 호출이 0회이므로 한도도 안 닳습니다.
 *
 * 문구는 **위에서부터 검사하고 처음 걸리는 것**을 씁니다. 순서가 곧 우선순위입니다.
 * 그래서 "이제 막 시작한 여행자"가 맨 위에 있습니다 — 3곳 매긴 사람에게
 * "웬만해선 만족 안 하는 사람"이라고 하면 근거가 없습니다.
 */

/* 유형군마다 배경이 다릅니다. 색만으로도 카드가 살아납니다 —
   캐릭터 그림을 스무 장 뽑으면 화풍이 제각각이 되는데 색은 안 그렇습니다.
 *
 * 색을 두 벌로 적어두면(화면용 CSS 와 이미지용 캔버스) 한쪽만 고치는 사고가 납니다.
 * 여기 한 번만 적고 양쪽에서 꺼내 씁니다. */
/* ⚠ **채도를 전부 낮췄습니다(b317).** 전에는 아홉 색이 다 선명했습니다
   (금색 #d4af37 · 하늘색 #5aa9e6). 선명한 색은 활기차지만 감성적이지
   않습니다 — 광고 배너의 색입니다. 바랜 색으로 바꾸면 그것만으로 톤이
   달라집니다. 어두운 바탕 위에 옅게 번지는 자리라 더 그렇습니다. */
const GRAD = {
  start: ['#6f7378', '#54585d'],      /* 시작 단계 — 바랜 회색 */
  rare:  ['#3b3f6b', '#4a3f66'],      /* 특이한 유형 — 먹빛 남보라 */
  deep:  ['#2f5548', '#37604f'],      /* 파고드는 유형 — 이끼 */
  taste: ['#9a5a35', '#b06f42'],      /* 별점 성향 — 흙빛 주황 */
  size:  ['#8a7440', '#a08a52'],      /* 규모 — 바랜 금 */
  plan:  ['#3d5f7d', '#4d7392'],      /* 계획 성향 — 바랜 남색 */
  spend: ['#8f5145', '#a36455'],      /* 리포트 · 지출 — 마른 벽돌 */
  speed: ['#2f5a60', '#3c6d74'],      /* 리포트 · 속도 — 바랜 청록 */
  even:  ['#4a5058', '#5b626b'],      /* 리포트 · 기본 — 무채색 */
};
const cssGrad = g => `linear-gradient(160deg,${(GRAD[g] || GRAD.even).join(',')})`;
export const PERSONA_BG = Object.fromEntries(Object.keys(GRAD).map(k => [k, cssGrad(k)]));

/* 아이콘은 선 하나로 통일합니다. 굵기 2px 고정, 둥근 끝, 흰색 단색.
   작아져도 안 뭉개지고 유형이 스무 개로 늘어도 화풍이 안 흔들립니다. */
export const PERSONA_ICON = {
  foot1:  '<circle cx="12" cy="15" r="3.2"/><path d="M12 11.8V6.5"/>',
  foot3:  '<circle cx="6" cy="17" r="2.4"/><circle cx="12" cy="12" r="2.4"/>' +
          '<circle cx="18" cy="7" r="2.4"/>',
  compass:'<circle cx="12" cy="12" r="8.5"/><path d="M15.2 8.8 13.6 13.6 8.8 15.2 10.4 10.4z"/>',
  globe:  '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/>' +
          '<path d="M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17z"/>',
  route:  '<path d="M3 18c4-7 8-9 18-12"/><path d="M14.5 4.5 21 6l-1.5 6.5"/>' +
          '<circle cx="4" cy="18.5" r="1.6"/>',
  stamp:  '<rect x="4" y="6" width="16" height="12" rx="2"/>' +
          '<circle cx="12" cy="12" r="3.2"/><path d="M7 3.5v2M12 3.5v2M17 3.5v2"/>',
  pinheart:'<path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 15 12 21 12 21z"/>' +
          '<path d="M12 13.2s-2.4-2-2.4-3.5a1.6 1.6 0 0 1 2.4-1.2 1.6 1.6 0 0 1 2.4 1.2c0 1.5-2.4 3.5-2.4 3.5z"/>',
  flag:   '<path d="M6 21V4"/><path d="M6 5h11l-2.2 3.6L17 12H6"/>',
  lens:   '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8 21 21"/>',
  starsmile:'<path d="M12 3.5 14.4 9l6 .6-4.5 4 1.3 5.9L12 16.4 6.8 19.5 8.1 13.6 3.6 9.6l6-.6z"/>' +
          '<path d="M10.2 10.6h.01M13.8 10.6h.01"/><path d="M10.2 13a2.4 2.4 0 0 0 3.6 0"/>',
  starhalf:'<path d="M12 3.5 14.4 9l6 .6-4.5 4 1.3 5.9L12 16.4 6.8 19.5 8.1 13.6 3.6 9.6l6-.6z"/>' +
          '<path d="M12 3.5v12.9"/>',
  starsplit:'<path d="M10.6 3.9 8.4 9l-5.6.6 4.2 4-1.2 5.5L10.6 16"/>' +
          '<path d="M13.4 3.9 15.6 9l5.6.6-4.2 4 1.2 5.5L13.4 16"/>',
  crown:  '<circle cx="12" cy="14.5" r="6"/><path d="M3.5 7.5 7 10l5-5 5 5 3.5-2.5-1.5 6h-14z"/>',
  passport:'<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/>' +
          '<path d="M9 15.5h6"/>',
  bag:    '<rect x="4" y="7.5" width="16" height="12.5" rx="2"/>' +
          '<path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2"/>' +
          '<path d="M9 11v5M15 11v5"/>',
  shoot:  '<path d="M4 20 11 13"/><path d="M15.5 3.5 17 7.5l4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z"/>',
  bolt:   '<path d="M13 3 6 13.5h5L11 21l7-10.5h-5z"/>',
};

/* 여행 리포트 카드도 같은 부품과 같은 색표를 씁니다 —
   둘이 한 벌로 보여야 나란히 올렸을 때 같은 앱에서 나온 것으로 읽힙니다. */
export const REPORT_BG = PERSONA_BG;
export const REPORT_ICON = {
  fork:   '<path d="M7 3v7a2.5 2.5 0 0 0 5 0V3"/><path d="M9.5 10v11"/>' +
          '<path d="M17.5 3c-1.4 1.6-2 3.4-2 5.5 0 1.6.7 2.5 2 2.5V21"/>',
  bag2:   '<path d="M4.5 8h15l-1.2 12.5H5.7z"/>' +
          '<path d="M8.8 8V6.2a3.2 3.2 0 0 1 6.4 0V8"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/>' +
          '<path d="M3 10h18"/><circle cx="16.5" cy="14" r="1.4"/>',
  coin:   '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2v9.6"/>' +
          '<path d="M14.6 9.4a2.6 2.6 0 0 0-5.2.4c0 2.6 5.2 1.4 5.2 4a2.6 2.6 0 0 1-5.2.4"/>',
  run:    '<circle cx="15.5" cy="4.8" r="1.9"/>' +
          '<path d="M13.6 9.2 10 11.4l1.8 3.2L9 21"/>' +
          '<path d="M13.6 9.2 17 11l2.6-.6"/><path d="M11.8 14.6 16 16l1 5"/>' +
          '<path d="M10 11.4 5.4 10"/>',
  shoe:   '<path d="M3 16.5h13.5c2.5 0 4.5-1 4.5-2.6 0-1.4-1.3-2-3.2-2.6-2-.6-3.3-1.3-4.3-2.6L11.6 7 3 10.5z"/>' +
          '<path d="M3 16.5V19h18v-2.5"/>',
  cup:    '<path d="M4.5 7h12v6.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/>' +
          '<path d="M16.5 9h1.7a2.4 2.4 0 0 1 0 4.8h-1.7"/><path d="M3 21.5h15"/>',
  moon:   '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2.5"/>' +
          '<circle cx="12" cy="13.5" r="3.6"/><path d="M8.5 7l1.4-2.5h4.2L15.5 7"/>',
};

/* ── 카드를 이미지로 ─────────────────────────────────────────────────
 * 밖에서 라이브러리를 받아오지 않고 캔버스에 직접 그립니다 —
 * 비행기모드에서도 되고, 남의 서버가 멈춰도 안 멈춥니다.
 *
 * **한글 폰트 함정.** 캔버스는 웹폰트가 다 내려오기 전에 그리면 글자를 네모로 찍습니다.
 * 화면에는 멀쩡히 보이는데 저장한 파일만 깨져서 알아채기도 어렵습니다.
 * 그래서 쓸 굵기·크기를 하나씩 load() 로 부르고 fonts.ready 까지 기다립니다.
 * 그래도 안 오면 기기 기본 글꼴로 그립니다 — 네모보다는 낫습니다. */
/* 앞에 적은 것이 기본이고 고르는 목록에서도 먼저 나옵니다.
   **세로(4:5)를 앞에 둡니다** — 인스타 피드에서 세로가 정사각보다 화면을
   훨씬 많이 먹습니다. 같은 카드라도 눈에 들어오는 크기가 다릅니다. */
const IMG_SIZES = {
  portrait: { w:1080, h:1350, ko:'세로 (1080×1350)' },   /* 인스타 피드 — 기본 */
  square:   { w:1080, h:1080, ko:'정사각 (1080×1080)' },
  story:    { w:1080, h:1920, ko:'스토리 (1080×1920)' }, /* 인스타·카톡 스토리 */
};

/* ── 명조체 ──────────────────────────────────────────────────────────
 * 카드 글자가 전부 고딕(Pretendard) 하나였습니다. 한국 디자인에서 감성은
 * 대체로 **명조**에서 옵니다 — 고딕 숫자 옆에 명조 문장이 있으면 그 대비
 * 자체가 분위기를 만듭니다. 전부 바꾸지 않고 **한줄평과 맺음말만** 씁니다.
 *
 * ⚠ **index.html 에 안 넣습니다.** 카드는 가끔 만드는 것이라, 앱을 여는
 *   모든 사람이 이 글꼴을 받을 이유가 없습니다. 카드를 만들 때 그 자리에서
 *   붙입니다. 서비스워커가 fonts.gstatic 을 셸에 담으므로 두 번째부터는
 *   받아올 것이 없습니다(sw.js 의 isCodeUrl). */
const SERIF = '"Nanum Myeongjo", serif';
let serifCss = null;
function addSerifCss(){
  /* ⚠ **CSS 가 붙기를 기다려야 합니다.** 처음엔 link 만 꽂고 바로
     `fonts.load('… Nanum Myeongjo')` 를 불렀는데, 그때는 아직 @font-face 가
     등록되기 전이라 아무것도 안 받아오고 조용히 지나갔습니다 —
     재보니 `fonts.check` 가 false 였고 카드가 기기 기본 명조로 나왔습니다.
     2.5초는 안 오는 날의 상한입니다. 못 와도 카드는 나옵니다. */
  if (serifCss) return serifCss;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&display=swap';
  serifCss = new Promise(res => {
    l.onload = res; l.onerror = res; setTimeout(res, 2500);
  });
  document.head.appendChild(l);
  return serifCss;
}

let fontReady = null;
async function ensureFont(){
  if (fontReady) return fontReady;
  const serifWait = addSerifCss();
  fontReady = (async () => {
    if (!document.fonts) return false;
    await serifWait;                 /* @font-face 가 등록된 뒤에 불러야 받아옵니다 */
    /* 쓸 조합을 다 불러둡니다. 하나라도 빠지면 그 크기만 네모가 됩니다. */
    /* **여기 빠진 조합은 저장한 그림에서만 네모가 됩니다.** 화면은 멀쩡해서
       알아채기 어렵습니다. 위 cardImage 의 F(굵기, 크기) 를 바꾸면 여기도
       같이 바꿔야 합니다 — 사진 배경으로 다시 그리면서 크기가 다 바뀌었습니다. */
    /* ⚠ **굵기가 중요하고 크기는 아닙니다.** `fonts.load` 는 굵기로 맞는
       얼굴을 고르므로, 새 굵기를 쓰기 시작하면 여기에도 더해야 합니다.
       800 은 성향 카드의 큰 글자가 씁니다 — 없으면 그 글자만 네모가 되는데
       **화면은 멀쩡해서** 알아채기 어렵습니다. */
    const want = [[800,112],[700,168],[700,76],[700,34],[600,48],[600,30],[600,28],
                  [500,40],[500,28],[400,40],[400,32]];
    try {
      await Promise.all(want.map(([w, px]) =>
        document.fonts.load(`${w} ${px}px Pretendard`, '가나다 ABC 123 ★')));
      /* 명조와 워드마크 글꼴도 같이. **못 와도 카드는 나옵니다** —
         명조가 없으면 기기 기본 명조로, Dongle 이 없으면 고딕으로 그려집니다.
         글꼴 하나 때문에 카드 전체를 못 만드는 일은 없어야 합니다. */
      await Promise.all([
        document.fonts.load('400 52px "Nanum Myeongjo"', '가나다'),
        document.fonts.load('400 26px "Nanum Myeongjo"', '가나다'),
        document.fonts.load('700 40px Dongle', '기로'),
      ].map(p => p.catch(() => null)));
      await document.fonts.ready;
      return document.fonts.check('700 76px Pretendard', '가나다');
    } catch { return false; }
  })();
  return fontReady;
}

/* SVG 를 그림으로 만들어 캔버스에 얹습니다. 화면에 쓰는 것과 **같은 좌표**를
   그대로 쓰므로 두 벌로 관리하지 않습니다.
   **못 그려도 null 을 줍니다** — 그림 하나 때문에 카드 전체가 안 나오면 안 됩니다. */
function svgImage(svg){
  return new Promise(ok => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/* 배경 사진. **`crossOrigin` 이 없으면 캔버스가 오염돼서 `toBlob` 이 통째로
   실패합니다** — 그림이 안 나오는 게 아니라 카드 자체를 못 만듭니다.
   저장통이 CORS 를 주는지 먼저 재보고 넣었습니다(528×350 사진으로 83KB 성공).
   못 받아오면 null 을 주고 부르는 쪽이 그러데이션으로 돌아갑니다. */
function photoImage(url){
  return new Promise(ok => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => ok(img);
    img.onerror = () => ok(null);
    img.src = url;
  });
}

/* 선 아이콘. 굵기 2px 고정, 흰색 단색 — 위 PERSONA_ICON 과 같은 규칙입니다. */
function iconImage(paths, px){
  return svgImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${px}"
    height="${px}" fill="none" stroke="#fff" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`);
}

/* ── 카드에서 찾아오는 길 ────────────────────────────────────────────
 * **앱 이름만 적으면 못 찾아옵니다.** 이 앱은 앱스토어에 없는 PWA 라
 * '기로' 을 검색해도 아무 데서도 안 나옵니다. 인스타에 올라간 카드를 보고
 * "이거 뭐야" 하는 사람에게 줄 것이 그림 안에 있어야 합니다.
 * 주소는 **여기 한 곳에서만** 만듭니다 — 나중에 도메인이 생기면 이 줄만 바꿉니다.
 * 화면에는 `https://` 와 끝 슬래시를 뺀 것을 적습니다(짧을수록 읽힙니다). */
export const appUrl = () =>
  typeof location === 'undefined' ? '' : location.origin + location.pathname;
export const appUrlText = () =>
  appUrl().replace(/^https?:\/\//, '').replace(/\/$/, '');

/* 긴 문구를 폭에 맞춰 접습니다. 한국어는 단어 사이를 띄우지 않는 경우가 많아
   띄어쓰기로만 접으면 한 줄이 넘칩니다. 넘치면 글자 단위로 한 번 더 접습니다. */
/* ── 넘치면 끝을 줄입니다 ────────────────────────────────────────────
 * 상자 한 칸에 이름을 세로로 쌓는데, 긴 이름(「로스앤젤레스」·「울란바토르」)
 * 은 칸을 넘습니다. **캔버스는 잘라주지 않습니다** — 그냥 삐져나가 그려집니다.
 *
 * ⚠ **글자 크기를 줄이지 않습니다.** 카드 안에서 같은 자리 글자가 줄마다
 *   다른 크기면 조판이 무너집니다. 끝을 `…` 로 줄이는 쪽이 낫습니다.
 * ⚠ b399 에는 `맞춰자르기`(개수를 줄이는 것)가 있었습니다. 그때는 넷을
 *   **한 줄**에 이어 붙였기 때문입니다. b411 에서 상자 둘로 바꾸면서
 *   이름마다 제 줄을 가지게 됐고, 그래서 규칙도 바뀌었습니다.
 * **부르기 전에 `g.font` 를 먼저 정해야 합니다**(재는 것이 그 글꼴 기준). */
function 줄여쓰기(g, text, max){
  const s = String(text ?? '');
  if (g.measureText(s).width <= max) return s;
  let a = [...s];
  while (a.length > 1 && g.measureText(a.join('') + '…').width > max) a.pop();
  return a.join('') + '…';
}

function wrapText(g, text, max){
  const out = [];
  for (const word of String(text).split(/\s+/)){
    if (!out.length){ out.push(word); continue; }
    const t = out[out.length - 1] + ' ' + word;
    if (g.measureText(t).width <= max) out[out.length - 1] = t;
    else out.push(word);
  }
  const fixed = [];
  for (const line of out){
    if (g.measureText(line).width <= max){ fixed.push(line); continue; }
    let cur = '';
    for (const ch of line){
      if (g.measureText(cur + ch).width > max && cur){ fixed.push(cur); cur = ''; }
      cur += ch;
    }
    if (cur) fixed.push(cur);
  }
  return fixed;
}

/* ── 성향 16유형 카드 그림 ────────────────────────────────────────────
 * **화면에 보이는 것이 곧 이 그림입니다.** HTML 로 한 벌 더 그리지 않습니다 —
 * 이 파일 아래 원래 카드에 적힌 그대로, 두 벌로 그리면 언젠가 한쪽만 고쳐서
 * 보는 것과 올리는 것이 달라집니다. 실제로 그랬던 자리입니다.
 *
 * 생김새는 **디자인 시안을 따릅니다.** 아래 색과 치수는 시안에서 잰 값이라
 * 눈대중으로 고치지 마십시오 — 하나만 흔들려도 여권 느낌이 사라집니다. */

/* ⚠ 옛 성향 카드 색(`P16` — 흰 크림 카드 · 옅은 배지 · 점선)을 걷었습니다(b776).
   성향 카드(b775)와 발자국 카드(b776)가 아래 `P16N` 하나를 같이 씁니다. */
/* 일러스트 뒤 패널. 캐릭터 그림의 배경색과 같은 색이라 이어져 보입니다. */
const P16_PANEL = { F:'#FBF1E3', H:'#E6EDE0' };

function p16Image(code){
  return new Promise(ok => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);      /* 그림 하나 때문에 카드를 못 만들면 안 됩니다 */
    /* 꼬리표를 붙입니다 — 서비스워커의 `versioned` 갈래가 **본 것만** 담고
       옛 판을 지웁니다(sw.js). 열여섯 장 612KB 를 미리 담을 이유가 없습니다.
       한 사람은 자기 유형 하나만 봅니다. */
    img.src = `./persona/${code}.webp?v=b828`;
  });
}

/* ── 여행 영수증 그림 ─────────────────────────────────────────────────
 * ⚠ **성향 카드와 일부러 다르게 그립니다.** 그쪽은 여권(크림톤·일러스트·
 *   놀이)이고 이건 영수증(흰 종이·글자만·기록)입니다. 둘이 비슷해 보이면
 *   앱 안에 같은 것이 둘 있는 셈입니다.
 *
 * ⚠ **화면 영수증과 내용이 다릅니다.** 하루별 흐름과 AI 문단은 뺍니다 —
 *   "Day 3에 무리하셨다" 같은 것은 **내가 볼 것**이지 남에게 보일 것이
 *   아닙니다. 성향 카드에서는 "보는 것이 곧 올리는 것"이 규칙이었는데
 *   여기는 **일부러 가르는 것**이라 다릅니다. 그 이유를 모르면 언젠가
 *   "왜 두 벌이지" 하고 합치게 됩니다.
 *
 * ⚠ **등폭 글씨가 없으면 영수증이 아닙니다.** 숫자가 세로로 안 맞으면
 *   그냥 글자 목록입니다. 캔버스에서는 글꼴을 반드시 이름으로 지정해야
 *   합니다 — 안 그러면 기기마다 다른 글꼴로 그려집니다.
 *
 * ⚠ **글자 크기는 둘뿐입니다** — 본문 하나, 한 줄평 하나. 영수증은 모든
 *   줄이 같은 크기라서 영수증으로 읽힙니다. 강조는 크기가 아니라 굵기와
 *   선으로 합니다. */
const RC = { 바닥:'#EDECE8', 종이:'#FFFFFF', 잉크:'#1A1A1A', 흐림:'#6F6F6F', 점선:'#C9C9C9' };

/* 찢은 가장자리. 영수증을 영수증으로 보이게 하는 것의 절반은 이 톱니입니다.
   흰 종이를 흰 바탕에 그리면 경계가 없어 종이인 줄 모릅니다 — 바닥을 살짝
   어둡게 깔고 위아래를 뜯어 놓아야 "뽑아 온 종이"가 됩니다. */
function 톱니(g, x, w, y, 높이, 위로){
  const 이 = w / 26;
  g.beginPath();
  g.moveTo(x, y);
  for (let i = 0; i < 26; i++)
    g.lineTo(x + 이 * (i + .5), y + (i % 2 ? 높이 : -높이) * (위로 ? -1 : 1)),
    g.lineTo(x + 이 * (i + 1), y);
  g.lineTo(x + w, y + (위로 ? -높이 * 2 : 높이 * 2));
  g.lineTo(x, y + (위로 ? -높이 * 2 : 높이 * 2));
  g.closePath();
  g.fill();
}

/* 바코드는 **장식입니다**(여권 카드의 MRZ 와 같은 역할). 읽을 것이 아닙니다.
   ⚠ 글자로 그렸더니 종이 밖으로 넘쳤습니다 — 글꼴마다 폭이 달라서 맞출 수가
   없습니다. 막대로 직접 그리면 **주어진 폭에 반드시 들어갑니다.**
   무늬는 여행마다 다르되 같은 여행이면 늘 같아야 하므로 씨앗에서 만듭니다. */
function 바코드그리기(g, seed, x, w, y, h){
  let n = 0; const s = String(seed || '');
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  const 칸 = 60, 폭 = w / 칸;
  g.fillStyle = RC.잉크;
  for (let i = 0; i < 칸; i++){
    n = (n * 1103515245 + 12345) >>> 0;
    /* ⚠ **하위 비트를 쓰면 무늬가 안 갈립니다** — 이 난수식은 아래쪽 비트의
       주기가 아주 짧아서 막대가 전부 같아집니다. 위쪽 비트를 봅니다. */
    if (((n >>> 16) % 3) === 0) continue;        /* 빈 칸이 있어야 바코드로 보입니다 */
    const 굵기 = 폭 * ((n >>> 20) % 2 ? .85 : .45);
    g.fillRect(x + i * 폭, y, 굵기, h);
  }
}

async function drawReceipt(s, W, H, F){
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  /* 등폭. `F` 는 본문 글꼴이라 여기서는 안 씁니다 — 영수증은 등폭이 전부입니다. */
  /* ⚠ 예전엔 "IBM Plex Mono" 가 맨 앞이었는데 **아무 데서도 안 받아왔습니다**
     (b530). 캔버스는 없는 글꼴을 조용히 기기 것으로 바꿔 그립니다 —
     그래서 영수증 카드도 처음부터 기기 고정폭이었습니다. 이름을 뺍니다. */
  const M = (w, px) => `${w} ${px}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const L = W * .12, R = W * .88;

  /* ── 조각들 ── 화면 쪽과 같은 순서입니다. 높이는 자(U) 기준입니다. */
  const 줄들 = [];
  const 줄 = (h, draw) => 줄들.push({ h, draw });
  const 한줄 = (k, v, 굵게) => 줄(.042, (y, U) => {
    g.font = M(굵게 ? 700 : 400, U * .030); g.fillStyle = RC.잉크;
    g.textAlign = 'left';  g.fillText(k, L, y + U * .030);
    g.textAlign = 'right'; g.fillText(v, R, y + U * .030);
  });
  /* `선:true` 인 조각은 아래에서 남는 높이를 나눠 받습니다. 선은 늘어난 칸의
     **가운데**에 놓아야 위아래가 고르게 벌어집니다 — 그래서 `h` 를 받습니다. */
  const 선줄 = (h0, draw) => { const b = { h: h0, 선: true,
    draw: (y, U) => draw(y + U * b.h / 2, U) }; 줄들.push(b); };
  const 굵은선 = () => 선줄(.030, (y, U) => {
    g.strokeStyle = RC.잉크; g.lineWidth = Math.max(2, U * .0035);
    g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke();
  });
  const 점선 = () => 선줄(.026, (y, U) => {
    g.strokeStyle = RC.점선; g.lineWidth = Math.max(1, U * .002);
    g.setLineDash([U * .012, U * .010]);
    g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke();
    g.setLineDash([]);
  });

  /* 머리 */
  줄(.060, (y, U) => {
    g.font = M(700, U * .042); g.fillStyle = RC.잉크; g.textAlign = 'center';
    spaced(g, '기 로', W / 2, y + U * .042, U * .012);
  });
  줄(.040, (y, U) => {
    g.font = M(400, U * .026); g.fillStyle = RC.흐림; g.textAlign = 'left';
    spaced(g, 'TRIP RECEIPT', W / 2, y + U * .026, U * .008);
  });
  굵은선();

  if (s.번호) 한줄(`TRIP #${String(s.번호).padStart(3, '0')}`, '');
  한줄(s.dest, `${s.days - 1}박 ${s.days}일`);
  한줄(`${String(s.from).replace(/-/g, '.')} – ${String(s.to).slice(5).replace(/-/g, '.')}`, '');
  점선();
  한줄('방문한 곳', `${s.곳} 곳`);
  if (s.km) 한줄('이동 거리', `약 ${s.km} km`);
  if (s.식비비중) 한줄('식비 비중', `${s.식비비중} %`);
  if (s.합계){
    굵은선();
    한줄('합계', s.돈합계, true);
    if (s.인원 > 1) 한줄('1인당', s.돈1인);
  }
  굵은선();
  if (s.five?.length){
    한줄('★5를 준 곳', '');
    줄(.042, (y, U) => {
      g.font = M(400, U * .028); g.fillStyle = RC.흐림; g.textAlign = 'left';
      g.fillText(s.five.join(' · '), L + U * .020, y + U * .030);
    });
    점선();
  }
  /* **한 줄평만 큽니다.** 영수증에서 유일하게 크기가 다른 줄입니다. */
  줄(.110, (y, U) => {
    g.font = M(700, U * .046); g.fillStyle = RC.잉크; g.textAlign = 'center';
    g.fillText(`"${s.label}"`, W / 2, y + U * .070);
  });
  점선();
  줄(.042, (y, U) => {
    g.font = M(400, U * .026); g.fillStyle = RC.흐림; g.textAlign = 'center';
    g.fillText(`또 오세요 · KEYRO ${String(s.to || '').slice(0, 4)}`, W / 2, y + U * .028);
  });
  줄(.060, (y, U) => 바코드그리기(g, s.바 || s.dest, L, R - L, y + U * .012, U * .038));

  /* ── 자 정하기 ── 성향 카드와 같은 방식입니다(card.js 의 drawP16).
     조각마다 제 높이를 들고 있고, 남는 높이에 맞춰 자를 줄입니다.
     **자를 키우지는 않습니다** — 스토리(1080×1920)에서 글자만 커지면
     영수증이 아니라 포스터가 됩니다. 남으면 위아래 여백으로 둡니다. */
  const 총 = 줄들.reduce((a, b) => a + b.h, 0);
  const 여백 = W * .09;
  const 위 = 여백, 아래 = H - 여백;
  const U = Math.min(W, (아래 - 위) / 총);

  /* ── 남는 높이는 구획 사이로 ──────────────────────────────────────────
   * ⚠ **스토리(9:16)에서 영수증이 가운데 조그맣게 떴습니다.** 내용이 짧아
   *   자(U)가 폭에서 막히고 세로로 절반이 비었습니다.
   *   **글자를 키우지는 않습니다** — 키우면 영수증이 아니라 포스터가 됩니다.
   *   대신 **구분선 앞뒤를 벌립니다.** 진짜 영수증도 항목이 적으면 줄 사이가
   *   성기지 않고 **구획 사이가 벌어집니다.** 줄 간격을 늘리면 글이 흩어져
   *   보이지만, 구획 사이는 벌어져도 각 덩어리가 그대로 붙어 있습니다. */
  const 선칸 = 줄들.filter(b => b.선).reduce((a, b) => a + b.h, 0);
  const 남음 = (아래 - 위) - U * 총;
  const 펼침 = (선칸 > 0 && 남음 > 0)
    ? Math.min(3.2, 1 + 남음 / (U * 선칸))       /* 너무 벌리면 따로 논 것처럼 보입니다 */
    : 1;
  줄들.forEach(b => { if (b.선) b.h *= 펼침; });

  const 총2 = 줄들.reduce((a, b) => a + b.h, 0);
  const 글높이 = U * 총2;
  const 안여백 = U * .055;                       /* 종이 안쪽 위아래 여백 */
  const 종이위 = (H - 글높이) / 2 - 안여백;
  const 종이높이 = 글높이 + 안여백 * 2;
  const 종이좌 = W * .06, 종이폭 = W * .88;

  /* ⚠ **종이를 먼저 깔고 글을 얹습니다.** 순서가 바뀌면 종이가 글을 덮습니다.
     바닥을 살짝 어둡게 두는 이유는 흰 종이의 경계를 보이게 하려는 것입니다 —
     흰 위에 흰을 그리면 종이인 줄 모르고 그냥 여백으로 읽힙니다. */
  g.fillStyle = RC.바닥; g.fillRect(0, 0, W, H);
  g.fillStyle = RC.종이;
  g.fillRect(종이좌, 종이위, 종이폭, 종이높이);
  const 이높이 = W * .012;
  톱니(g, 종이좌, 종이폭, 종이위, 이높이, true);
  톱니(g, 종이좌, 종이폭, 종이위 + 종이높이, 이높이, false);

  let y = (H - 글높이) / 2;
  for (const b of 줄들){ b.draw(y, U); y += U * b.h; }

  /* 종이라 PNG 입니다 — 흰 바탕에 검은 글자라 JPEG 로 하면 글자 가장자리가 지저분해집니다. */
  return new Promise(r => cv.toBlob(r, 'image/png'));
}

/* 자간을 벌려 쓰기. 캔버스 letterSpacing 이 없는 기기가 있어 직접 놓습니다.
   `mx` 는 놓을 자리의 **가운데**입니다. */
function spaced(g, txt, mx, y, gap){
  const chs = [...txt];
  const w = chs.reduce((a, c) => a + g.measureText(c).width, 0) + gap * (chs.length - 1);
  let x = mx - w / 2;
  for (const c of chs){ g.fillText(c, x, y); x += g.measureText(c).width + gap; }
  return w;
}

const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

/* ── 카드 한 장 그리기 ────────────────────────────────────────────────
 * ⚠ **높이를 보고 그립니다.** 처음에는 `y` 를 폭(W)만으로 쌓았습니다. 세로
 *   비율이 셋(4:5 · 1:1 · 9:16)인데 폭은 셋 다 1080 이라, 정사각에서는
 *   막대가 바닥글을 덮고 스토리에서는 아래 절반이 텅 비었습니다.
 *   그래서 **조각마다 제 높이를 들고 있게** 했습니다. 다 더해서 남는 높이에
 *   맞춰 자(U)를 줄입니다. **자를 키우지는 않습니다** — 스토리에서 글자만
 *   커지면 우스워집니다. 조각을 더 넣어도 계산이 저절로 따라옵니다.
 *
 * ⚠ **자는 세로만 줄입니다.** 가로(막대 길이·상자 너비)는 카드 폭이 정합니다.
 *   둘을 같이 묶었더니 4:5 에서 막대가 가운데만 차지하고 양옆이 휑했습니다.
 *   시안은 1:2 라 여백이 넉넉하지만 4:5 는 아닙니다.
 *
 * ⚠ **위계가 거꾸로였습니다.** 코드(HMDP)를 제일 크게 그렸는데, 시안은 코드를
 *   작은 표식으로 두고 **유형 이름을 크고 주황으로** 씁니다. 사람이 자랑하고
 *   싶은 것은 네 글자가 아니라 '지도 밖 순례자' 입니다.
 *
 * 테두리·머리말·바닥글은 흐름에 안 넣습니다. 종이의 일부라 늘 같은 자리에
 * 있어야 합니다. */

/* ══ 성향 공유 카드(b775 에 새로 그림, 사용자 결정 「ㄱ으로 가자」) ══════
 * 사용자: 「공유카드 퀄리티가 너무 구려」.
 *
 * ⚠⚠ **분석 탭 화면을 그대로 옮긴 그림입니다.** ⚠⚠
 *   b775 이전 카드는 **종이 디자인(b584~b628) 이전의 여권 콘셉트**로 그려져
 *   있었습니다 — 둥근 카드, 주황 막대, 색 칠한 상자, ARRIVED·NEXT TRIP
 *   도장, 여권 코드 줄. 캔버스 그림이라 앱을 종이로 갈아입힐 때 같이 안
 *   바뀌었고, 그래서 **혼자 다른 앱처럼** 보였습니다(b773 도시 카드와 같은
 *   사연). 사람들이 보고 공유하고 싶어진 것은 분석 탭 화면이므로 카드도
 *   그것과 똑같이 생겨야 합니다.
 *   시안 셋(분석 탭 그대로 / + 여권 한 줄 / 세로판) 중 첫째를 골랐습니다.
 *
 * ⚠ **치수는 시안(폭 360)의 1px 을 `u` 로 불러 씁니다.** 시안이 곧 설계도라
 *   숫자를 옮겨 적기만 하면 됩니다 — 1080 폭이면 u = 3 입니다.
 *   값을 만지려거든 시안의 숫자와 같이 보십시오.
 *
 * ⚠ **세 크기는 «높이 비율»로 가릅니다.** 히어로는 원본 비(3:2) 그대로라
 *   (b740, 사용자 지시 「이미지 원본 비율 유지해줘야지」) 폭이 1080 이면
 *   늘 720 을 먹습니다. 남는 높이에 들어가는 만큼만 넣습니다:
 *     스토리(1920) — 축 · 궁합(그림 크게) · 추천 · 바닥
 *     세로(1350)   — 축 · 궁합(그림 작게 한 줄) · 바닥
 *     정사각(1080) — 축 · 바닥
 *   시안 셋에서 셋 다 딱 들어가는 것을 재서 확인했습니다.
 *
 * ⚠ **궁합과 추천은 없을 수도 있습니다.** 로그인 전 맛보기(try.js)는 내
 *   유형 하나만 넘깁니다. 없으면 그 칸을 통째로 비웁니다 — 빈 자리는
 *   바닥 위로 모입니다(시안의 `margin-top:auto`).
 *
 * ⚠ **발자국 카드(drawStamps)도 이 틀입니다(b776).** 팔레트(`P16N`)와
 *   바닥(`기로바닥`)을 같이 씁니다 — 두 장을 나란히 올려도 한 앱의 것으로
 *   보여야 합니다. 옛 `P16` 팔레트는 걷었습니다.
 *
 * ⚠ 걷은 것: 둥근 카드와 테두리 · ARRIVED 도장 · PASSPORT 머리말과 상위 %
 *   알약(→ 히어로 안 한 줄로) · 개국/도시 큰 숫자(→ 같은 한 줄) · 주황 막대
 *   (→ 먹색) · 궁합 색 상자(→ 그림 + 왼쪽 색 선) · 추천 상자 · 여권 코드 줄
 *   (`s.mrz` 는 이제 안 씁니다. 부르는 쪽은 그대로 넘겨도 됩니다) · 점선
 *   바닥과 뜯는 홈 · NEXT TRIP 알약.
 */
const P16N = {
  /* 흐림은 화면 --ink-48 과 같은 값(b805 에 #807C74 → #6B675F, 종이 위 대비 3.65 → 4.94 — app.css 머리 주석). */
  종이:'#F3F0E8', 잉크:'#1B1B1F', 흐림:'#6B675F', 선:'#DFDAD0', 홈:'#E3DDD0',
  주황:'#F25E26', 밝은주황:'#FF9166', 좋음:'#5A7A46', 나쁨:'#B0574E',
  /* 축 막대(b823, 시안 B) — 화면 --star · --ink-80 과 같은 값. 바탕은 위 홈(화면 .axstrk 바탕과 같음). */
  별:'#E08A2B', 짙은잉크:'#3A3630',
  /* 발자국 카드(b776) — 0 인 대륙의 값 · 지도 판 · 안 간 땅(판보다 한 단 짙게) */
  아주흐림:'#B5AFA3', 지도판:'#E6E0D3', 지도땅:'#D3CBBC',
};

/* 궁합 그림 — 화면이 쓰는 720px 판(m/)입니다. 원본 webp(약 500KB)를 둘 더
   받을 이유가 없습니다. 이 카드에서 궁합 그림은 폭 430px 남짓입니다. */
function p16Thumb(code){
  return new Promise(ok => {
    if (!code) return ok(null);
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);      /* 그림 하나 때문에 카드를 못 만들면 안 됩니다 */
    img.src = `./persona/m/${code}.jpg?v=b828`;
  });
}

/* 그림을 칸에 «꽉 차게»(object-fit:cover) 놓습니다. 비가 같으면 자르지 않습니다. */
function 덮어그리기(g, img, x, y, w, h){
  const sr = img.width / img.height, dr = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (sr > dr){ sw = img.height * dr; sx = (img.width - sw) / 2; }
  else if (sr < dr){ sh = img.width / dr; sy = (img.height - sh) / 2; }
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/* ══ 바닥 ── 가는 선 · 기로 · 부르는 말 ═══════════════════════════════
   성향 카드와 발자국 카드가 **같은 것을 씁니다**(b776) — 한쪽만 고치면
   나란히 올렸을 때 바닥이 갈립니다. 다른 것은 오른쪽 부르는 말뿐입니다.
   ⚠ 로고는 앱 아이콘과 **같은 모양**으로 그립니다(주황 네모 + 흰 화살 둘).
     파일을 안 받습니다 — 카드마다 받아올 이유가 없습니다. */
function 기로바닥(g, PX, PY, PW, PH, 바닥높이, px, F, 말){
  const fy0 = PY + PH - 바닥높이;
  g.fillStyle = P16N.선; g.fillRect(PX, fy0, PW, Math.max(1, px(.8)));
  const ls = px(20), lx = PX + px(16), ly = fy0 + (바닥높이 - ls) / 2;
  g.fillStyle = P16N.주황; rrect(g, lx, ly, ls, ls, ls * .233); g.fill();
  g.fillStyle = '#FFFFFF';
  const q = ls / 96;                 /* 아이콘 SVG(96칸)를 그대로 옮깁니다 */
  g.save(); g.translate(lx + 9.6 * q, ly + 9.6 * q); g.scale(.8 * q, .8 * q);
  g.beginPath();
  g.moveTo(18, 22); g.lineTo(62, 22); g.lineTo(76, 33); g.lineTo(62, 44); g.lineTo(18, 44);
  g.quadraticCurveTo(13, 44, 13, 33); g.quadraticCurveTo(13, 22, 18, 22); g.closePath();
  g.moveTo(78, 52); g.lineTo(34, 52); g.lineTo(20, 63); g.lineTo(34, 74); g.lineTo(78, 74);
  g.quadraticCurveTo(83, 74, 83, 63); g.quadraticCurveTo(83, 52, 78, 52); g.closePath();
  g.fill(); g.restore();
  const by = fy0 + 바닥높이 / 2 + px(4);
  g.textAlign = 'left';
  g.font = F(800, px(12.5)); g.fillStyle = P16N.잉크;
  g.fillText('기로', lx + ls + px(7), by);
  g.textAlign = 'right';
  g.font = F(500, px(9)); g.fillStyle = P16N.흐림;
  g.fillText(말, PX + PW - px(16), by);
  g.textAlign = 'left';
}

async function drawP16(s, W, H, F){
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const kind = s.code[0] === 'H' ? 'H' : 'F';

  /* ── 종이 ── 화면 끝까지 칠합니다(시안 그대로). 모서리는 각집니다 —
     앱이 b628 에 모서리를 토큰째 0 으로 뒀습니다.
     ⚠ **투명판(b498)은 없앴습니다(b775, 사용자: 「굳이 투명판 없어도 될것
       같아」).** 저장 시트의 「배경 포함 / 투명」 줄도 같이 걷었습니다.
       되살리려거든 그 줄(index.html 의 #cardsheet)부터 되돌려야 합니다. */
  const PX = 0, PY = 0, PW = W, PH = H;
  const u = PW / 360;
  const px = v => v * u;
  g.fillStyle = P16N.종이; g.fillRect(PX, PY, PW, PH);
  g.save();
  g.beginPath(); g.rect(PX, PY, PW, PH); g.clip();

  const 궁합있음 = !!(s.best && s.worst);
  const [art, 좋은그림, 나쁜그림] = await Promise.all([
    p16Image(s.code),
    궁합있음 ? p16Thumb(s.best.code)  : null,
    궁합있음 ? p16Thumb(s.worst.code) : null,
  ]);

  /* 왼쪽부터 이어 쓰는 글줄(색·굵기가 섞일 때). */
  const 이어쓰기 = (parts, x, y) => {
    let cx = x;
    for (const p of parts){
      g.font = p.f; g.fillStyle = p.c; g.fillText(p.t, cx, y);
      cx += g.measureText(p.t).width;
    }
  };

  /* ══ 히어로 — 원본 비(3:2) 그대로 ═════════════════════════════════
     ⚠ 자르지 않습니다(b740). ⚠ 그림을 못 받으면 흰 글자를 쓰면 안
       됩니다 — 옅은 패널에 먹색으로 씁니다. */
  const hw = PW, hh = PW / 1.5, hx = PX, hy = PY;
  if (art){
    g.drawImage(art, hx, hy, hw, hh);
    /* 아래쪽 그늘 — 글자가 하늘·엽서 위에 걸려도 읽히게(FMDP 에서 걸렸습니다). */
    const gr = g.createLinearGradient(0, hy + hh * .30, 0, hy + hh);
    gr.addColorStop(0, 'rgba(15,12,8,0)');
    gr.addColorStop(1, 'rgba(15,12,8,.78)');
    g.fillStyle = gr; g.fillRect(hx, hy, hw, hh);
  } else {
    g.fillStyle = P16_PANEL[kind]; g.fillRect(hx, hy, hw, hh);
  }
  {
    const 흰 = !!art;
    const tx = hx + px(16);
    /* ⚠ 글자는 **왼쪽 아래**에만 둡니다 — 오른쪽에 주인공이 있습니다. */
    const 글폭 = hw * .58;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    if (흰){ g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = px(3); }

    /* 아래에서 위로 쌓습니다 — 맨 아래 줄 자리가 고정이고 위는 줄 수에
       따라 올라갑니다. */
    let ty = hy + hh - px(13);

    /* 「상위 3% · 29개국 · 77도시」 — 화면의 `.pstat` 와 같은 한 줄 */
    const 곳 = (s.countries != null && s.cities != null)
      ? ` · ${s.countries}개국 · ${s.cities}도시` : '';
    이어쓰기([
      { t: s.rank || '', f: F(800, px(9.5)), c: 흰 ? P16N.밝은주황 : P16N.주황 },
      { t: 곳,           f: F(600, px(9.5)), c: 흰 ? 'rgba(255,255,255,.90)' : P16N.흐림 },
    ], tx, ty);
    ty -= px(15);

    g.font = F(500, px(9)); g.fillStyle = 흰 ? 'rgba(255,255,255,.80)' : P16N.흐림;
    const al = wrapText(g, s.axisWords || '', 글폭);
    for (let i = al.length - 1; i >= 0; i--){ g.fillText(al[i], tx, ty); ty -= px(12); }
    ty -= px(3);

    g.font = F(500, px(10)); g.fillStyle = 흰 ? 'rgba(255,255,255,.94)' : P16N.흐림;
    const dl = wrapText(g, s.desc || '', 글폭);
    for (let i = dl.length - 1; i >= 0; i--){ g.fillText(dl[i], tx, ty); ty -= px(14); }
    ty -= px(4);

    /* 브랜드 주황은 어두운 그림 위에서 묻힙니다 — 배너에서만 밝게(화면 `.pname` 과 같은 값). */
    g.font = F(800, px(16)); g.fillStyle = 흰 ? P16N.밝은주황 : P16N.주황;
    g.fillText(s.name || '', tx, ty);
    /* ⚠ 한 칸 올리는 값은 «방금 그린 글자»의 대문자 높이에 맞춥니다 —
       b741 에 「나의 여행 유형은」이 코드 «안»으로 겹쳐 찍혔습니다. */
    ty -= px(20);

    g.font = F(800, px(31)); g.fillStyle = 흰 ? '#FFFFFF' : P16N.잉크;
    { let cx = tx; for (const ch of [...s.code]){ g.fillText(ch, cx, ty); cx += g.measureText(ch).width + px(.6); } }
    ty -= px(29);                      /* 코드 대문자 높이(31 × .72) + 여유 */

    g.font = F(600, px(9)); g.fillStyle = 흰 ? 'rgba(255,255,255,.88)' : P16N.흐림;
    g.fillText('나의 여행 유형은', tx, ty);

    g.shadowColor = 'transparent'; g.shadowBlur = 0;
  }

  /* ══ 무엇을 넣을지 — 높이 비율로 ══════════════════════════════════ */
  const 비 = PH / PW;
  /* 「도전해볼 곳」 — b776 에 「반대로 가보면」에서 바꿨습니다(사용자).
     분석 탭(anal.js)과 **같은 말**입니다. 한쪽만 바꾸지 마십시오. */
  const 추천 = [['어울리는 곳', s.picks?.match    || []],
                ['도전해볼 곳', s.picks?.opposite || []]]
               .filter(([, n]) => n.length);
  const 궁합꼴 = !궁합있음 ? null : 비 >= 1.6 ? '크게' : 비 >= 1.15 ? '작게' : null;
  const 추천넣기 = 비 >= 1.6 && 추천.length > 0;

  /* 조각마다 높이(시안 px). 사이는 11 입니다. */
  const 좌 = px(16), 우 = PX + PW - px(16);
  const 칸폭 = (우 - (PX + 좌) - px(10)) / 2;        /* 두 칸 */
  const 조각 = [];
  /* 궁합 그림 높이(시안 px). 칸폭에서 왼쪽 선·여백(10)을 뺀 폭의 3:2 입니다.
     ⚠ 그릴 때도 **이 값에서** 폭을 되짚습니다 — 몸통이 줄면(k) 그림도 같이
       줄어야 다음 조각을 안 덮습니다. 폭만 두고 높이만 줄이면 찌그러집니다. */
  const 그림높이 = (칸폭 / u - 10) / 1.5;
  /* ⚠⚠ **정사각은 축을 «한 줄 넷 칸»으로 둡니다.** ⚠⚠ 히어로가 720 을
     먹으면 남는 높이가 58(시안 px)뿐인데, 넷 줄(109)을 우겨 넣으면 0.53 배로
     눌려 글자가 6pt 가 됩니다(실제로 그려 보고 알았습니다). 한 줄이면
     1 배 그대로 들어갑니다. */
  /* 한 줄은 35(b805 스펙트럼 — 막대 밑에 두 극 이름이 한 줄 더 붙어 28 → 32, 「아직 모름」을 눈금에서
     띄우느라 → 35). 정사각에 남는 58 안입니다. */
  if (비 < 1.15) 조각.push({ h: 35, 그리기: 축한줄 });
  else 조각.push({ h: 4 * 22 + 3 * 7, 그리기: 축그리기 });
  if (궁합꼴 === '크게'){
    조각.push({ h: 25 + 7 + 그림높이 + 5 + 11 + 15 + 11, 그리기: 궁합크게 });
  } else if (궁합꼴 === '작게'){
    조각.push({ h: 1 + 9 + 38, 그리기: 궁합작게 });
  }
  if (추천넣기) 조각.push({ h: 1 + 10 + 11 + 3 + 29, 그리기: 추천그리기 });

  const 바닥높이 = px(42);
  const 위 = hy + hh + px(12);
  const 아래 = PY + PH - 바닥높이 - px(8);
  const 필요 = 조각.reduce((a, b) => a + b.h, 0) + (조각.length - 1) * 11;
  /* 넘치면 몸통만 줄입니다(히어로는 못 줄입니다 — 원본 비). 시안에서는
     셋 다 1 이었습니다. 긴 이름·세 줄 설명이 들어오면 조금 줄 수 있습니다. */
  const k = Math.min(1, (아래 - 위) / px(필요));
  const bx = v => px(v) * k;

  let y = 위;
  for (const c of 조각){ c.그리기(y); y += bx(c.h + 11); }

  /* ── 축 넷 ── 양쪽 스펙트럼(b805, 사용자: 「응 다 바꾸자」) ─────────────
     ⚠⚠ **화면(axisSpectrum · app.css .axspec)과 같은 그림입니다.** 전에는 0 부터 차오르는 먹색 막대 +
       오른쪽 숫자였는데, 화면을 스펙트럼으로 바꾸면서(밖에서 받은 리포트 시안 A · 숫자 빼기) 카드도 맞춥니다 —
       보는 것과 올리는 것이 달라지면 안 됩니다(이 파일 머리말).
     ⚠ 한 줄에 이름, 그 밑에 [왼쪽 극 · 막대 · 오른쪽 극]. 가운데(50) 눈금에서 기운 쪽으로 칠하고 기운 쪽
       극만 진하게. 기운 쪽 규칙은 코드 글자와 같습니다(50 이상이면 H·L·D·G) — `축자리` 하나로 셉니다.
     ⚠ `bars` 의 셋째 칸(참이면 해외가 모자라 50 으로 둔 축)은 칠하지 않고 「아직 모름」.
       셋째 칸이 없는 옛 spec 도 그대로 그립니다(모름 = 아님).
     ⚠ 극 이름은 AXIS_POLES · AXIS_WORD(아래 표)에서 꺼냅니다 — `axisWords` 는 기운 쪽 넷뿐이라 못 씁니다.
     ⚠⚠ **`function` 선언이어야 합니다(const 화살표 금지).** 위 `for (const c of 조각)` 가 이 줄보다 «먼저»
       돌면서 그리기를 부릅니다 — const 로 두면 TDZ 로 카드가 통째로 안 그려집니다(b805 에 그려보다 잡음). */
  function 축자리(v, i, 모름){
    const [왼, 오] = AXIS_POLES[i] || ['F', 'H'], 오른 = v >= 50;
    const 폭 = Math.max(Math.abs(v - 50), 1.5);
    return { 왼말: AXIS_WORD[왼], 오말: AXIS_WORD[오], 왼진: !모름 && !오른, 오진: !모름 && 오른,
             시작: 오른 ? 50 : 50 - 폭, 폭, 오른 };
  }
  /* 막대 한 줄 — 바탕 · (모름이 아니면) 칠 · 가운데 눈금. x0~x1 은 막대 양끝, cy 는 막대 가운데.
     ⚠ b823: 화면과 같은 «둥근 주황 막대»(사용자가 고른 시안 B, app.css .axstrk). 바탕은 알약, 칠은 별색으로
       «바깥 끝만» 둥글게(가운데 끝은 눈금에 붙음), 눈금은 짙게. 두께 5 → 6.5 로 올리되 눈금 길이(위아래 끝)는
       예전과 같게 두었습니다 — 정사각(축한줄)에서 눈금 밑과 극 이름 윗선 사이가 b805 에 1px 로 맞춘 자리입니다.
     ⚠ roundRect 는 이 파일이 이미 씁니다(위 rrect). 반지름이 칠보다 크면 브라우저가 알아서 줄입니다. */
  function 스펙트럼막대(x0, x1, cy, 자리, 모름){
    const th = bx(6.5), w = x1 - x0, r = th / 2, y = cy - th / 2;
    g.fillStyle = P16N.홈; rrect(g, x0, y, w, th, r); g.fill();
    if (!모름){
      g.fillStyle = P16N.별;
      rrect(g, x0 + w * 자리.시작 / 100, y, w * 자리.폭 / 100, th, 자리.오른 ? [0, r, r, 0] : [r, 0, 0, r]);
      g.fill();
    }
    const tw = Math.max(1, bx(1.4)), tl = th + bx(3.5);
    g.fillStyle = P16N.짙은잉크; rrect(g, x0 + w / 2 - tw / 2, cy - tl / 2, tw, tl, tw / 2); g.fill();
  }
  function 축그리기(y0){
    const 극폭 = bx(46), 틈 = bx(8);
    const 막대왼 = PX + 좌 + 극폭 + 틈, 막대오 = 우 - 극폭 - 틈;
    (s.bars || []).forEach(([name, v, 모름], i) => {
      const ry = y0 + bx(i * (22 + 7)), 자리 = 축자리(v, i, 모름);
      g.textAlign = 'left';
      g.font = F(800, bx(10)); g.fillStyle = P16N.잉크;
      g.fillText(name, PX + 좌, ry + bx(9.5));
      if (모름){
        const nx = PX + 좌 + g.measureText(name).width;
        g.font = F(500, bx(8)); g.fillStyle = P16N.흐림;
        g.fillText(' · 아직 모름', nx, ry + bx(9.5));
      }
      g.font = F(자리.왼진 ? 700 : 500, bx(8.5)); g.fillStyle = 자리.왼진 ? P16N.잉크 : P16N.흐림;
      g.fillText(자리.왼말, PX + 좌, ry + bx(20.5));
      g.textAlign = 'right';
      g.font = F(자리.오진 ? 700 : 500, bx(8.5)); g.fillStyle = 자리.오진 ? P16N.잉크 : P16N.흐림;
      g.fillText(자리.오말, 우, ry + bx(20.5));
      스펙트럼막대(막대왼, 막대오, ry + bx(17.5), 자리, 모름);
    });
    g.textAlign = 'left';
  }

  /* ── 축 넷을 한 줄로(정사각) ── 칸마다 이름, 그 밑에 막대, 그 밑에 두 극 ──
     ⚠ 칸이 좁아(시안 약 73px) 극 이름을 막대 «밑» 양끝에 작게 둡니다. 「아직 모름」은 극 대신 가운데에. */
  function 축한줄(y0){
    const 폭 = 우 - (PX + 좌), 틈 = bx(12), 칸 = (폭 - 틈 * 3) / 4;
    (s.bars || []).forEach(([name, v, 모름], i) => {
      const x0 = PX + 좌 + i * (칸 + 틈), 자리 = 축자리(v, i, 모름);
      g.textAlign = 'left';
      g.font = F(800, bx(9.5)); g.fillStyle = P16N.잉크;
      g.fillText(name, x0, y0 + bx(11));
      스펙트럼막대(x0, x0 + 칸, y0 + bx(18.5), 자리, 모름);
      const by = y0 + bx(30);
      if (모름){
        /* ⚠ 가운데 눈금 바로 밑이라 3 을 더 내립니다 — 30 이면 눈금 끝(18.5+5)과 글자 윗선이 1px 차로 붙어
           「아직|모름」처럼 읽혔습니다(b805 점검에서 잡음). 칸 높이도 32 → 35(위 조각). */
        g.textAlign = 'center'; g.font = F(500, bx(7.5)); g.fillStyle = P16N.흐림;
        g.fillText('아직 모름', x0 + 칸 / 2, y0 + bx(33));
        return;
      }
      g.font = F(자리.왼진 ? 700 : 500, bx(7.5)); g.fillStyle = 자리.왼진 ? P16N.잉크 : P16N.흐림;
      g.fillText(자리.왼말, x0, by);
      g.textAlign = 'right';
      g.font = F(자리.오진 ? 700 : 500, bx(7.5)); g.fillStyle = 자리.오진 ? P16N.잉크 : P16N.흐림;
      g.fillText(자리.오말, x0 + 칸, by);
    });
    g.textAlign = 'left';
  }

  /* 조각 위의 가는 선 — 화면이 구역을 선으로 나누는 것과 같습니다. */
  function 윗선(y0){
    g.fillStyle = P16N.선; g.fillRect(PX + 좌, y0, 우 - (PX + 좌), Math.max(1, bx(.8)));
  }

  /* ── 궁합(스토리) ── 제목 · 그림 · 딱지 · 이름 · 코드 ──────────────
     ⚠ 좋고 나쁨은 **왼쪽 색 선**이 말합니다 — 화면(`.matecard`)과 같습니다.
       상자를 칠하지 않습니다(b627 에 화면에서 걷은 것). */
  function 궁합크게(y0){
    윗선(y0);
    g.font = F(800, bx(11)); g.fillStyle = P16N.잉크; g.textAlign = 'left';
    /* 「여행 궁합」 — b776 에 「나와 맞는 사람」에서 바꿨습니다(사용자).
       분석 탭 화면(persona.js)과 **같은 말**입니다. 한쪽만 바꾸지 마십시오. */
    g.fillText('여행 궁합', PX + 좌, y0 + bx(10 + 11));
    const top = y0 + bx(25 + 7);
    /* 「극과 극 메이트」 — b799 에 「최악의 조합」에서 바꿨습니다(사용자, GPT 리포트 제안 — 사람을
       깎아내리는 말이라서). 분석 탭(persona.js)과 같은 말 — 한쪽만 바꾸지 마십시오. */
    [[s.best, '환상의 메이트', P16N.좋음, 좋은그림],
     [s.worst, '극과 극 메이트', P16N.나쁨, 나쁜그림]].forEach(([m, 딱지, 색, 그림], i) => {
      const cx0 = PX + 좌 + i * (칸폭 + px(10));
      const ih = bx(그림높이), iw = ih * 1.5, ix = cx0 + bx(10);
      g.fillStyle = 색; g.fillRect(cx0, top, Math.max(1.5, bx(2)), ih + bx(5 + 11 + 15 + 11));
      if (그림) 덮어그리기(g, 그림, ix, top, iw, ih);
      else { g.fillStyle = P16_PANEL[m.code[0] === 'H' ? 'H' : 'F']; g.fillRect(ix, top, iw, ih); }
      let ly = top + ih + bx(5 + 9);
      g.font = F(700, bx(8.5)); g.fillStyle = 색;
      g.fillText(줄여쓰기(g, `${딱지} · ${m.score}%`, iw), ix, ly);
      ly += bx(15);
      g.font = F(800, bx(11.5)); g.fillStyle = P16N.잉크;
      g.fillText(줄여쓰기(g, m.name, iw), ix, ly);
      ly += bx(12);
      g.font = F(500, bx(8.5)); g.fillStyle = P16N.흐림;
      g.fillText(m.code, ix, ly);
    });
  }

  /* ── 궁합(세로) ── 작은 네모 그림 한 줄 ────────────────────────────
     ⚠ 세로(1350)는 높이가 모자라 그림을 크게 못 둡니다. 시안 ㈂ 그대로. */
  function 궁합작게(y0){
    윗선(y0);
    const top = y0 + bx(1 + 9), th = bx(38);
    /* 「극과 극 메이트」 — b799 에 「최악의 조합」에서 바꿨습니다(사용자, GPT 리포트 제안 — 사람을
       깎아내리는 말이라서). 분석 탭(persona.js)과 같은 말 — 한쪽만 바꾸지 마십시오. */
    [[s.best, '환상의 메이트', P16N.좋음, 좋은그림],
     [s.worst, '극과 극 메이트', P16N.나쁨, 나쁜그림]].forEach(([m, 딱지, 색, 그림], i) => {
      const cx0 = PX + 좌 + i * (칸폭 + px(10));
      if (그림) 덮어그리기(g, 그림, cx0, top, th, th);
      else { g.fillStyle = P16_PANEL[m.code[0] === 'H' ? 'H' : 'F']; g.fillRect(cx0, top, th, th); }
      const lx = cx0 + th + bx(7), lw = 칸폭 - th - bx(7);
      g.textAlign = 'left';
      g.font = F(700, bx(8)); g.fillStyle = 색;
      g.fillText(줄여쓰기(g, `${딱지} · ${m.score}%`, lw), lx, top + bx(15));
      g.font = F(800, bx(11)); g.fillStyle = P16N.잉크;
      g.fillText(줄여쓰기(g, m.name, lw), lx, top + bx(30));
    });
  }

  /* ── 다음에 갈 곳(스토리만) ── 두 칸, 작은 제목 + 이름 ── */
  function 추천그리기(y0){
    윗선(y0);
    추천.forEach(([cap, names], i) => {
      const cx0 = PX + 좌 + i * (칸폭 + px(10));
      g.textAlign = 'left';
      g.font = F(500, bx(8.5)); g.fillStyle = P16N.흐림;
      g.fillText(cap, cx0, y0 + bx(1 + 10 + 9));
      g.font = F(700, bx(10.5)); g.fillStyle = P16N.잉크;
      /* 이름은 셋까지, 두 줄에서 끊습니다 — 넘치면 캔버스는 잘라주지 않습니다. */
      const 줄 = wrapText(g, names.slice(0, 3).join(' · '), 칸폭).slice(0, 2);
      줄.forEach((l, j) => g.fillText(l, cx0, y0 + bx(1 + 10 + 11 + 3 + 11 + j * 14.5)));
    });
  }

  /* ══ 바닥 ── 발자국 카드와 같은 것입니다(위 `기로바닥`). */
  기로바닥(g, PX, PY, PW, PH, 바닥높이, px, F, '나의 여행 성향 알아보기');

  g.restore();
  /* ⚠⚠ **PNG 가 아니라 JPEG 입니다(b775).** 이제 사진이 셋이라 PNG 면
     2MB 가 넘습니다(실측: 스토리 2,222KB). 옛 주석은 「사진이 없어 단색이
     넓게 깔리니 PNG 로도 작다」였는데 그 전제가 사라졌고, PNG 를 쓰던
     다른 이유(투명판)도 같이 없어졌습니다. 카톡·인스타는 어차피 다시
     눌러 담습니다.
     ⚠ 저장 쪽(`saveCardImage`)이 `blob.type` 을 보고 확장자를 정하므로
       여기만 바꾸면 됩니다. */
  return new Promise(r => cv.toBlob(r, 'image/jpeg', .92));
}

/* ── 발자국 카드 (여권 스탬프 면) ─────────────────────────────────────
 * 「몇 개국 다녀왔다」를 내보이는 카드입니다. 이 앱에서 **제일 자랑거리**라
 * 공유가 유입으로 이어질 자리도 여기입니다.
 *
 * ⚠⚠ **성향 카드(drawP16)와 같은 틀입니다(b776, 사용자: 「같은 모양으로
 *   시안먼저」 → 시안 ㄴ).** 각진 종이 · 위 3:2 히어로 · 먹색 막대 · 가는
 *   선 · 기로 바닥(`기로바닥` 하나를 같이 씁니다). 성향 카드의 자리마다
 *   이 카드의 것이 앉습니다:
 *     사진 → 세계지도 · 축 넷 → 대륙 여섯 · 궁합 → 가장 많이 간 나라 셋 ·
 *     추천 → 모은 깃발.
 *   ⚠ 지도 판은 **밝게** 둡니다(ㄴ). 어두운 판(ㄱ)도 나란히 그려 보였는데
 *     사용자가 ㄴ 을 골랐습니다 — 앱의 지구본 색과 같은 쪽입니다.
 * ⚠ 걷은 것(b649 의 여권 면): 둥근 카드와 테두리 · ARRIVED 도장 · PASSPORT
 *   머리말 · % 알약(→ 히어로 안 주황 한 줄) · 195 막대(→ 대륙 막대) · 점선
 *   바닥과 뜯는 홈 · NEXT TRIP 알약 · 여권 코드 줄(`s.mrz`).
 *
 * ⚠ **글자 이모지 깃발을 쓰지 않습니다.** 기기가 못 그리면 캔버스에
 *   **네모가 저장**됩니다. `flags.svg` 의 그림을 꺼내 그립니다 — 어느
 *   기기에서나 같습니다. 못 받으면 그 칸만 홈 색으로 둡니다.
 * ⚠ **여기서 무엇을 셀지 정하지 않습니다.** 숫자도 지도도 대륙 수도 부르는
 *   쪽(map.js 의 `발자국스펙`)이 넘겨줍니다. 여기서 또 세면 화면과 카드가
 *   갈립니다 — 이 파일의 오래된 규칙입니다.
 */

/* 깃발 하나를 «깃발만»(36×26) 잘라 그릴 폭으로 굽습니다.
   ⚠ flags.svg 의 칸은 36×36 이고 깃발은 가운데 26 줄입니다. 네모째 그리면
     위아래가 빈 채로 작아집니다(옛 카드가 그랬습니다).
   ⚠ **그릴 폭으로 굽습니다.** SVG 그림은 제 width 로 한 번 찍힌 뒤
     늘어납니다 — 72px 로 받아 88px 에 그리면 흐립니다. */
function 깃발그림(code, 폭){
  const svg = flagSvgOf(code);
  if (!svg) return Promise.resolve(null);
  const 옛 = 'viewBox="0 0 36 36" width="72" height="72"';
  const 자른 = svg.replace(옛,
    `viewBox="0 5 36 26" width="${폭}" height="${Math.round(폭 * 26 / 36)}"`);
  /* dom.js 의 flagSvgOf 가 모양을 바꿔 위 글자가 안 맞으면 네모째 받고
     그릴 때 위아래를 잘라냅니다(`깃발놓기`). 찌그러지는 것보다 낫습니다. */
  const 네모 = 자른 === svg;
  return svgImage(자른).then(im => im && { im, 네모 });
}
function 깃발놓기(g, f, x, y, w, h){
  if (f.네모) g.drawImage(f.im, 0, f.im.height * 5 / 36, f.im.width, f.im.height * 26 / 36, x, y, w, h);
  else g.drawImage(f.im, x, y, w, h);
}

/* 깃발 칸 — **개수에 맞춰 줄입니다**(b776, 사용자: 「모은 깃발이 30개가
   넘어가면?」 → 시안 보고 「그 방식으로」).
   스토리에서 30개까지는 한 줄 10개(시안 크기). 넘으면 작게 해서 **한 줄에
   더** — 12 · 14 · 16 · 18 · 20개. 가장 작게도 모자라면 마지막 두 칸에 「+N」.
   ⚠ 처음부터 잘라 「+N」 을 내지 않습니다 — 이 카드의 자랑은 깃발 벽입니다.
     예순 나라에서 스물아홉만 보이면 절반을 숨기는 셈입니다. */
function 깃발칸(n, 폭, 높이, px){
  for (const 칸 of [10, 12, 14, 16, 18, 20]){
    const 틈 = px(칸 <= 14 ? 4 : 3);
    const w = (폭 - (칸 - 1) * 틈) / 칸, h = w * 26 / 36;
    const 줄 = Math.max(1, Math.floor((높이 + 틈) / (h + 틈)));
    if (줄 * 칸 >= n || 칸 === 20) return { 칸, 줄, 틈, w, h, 넘침: 줄 * 칸 < n };
  }
}

async function drawStamps(s, W, H, F){
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  /* 자는 성향 카드와 같습니다 — 시안(폭 360)의 1px 을 `u` 로 씁니다. */
  const PX = 0, PY = 0, PW = W, PH = H;
  const u = PW / 360;
  const px = v => v * u;
  g.fillStyle = P16N.종이; g.fillRect(PX, PY, PW, PH);

  const 비 = PH / PW;
  const 꼴 = 비 >= 1.6 ? '스토리' : 비 >= 1.15 ? '세로' : '정사각';
  const 좌 = PX + px(16), 우 = PX + PW - px(16), 폭 = 우 - 좌;
  const 코드 = s.codes || [];
  const n = 코드.length;
  const 대륙 = s.byCont || [];
  const 셋 = (s.top || []).slice(0, 3);

  /* ══ 히어로 — 성향 카드의 사진 자리(3:2)에 세계지도 ════════════════
     ⚠ 나라 사이 선은 **판 색**으로 긋습니다. 안 그으면 붙어 있는 나라
       (프랑스·스위스·이탈리아)가 한 덩어리 주황으로 읽힙니다.
     ⚠ 지도는 폭에 맞춰 위에 붙이고 글자는 지도 **밑** 빈 판에 씁니다 —
       지도 위에 얹으면 남아메리카가 글자에 가립니다(시안에서 잼). */
  const hw = PW, hh = PW / 1.5, hx = PX, hy = PY;
  g.fillStyle = P16N.지도판; g.fillRect(hx, hy, hw, hh);
  const mh = hw / 2.584;               /* viewBox 1000×387 */
  const 땅 = s.land ? await svgImage(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 19 1000 387"
          width="${Math.round(hw)}" height="${Math.round(mh)}"><style>
       path{fill:${P16N.지도땅};stroke:${P16N.지도판};stroke-width:.9;stroke-linejoin:round}
       path.been{fill:${P16N.주황}}</style>${s.land}</svg>`) : null;
  if (땅) g.drawImage(땅, hx, hy, hw, mh);
  {
    const tx = hx + px(16);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    /* 아래에서 위로 쌓습니다(성향 카드와 같은 셈). */
    let ty = hy + hh - px(12.5);
    g.font = F(500, px(9)); g.fillStyle = P16N.흐림;
    g.fillText(`${s.cities}도시 · ${s.conts}대륙`, tx, ty);
    ty -= px(15);
    g.font = F(800, px(12.5)); g.fillStyle = P16N.주황;
    g.fillText(`세계 ${s.total}개국 중 ${Number(s.pct || 0).toFixed(1)}%`, tx, ty);
    ty -= px(19.5);
    const 수 = String(s.countries);
    g.font = F(800, px(36)); g.fillStyle = P16N.잉크;
    g.fillText(수, tx, ty);
    const nw = g.measureText(수).width;
    g.font = F(700, px(16));
    g.fillText('개국', tx + nw + px(3), ty);
    ty -= px(33);                      /* 큰 수의 대문자 높이(36 × .72) + 여유 */
    g.font = F(500, px(9)); g.fillStyle = P16N.흐림;
    g.fillText('지금까지 다녀온 나라', tx, ty);
  }

  /* ══ 무엇을 넣을지 — 높이 비율로(성향 카드와 같은 셈) ═══════════════
     스토리 — 대륙 여섯(한 줄씩) · 가장 많이 간 나라 셋 · 모은 깃발(제목)
     세로   — 대륙 여섯(두 칸씩 석 줄) · 깃발(가는 선만)
     정사각 — 깃발만. 히어로가 3분의 2 를 먹어 남는 것이 58(시안 px)뿐입니다. */
  const 조각 = [];
  if (꼴 === '스토리'){
    if (대륙.length) 조각.push({ h: 대륙.length * 22 + (대륙.length - 1) * 5, 그리기: 대륙한줄씩 });
    if (셋.length) 조각.push({ h: 1 + 8 + 13 + 6 + 22, 그리기: 셋그리기 });
  } else if (꼴 === '세로' && 대륙.length){
    const 줄 = Math.ceil(대륙.length / 2);
    조각.push({ h: 줄 * 22 + (줄 - 1) * 6, 그리기: 대륙두칸씩 });
  }
  /* 깃발 위에 얹는 것 — 스토리는 선 + 제목, 세로는 선만, 정사각은 없음 */
  const 깃발머리 = !n ? 0 : 꼴 === '스토리' ? 1 + 8 + 13 + 6 : 꼴 === '세로' ? 1 + 10 : 0;

  const 바닥높이 = px(42);
  const 위 = hy + hh + px(12);
  const 아래 = PY + PH - 바닥높이 - px(8);
  /* 넘치면 조각만 줄입니다(히어로는 원본 비라 못 줄입니다). 깃발 한 줄
     (가장 작은 칸, 10)은 남깁니다. 지금 세 크기는 모두 1 입니다. */
  const 필요 = 조각.reduce((a, b) => a + b.h + 9, 0) + 깃발머리;
  const k = 필요 ? Math.min(1, (아래 - 위 - px(n ? 10 : 0)) / px(필요)) : 1;
  const bx = v => px(v) * k;

  /* 자리부터 잡습니다 — 깃발 칸 크기를 알아야 그 크기로 그림을 굽고,
     캔버스 그리기는 동기라 그리는 중에는 기다릴 수 없습니다. */
  const 자리 = [];
  let y = 위;
  for (const c of 조각){ 자리.push(y); y += bx(c.h + 9); }
  const 깃발y = y, gy = 깃발y + bx(깃발머리);
  const 칸 = n ? 깃발칸(n, 폭, 아래 - gy, px) : null;
  const 보일 = !칸 ? 0 : 칸.넘침 ? 칸.칸 * 칸.줄 - 2 : n;

  await flagSprite();
  const 굽는폭 = Math.ceil(Math.max(칸 ? 칸.w : 0, 꼴 === '스토리' ? bx(30) : 0));
  const 받을것 = [...new Set([...코드.slice(0, 보일),
                           ...(꼴 === '스토리' ? 셋.map(t => t[2]) : [])])].filter(Boolean);
  const 깃발 = new Map(await Promise.all(
    받을것.map(async c => [c, await 깃발그림(c, 굽는폭)])));

  조각.forEach((c, i) => c.그리기(자리[i]));
  if (칸) 깃발벽();

  기로바닥(g, PX, PY, PW, PH, 바닥높이, px, F, '나의 여행 지도 만들기');

  /* 조각 위의 가는 선 — 성향 카드와 같습니다. */
  function 윗선(y0){
    g.fillStyle = P16N.선; g.fillRect(좌, y0, 폭, Math.max(1, bx(.8)));
  }

  /* ── 대륙 한 줄 ── 성향 카드의 축 줄과 **같은 치수**입니다(이름 · 작은
     뜻 · 먹색 막대 · 값). 작은 뜻 자리에 분모를 씁니다. */
  function 대륙하나([이름, 총, 수], x0, x1, ry, 이름폭, 틈){
    g.textAlign = 'left';
    g.font = F(800, bx(10.5)); g.fillStyle = P16N.잉크;
    g.fillText(이름, x0, ry + bx(10));
    g.font = F(500, bx(8)); g.fillStyle = P16N.흐림;
    g.fillText(`${총}개국 중`, x0, ry + bx(20));
    const 왼 = x0 + bx(이름폭 + 틈), 오 = x1 - bx(18 + 틈);
    const th = bx(5), ty0 = ry + bx(11) - th / 2;
    g.fillStyle = P16N.홈; g.fillRect(왼, ty0, 오 - 왼, th);
    g.fillStyle = P16N.잉크;
    g.fillRect(왼, ty0, (오 - 왼) * Math.max(0, Math.min(1, 총 ? 수 / 총 : 0)), th);
    /* 0 은 흐리게 — 「아직 안 간 대륙」이 눈에 걸리되 숫자가 주인공처럼 서지 않게 */
    g.font = F(800, bx(11)); g.textAlign = 'right';
    g.fillStyle = 수 ? P16N.잉크 : P16N.아주흐림;
    g.fillText(String(수), x1, ry + bx(15));
    g.textAlign = 'left';
  }
  function 대륙한줄씩(y0){
    대륙.forEach((d, i) => 대륙하나(d, 좌, 우, y0 + bx(i * (22 + 5)), 58, 10));
  }
  /* 세로(1350)는 높이가 모자라 두 칸씩 석 줄로 접습니다(시안 ㈂). */
  function 대륙두칸씩(y0){
    const 칸폭 = (폭 - px(16)) / 2;
    대륙.forEach((d, i) => {
      const x0 = 좌 + (i % 2) * (칸폭 + px(16));
      대륙하나(d, x0, x0 + 칸폭, y0 + bx(Math.floor(i / 2) * (22 + 6)), 50, 7);
    });
  }

  /* ── 가장 많이 간 나라 셋 ── 성향 카드의 궁합 자리. 깃발 · 이름 · N도시 */
  function 셋그리기(y0){
    윗선(y0);
    g.font = F(800, bx(11)); g.fillStyle = P16N.잉크; g.textAlign = 'left';
    g.fillText('가장 많이 간 나라', 좌, y0 + bx(1 + 8 + 10));
    const top = y0 + bx(1 + 8 + 13 + 6);
    const 칸폭 = (폭 - px(20)) / 3;
    const fw = bx(30), fh = fw * 26 / 36;
    셋.forEach(([이름, 수, c], i) => {
      const x0 = 좌 + i * (칸폭 + px(10));
      const f = 깃발.get(c);
      if (f) 깃발놓기(g, f, x0, top, fw, fh);
      else { g.fillStyle = P16N.홈; g.fillRect(x0, top, fw, fh); }
      const lx = x0 + fw + bx(7), lw = 칸폭 - fw - bx(7);
      g.font = F(800, bx(10.5)); g.fillStyle = P16N.잉크;
      g.fillText(줄여쓰기(g, 이름, lw), lx, top + bx(9.5));
      g.font = F(500, bx(8)); g.fillStyle = P16N.흐림;
      g.fillText(`${수}도시`, lx, top + bx(19.5));
    });
  }

  /* ── 모은 깃발 ── 성향 카드의 추천 자리. 많이 간 나라부터(부르는 쪽 차례). */
  function 깃발벽(){
    if (꼴 === '스토리'){
      윗선(깃발y);
      const by = 깃발y + bx(1 + 8 + 10);
      g.font = F(800, bx(11)); g.fillStyle = P16N.잉크; g.textAlign = 'left';
      g.fillText('모은 깃발 ', 좌, by);
      const tw = g.measureText('모은 깃발 ').width;
      g.fillStyle = P16N.주황; g.fillText(String(n), 좌 + tw, by);
    } else if (꼴 === '세로') 윗선(깃발y);
    const 자리xy = i => [좌 + (i % 칸.칸) * (칸.w + 칸.틈),
                        gy + Math.floor(i / 칸.칸) * (칸.h + 칸.틈)];
    for (let i = 0; i < 보일; i++){
      const [x, yy] = 자리xy(i);
      const f = 깃발.get(코드[i]);
      if (f) 깃발놓기(g, f, x, yy, 칸.w, 칸.h);
      else { g.fillStyle = P16N.홈; g.fillRect(x, yy, 칸.w, 칸.h); }
    }
    if (칸.넘침){
      const [x, yy] = 자리xy(보일), bw = 칸.w * 2 + 칸.틈;
      g.fillStyle = P16N.홈; g.fillRect(x, yy, bw, 칸.h);
      g.font = F(800, 칸.h * .72); g.fillStyle = P16N.흐림; g.textAlign = 'center';
      g.fillText(`+${n - 보일}`, x + bw / 2, yy + 칸.h * .75);
      g.textAlign = 'left';
    }
  }

  return new Promise(r => cv.toBlob(r, 'image/png'));
}

/* 카드 하나를 그림 파일로. 화면 카드와 같은 내용, 같은 색, 같은 아이콘입니다. */
/* 내보내는 이유는 하나입니다 — **자가검사가 실제로 그려봐야 하기 때문입니다.**
   화면 없이 blob 이 나오는지, 그림이 깨져도 카드가 나오는지를 봅니다. */
export async function cardImage(spec, mode = 'square'){
  const { w:W, h:H } = IMG_SIZES[mode] || IMG_SIZES.square;
  const ok = await ensureFont();
  /* 화면(app.css 의 --sf)과 **같은 이름을 같은 순서로** 씁니다(b411) —
     둘이 어긋나면 한 폰 안에서 화면과 카드의 글씨체가 갈립니다. */
  const fam = ok ? `"Pretendard Variable", Pretendard, -apple-system, sans-serif`
                 : '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const F = (weight, px) => `${weight} ${px}px ${fam}`;

  /* ⚠ **성향 16유형 카드는 딴 그림입니다**(b381). 여기서 갈라집니다.
     아래 원래 그림(리포트·지도·성향 옛 카드가 같이 씁니다)은 손대지 않습니다 —
     한 그림에 두 레이아웃을 욱여넣으면 둘 다 고치기 어려워집니다.
     **갈래만 트면 저장·공유·크기 시트가 그대로 붙습니다** —
     `saveCardImage` 도 `askImageSize` 도 이 함수의 결과만 봅니다. */
  if (spec && spec.kind === 'p16')
    return { blob: await drawP16(spec, W, H, F), fontOk: ok };
  /* 발자국 카드(여권 스탬프 면). 성향 카드와 **같은 틀**입니다(b776, 위 drawStamps 머리말). */
  if (spec && spec.kind === 'stamps')
    return { blob: await drawStamps(spec, W, H, F), fontOk: ok };
  /* 여행 영수증. 성향 카드와 **일부러 다른 그림**입니다(위 drawReceipt 머리말). */
  if (spec && spec.kind === 'receipt')
    return { blob: await drawReceipt(spec, W, H, F), fontOk: ok };

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  /* ── 배경 ────────────────────────────────────────────────────────
   * **사진이 있으면 사진이 배경입니다.** 전에는 단색 그러데이션 위에 글자만
   * 얹었는데, 그러면 볼 것이 없어서 아무도 안 올립니다. 이 앱이 가진 제일
   * 좋은 자산은 도시 사진이고, 카드에서 그걸 안 쓰고 있었습니다.
   * 사진이 없으면(도시 사진이 아직 없는 곳) 예전 그러데이션으로 돌아갑니다 —
   * 카드가 안 나오는 것보다 낫습니다. */
  const [c1, c2] = GRAD[spec.g] || GRAD.even;
  /* ── 바탕 ────────────────────────────────────────────────────────
   * ⚠ **두 색 사선 그러데이션을 버렸습니다(b314).** 배너처럼 보였고,
   *   특히 금색(size)에서 촌스러웠습니다. 색 두 개가 화면을 가득 채우면
   *   그 자체가 볼거리인 줄 알지만 실은 아무것도 아닙니다.
   * 깊은 잉크 위에 유형 색을 **한쪽 구석에서 옅게 번지게** 합니다.
   * 어두운 바탕은 흰 글자와 지도를 그대로 살려주고, 번지는 색 하나로
   * 유형이 갈립니다. 색은 배경이 아니라 **악센트**여야 합니다. */
  const paintGrad = () => {
    g.fillStyle = '#0E1116'; g.fillRect(0, 0, W, H);
    const r = g.createRadialGradient(W * .12, H * .08, 0, W * .12, H * .08, H * .95);
    r.addColorStop(0, c2); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = .42; g.fillStyle = r; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    void c1;
  };

  let photoOk = false;
  if (spec.photo){
    const ph = await photoImage(spec.photo);
    if (ph){
      /* 잘라서 꽉 채웁니다(cover). 늘려서 채우면 사람도 건물도 일그러집니다. */
      const s = Math.max(W / ph.width, H / ph.height);
      const dw = ph.width * s, dh = ph.height * s;
      g.drawImage(ph, (W - dw) / 2, (H - dh) / 2, dw, dh);

      /* ── 듀오톤 ────────────────────────────────────────────────────
       * 사진을 **날것으로 쓰지 않습니다.** 469곳 사진은 출처가 제각각이라
       * 어떤 건 좋고 어떤 건 흐리고 색이 튑니다. 그 편차가 그대로 나오면
       * 카드마다 품질이 달라 보이고, 그게 제일 아마추어처럼 읽힙니다.
       *
       * 밝기만 남기고(흑백) 두 색 사이로 다시 칠합니다 —
       * 어두운 곳은 잉크, 밝은 곳은 그 카드의 색. 그러면
       *   · 흐린 사진도 **의도한 톤**으로 읽히고
       *   · 카드마다 인상이 같아 **브랜드**로 보이고
       *   · 흰 글자 대비가 늘 확보됩니다(밝은 하늘 위에서 글자가 묻히던 것)
       * 좋은 사진이 필요한 게 아니라 **같은 처리**가 필요합니다.
       *
       * ⚠ **완전한 듀오톤으로 갔다가 물렸습니다(b305 → b313).**
       *   밝은 쪽을 유형 색(size 는 금색 #d4af37)으로 물들였더니
       *   **세피아 필터**가 됐습니다 — 대구 사진이 거의 안 보이고 오래된
       *   사진 앱처럼 읽혔습니다. 금색은 중간 밝기라 사진을 뭉개기만 하고
       *   대비를 못 만듭니다.
       *
       * 지금은 **채도만 절반 뺍니다.** 화질 편차를 누르는 효과는 그대로면서
       * 사진이 사진으로 보입니다. 유형별 색은 카드를 통째로 물들이는 대신
       * 큰 숫자에만 남깁니다 — 그래야 유형도 갈리고 사진도 삽니다.
       * 캔버스 합성으로 합니다(픽셀을 하나씩 만지면 1080×1350 에서 느립니다). */
      g.globalAlpha = .5;
      g.globalCompositeOperation = 'saturation';
      g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      /* **글자가 읽히려면 사진을 눌러야 합니다.** 위는 살짝, 아래는 깊게 —
         글자가 아래쪽에 모여 있고 위쪽은 사진을 보여주는 자리입니다. */
      /* **처음 값으로는 글자가 사진에 묻혔습니다.** 방콕 사진으로 그려보니
         밝은 하늘과 금색 지붕 위에서 흰 글씨가 읽히질 않았습니다.
         글자가 앉는 아래 절반을 훨씬 깊게 누릅니다 — 위쪽은 사진을
         보여주는 자리라 그대로 둡니다. */
      const sc = g.createLinearGradient(0, 0, 0, H);
      sc.addColorStop(0,   'rgba(0,0,0,.30)');
      sc.addColorStop(.30, 'rgba(0,0,0,.16)');
      sc.addColorStop(.52, 'rgba(0,0,0,.58)');
      sc.addColorStop(.78, 'rgba(0,0,0,.84)');
      sc.addColorStop(1,   'rgba(0,0,0,.94)');
      g.fillStyle = sc; g.fillRect(0, 0, W, H);
      /* ⚠ **유형 색을 카드 전체에 덮던 것을 걷었습니다.**
         .18 이면 옅어 보이지만, 채도를 뺀 사진 위에 얹히면 화면 전체가
         그 색으로 물듭니다 — 세피아가 된 원인의 절반이 이것이었습니다.
         카드마다 인상을 가르는 일은 **사진**이 합니다. 사진이 서로
         다른데 색까지 덮을 이유가 없습니다. */
      photoOk = true;
    }
  }
  if (!photoOk) paintGrad();

  /* ── 그림 한 장은 **배경**으로 깝니다 ────────────────────────────
   * 지금은 다녀온 나라가 칠해진 세계지도입니다. 폭보다 조금 넓게 잡아
   * 양옆이 화면 밖으로 나가게 두면 잘린 지도가 아니라 **큰 그림의 일부**로
   * 읽힙니다. 위쪽에 놓는 이유는 글자가 아래에서부터 쌓이기 때문입니다.
   * 흐리게(.5) 까는 것은 글자를 살리려는 것이기도 하지만, 또렷하면
   * 지도가 주인공이 되어 숫자가 안 읽힙니다. 배경은 배경이어야 합니다. */
  if (spec.art){
    const art = await svgImage(spec.art);
    if (art){
      const aw = W * 1.08, ah = aw * (spec.artRatio || 0.387);
      g.globalAlpha = .5;
      g.drawImage(art, (W - aw) / 2, H * .15, aw, ah);
      g.globalAlpha = 1;
    }
  }

  /* **왼쪽 정렬입니다.** 전부 가운데로 모으면 어디부터 볼지가 없어서
     글자 덩어리로 보입니다. 왼쪽에 세로선을 하나 만들어 두면 눈이
     위에서 아래로 흐릅니다 — 상용 앱 카드가 거의 다 이렇습니다. */
  g.textAlign = 'left'; g.fillStyle = '#fff';
  const pad = 88, maxW = W - pad * 2, cx = pad;

  /* 그릴 것을 먼저 줄 단위로 만들어 높이를 잰 다음, 그 덩어리를 가운데에 놓습니다.
     위에서부터 그냥 쌓으면 내용이 짧을 때 아래가 텅 빕니다 —
     특히 세로로 긴 스토리에서 심하게 티가 납니다. */
  const items = [];
  const add = (h, draw) => items.push({ h, draw });

  /* 맨 위 작은 말머리. 무슨 카드인지 한 줄로 알려줍니다 —
     제목만 크게 있으면 "여권이 두꺼운 사람"이 무슨 앱 이야기인지 모릅니다. */
  if (spec.sub) add(64, y => {
    g.font = F(600, 30); g.globalAlpha = .8;
    /* 자간을 벌려 라벨처럼 보이게 합니다. 캔버스에 letterSpacing 이 없는
       브라우저가 있어 한 글자씩 그립니다. */
    let x = cx;
    for (const ch of String(spec.sub)){ g.fillText(ch, x, y + 30); x += g.measureText(ch).width + 3; }
    g.globalAlpha = 1;
  });

  /* ── 시간 ──────────────────────────────────────────────────────────
   * 카드에 시간이 하나도 없었습니다. 시간이 없으면 기록이 아니라 성적표입니다.
   * '2026.08.13 기준' 보다 **'첫 기록으로부터 1,247일'** 이 훨씬 셉니다 —
   * 앞의 것은 만든 날짜고 뒤의 것은 그 사람이 쌓아온 시간입니다.
   * 명조로 흐리게. 위의 라벨(여행 성향)과 아래 큰 숫자 사이에서 숨을 쉽니다. */
  if (spec.date) add(52, y => {
    g.font = `400 30px ${SERIF}`; g.globalAlpha = .55;
    g.fillText(spec.date, cx, y + 32); g.globalAlpha = 1;
  });

  /* **아이콘을 크게 넣던 것을 뺐습니다.** 176px 짜리 선 아이콘 하나가
     카드 한복판을 차지했는데, 그건 '자리 채우는 그림'이지 볼거리가
     아닙니다. 사진이 배경이 된 지금은 더 그렇습니다.
     사진이 없어 그러데이션으로 갈 때만 작게 남깁니다 — 그때는 정말로
     아무것도 없기 때문입니다. */
  if (!photoOk){
    const icon = await iconImage(spec.icon || '', 96);
    if (icon) add(96 + 32, y => g.drawImage(icon, cx, y, 96, 96));
  }

  /* 그림 한 장(지금은 발자국 세계지도). **화면에 그려져 있는 것을 그대로 받습니다** —
     어느 나라를 칠할지 여기서 다시 정하면 화면과 어긋납니다.
     비율은 부르는 쪽이 줍니다(세계지도는 1000×387). */
  /* ⚠ **지도는 이제 배경입니다(b315).** 여기 줄로 끼워 넣었더니 높이가
     394px 이라 아래 내용을 통째로 밀어냈고, 왼쪽 아래에서 도시 목록과
     서명(기로)이 **겹쳤습니다.** 위 배경 단계에서 크게 깔고 글자는 그 위로
     올립니다 — 겹칠 자리가 없어지고 포스터처럼 읽힙니다. */

  /* **주인공은 큰 숫자 하나입니다.** 예전에는 '27개국 · 49도시'가 제목 밑에
     작은 한 줄로 붙어 있었습니다. 그러면 훑는 사람 눈에 아무것도 안 남습니다.
     Wrapped 도 Strava 도 숫자 하나를 화면만 하게 키웁니다. */
  if (spec.big) add(190, y => {
    g.font = F(700, 168);
    g.fillText(spec.big, cx, y + 150);
    if (spec.bigUnit){
      const w = g.measureText(spec.big).width;
      g.font = F(600, 48); g.globalAlpha = .85;
      g.fillText(spec.bigUnit, cx + w + 16, y + 150); g.globalAlpha = 1;
    }
  });

  g.font = F(700, 76);
  const lines = wrapText(g, spec.title, maxW);
  add(lines.length * 94 + 16, y => {
    g.font = F(700, 76);
    lines.forEach((line, i) => g.fillText(line, cx, y + 72 + i * 94));
  });

  if (spec.nums) add(64, y => {
    g.font = F(400, 40); g.globalAlpha = .9;
    g.fillText(spec.nums, cx, y + 40); g.globalAlpha = 1;
  });
  /* ⚠⚠ **한 줄로 그리면 카드 밖으로 잘립니다(b509).** ⚠⚠
     다녀온 나라 카드가 국기를 스물여덟 개 이어 붙여 보냈는데, 그대로
     한 줄로 찍어서 오른쪽이 통째로 잘려 나갔습니다(실기기 사진).
     바로 위 제목은 이미 wrapText 로 접고 있었는데 이 줄만 안 썼습니다 —
     **같은 판에 그리는 글은 같은 도구로 접어야 합니다.**
   ⚠ 두 줄까지입니다. 그보다 길면 국기가 카드의 주인공이 되어 버립니다.
     잘린 줄에는 말줄임표를 답니다 — 소리 없이 자르면 「다 나온 것」으로
     읽힙니다. */
  if (spec.note){
    g.font = F(400, 32);
    let 줄 = wrapText(g, spec.note, maxW);
    if (줄.length > 2) 줄 = [줄[0], 줄[1] + ' …'];
    add(줄.length * 44 + 10, y => {
      g.font = F(400, 32); g.globalAlpha = .72;
      줄.forEach((t, i) => g.fillText(t, cx, y + 32 + i * 44));
      g.globalAlpha = 1;
    });
  }

  /* ── 그 사람이 쓴 문장 ─────────────────────────────────────────────
   * 카드에 있는 것이 전부 숫자였습니다. 숫자는 자랑이지 감성이 아닙니다.
   * 이 앱에는 **그 사람이 직접 쓴 한줄평**이 있습니다 — 남의 사진도 아니고
   * 통계도 아닌 자기 문장이 박히면 그게 감성입니다.
   * **명조로 씁니다.** 위아래가 전부 고딕이라 여기만 명조면 그 대비가
   * 문장을 따옴표처럼 감쌉니다.
   * 없으면 안 그립니다 — 억지로 채우면 그게 더 허전합니다. */
  if (spec.quote?.text){
    g.font = `400 52px ${SERIF}`;
    const qs = wrapText(g, `“${spec.quote.text}”`, maxW).slice(0, 3);
    const from = spec.quote.from || '';
    add(28 + qs.length * 74 + (from ? 56 : 0), y => {
      g.font = `400 52px ${SERIF}`;
      qs.forEach((line, i) => g.fillText(line, cx, y + 56 + i * 74));
      if (from){
        g.font = `400 26px ${SERIF}`; g.globalAlpha = .6;
        g.fillText('— ' + from, cx, y + 56 + qs.length * 74 + 18);
        g.globalAlpha = 1;
      }
    });
  }

  if (spec.list?.length){
    const list = spec.list.slice(0, 3);
    add(36 + 46 + list.length * 58, y => {
      g.font = F(600, 28); g.globalAlpha = .65;
      g.fillText(spec.listTitle || '', cx, y + 62); g.globalAlpha = 1;
      g.font = F(500, 40);
      list.forEach((item, i) =>
        g.fillText(wrapText(g, item, maxW)[0], cx, y + 124 + i * 58));
    });
  }

  const total = items.reduce((s, it) => s + it.h, 0);
  /* **아래에서부터 쌓습니다.** 가운데에 모으면 사진 한복판을 글자가 가려서
     배경이 무슨 사진인지 안 보입니다. 위쪽은 사진에게 주고 글자는 아래로
     내립니다 — 어차피 사진 아래쪽이 제일 어두워서 거기가 제일 잘 읽힙니다.
     짧은 카드가 바닥에 붙지 않도록 위쪽 여백만 지켜줍니다. */
  const footer = 150;                     /* 앱 이름·주소가 차지하는 자리 */
  let y = Math.max(pad, H - footer - total);
  for (const it of items){ it.draw(y); y += it.h; }

  /* 앱 이름은 구석에 작게. 크게 넣으면 광고처럼 보입니다.
     **주소를 같이 적습니다.** 전에는 이름만 있었는데, 이 앱은 앱스토어에 없는
     PWA 라 그 이름으로는 아무 데서도 검색이 안 됩니다 — 카드를 보고 궁금해진
     사람이 갈 곳이 없었습니다. 이름보다 더 흐리게 둬서 광고처럼 안 보이게 합니다. */
  /* **왼쪽 아래 한 줄로 모읍니다.** 이름과 주소를 위아래로 떼어 놓으니
     둘 다 작고 흐려서 어느 쪽도 안 읽혔습니다. 한 줄에 붙여 놓으면
     "기로 · 주소" 가 하나의 서명처럼 읽힙니다.
     사진 위에 얹히므로 얇은 그림자를 깔아 어떤 사진에서도 읽히게 합니다. */
  /* **정말로 한 줄에 붙입니다.** 앞서 이름을 H-72, 주소를 H-54 에 뒀는데
     34px·28px 글자가 18px 간격이면 겹칩니다 — 실제로 겹쳐서 나왔습니다.
     이름을 그리고 그 폭만큼 옮겨 주소를 이어 붙입니다. */
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 14; g.shadowOffsetY = 1;
  /* ── 서명은 **Dongle** 로 ────────────────────────────────────────
   * 워드마크 글꼴인데 카드에서는 안 쓰고 있었습니다. 앱 상단바는 Dongle 인데
   * 카드 서명만 고딕이라 둘이 남처럼 보였습니다. 여기서 한 번 쓰면 브랜드가
   * 따뜻하게 이어집니다.
   * Dongle 은 아주 납작해서 1.9배로 키워야 제 크기가 나옵니다(34 → 65).
   * **안 실렸으면 고딕으로 그립니다** — 그때 65px 을 쓰면 글자가 밖으로
   * 나갑니다(스플래시에서 겪은 것과 같은 함정). */
  const dongle = document.fonts?.check?.('700 1em Dongle');
  g.font = dongle ? '700 65px Dongle, sans-serif' : F(700, 34);
  g.globalAlpha = .96;
  g.fillText('기로', cx, H - 62);
  g.globalAlpha = 1;

  /* ── 맺음말 ────────────────────────────────────────────────────────
   * 통계 카드를 포스터로 바꾸는 한 줄입니다. 앱 첫 화면과 같은 말이라
   * 카드를 본 사람이 앱을 열었을 때 같은 목소리로 이어집니다.
   * 명조로, 아주 흐리게 — 읽으라고 넣은 것이 아니라 **여운**입니다. */
  g.font = `400 26px ${SERIF}`; g.globalAlpha = .42;
  g.fillText('기록이 길이 되다', cx, H - 26);
  g.globalAlpha = 1;
  g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;

  /* ── 필름 그레인 ────────────────────────────────────────────────────
   * 평평한 디지털 그러데이션은 차갑습니다. 아주 고운 노이즈를 얹으면
   * 인쇄물이나 필름처럼 읽힙니다 — 어두운 바탕에서 특히 잘 먹습니다.
   * ⚠ 1080×1350 픽셀을 하나씩 만지면 느립니다. 작은 조각(160×160)에 한 번만
   *   찍어두고 그것을 타일처럼 반복해 깝니다(재봄: 눈에 안 띄는 시간).
   * 아주 옅게(.055) 얹습니다. 보이면 그건 노이즈고, 안 보여야 질감입니다. */
  try {
    const gs = 160;
    const gc = document.createElement('canvas'); gc.width = gc.height = gs;
    const gg = gc.getContext('2d');
    const im = gg.createImageData(gs, gs);
    for (let i = 0; i < im.data.length; i += 4){
      const v = 128 + (Math.random() * 2 - 1) * 110;
      im.data[i] = im.data[i+1] = im.data[i+2] = v; im.data[i+3] = 255;
    }
    gg.putImageData(im, 0, 0);
    g.globalAlpha = .055;
    g.globalCompositeOperation = 'overlay';
    const pat = g.createPattern(gc, 'repeat');
    g.fillStyle = pat; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  } catch {}   /* 질감 하나 때문에 카드를 못 만들면 안 됩니다 */

  /* ⚠ **PNG 가 아니라 JPEG 입니다(b317).** 필름 그레인을 얹으면서 파일이
     2MB 가 됐습니다 — 노이즈는 무손실 압축이 제일 못 줄이는 것입니다.
     사진 같은 그림이라 투명도가 필요 없고, .92 면 글자 가장자리도 멀쩡합니다.
     재봄: 2,098KB → 아래 참고. */
  return { blob: await new Promise(r => cv.toBlob(r, 'image/jpeg', .92)), fontOk: ok };
}

/* 저장하거나 공유합니다. 휴대폰은 공유창으로 넘기는 편이 훨씬 빠릅니다 —
   내려받기 폴더를 찾아 들어갈 필요가 없습니다. */
async function saveCardImage(spec, mode, name){
  toast('이미지 만드는 중…');
  const { blob, fontOk } = await cardImage(spec, mode);
  return sendCardBlob(blob, spec, name, fontOk);
}

/* ── 만든 그림을 보냅니다 ────────────────────────────────────────────
 * ⚠ **`saveCardImage` 에서 갈라냈습니다(b498).** 미리보기 시트가 **이미
 *   그려둔 blob** 을 그대로 보내야 하기 때문입니다 — 거기서 다시 그리면
 *   미리보기와 보내는 것이 갈릴 수 있고 1초를 또 기다립니다.
 *   보내는 규칙(주소 같이 넘기기·글로 떨어지기·마지막에 내려받기)은
 *   한 곳에만 있어야 합니다. */
async function sendCardBlob(blob, spec, name, fontOk = true){
  /* 확장자는 blob 이 정합니다 — 성향 카드는 글자와 단색 위주라 PNG 로 나옵니다.
     .jpg 로 이름만 붙여 보내면 공유창에서 거부하는 앱이 있습니다. */
  const ext = blob.type === 'image/png' ? '.png' : '.jpg';
  const file = new File([blob], name + ext, { type: blob.type || 'image/jpeg' });
  if (navigator.canShare?.({ files:[file] })){
    /* **주소를 같이 넘깁니다.** 전에는 `{files, title}` 만 보내서, 카톡으로
       보내면 그림만 가고 링크가 없었습니다. 받은 사람이 궁금해도 갈 곳이
       없으니 공유가 유입으로 이어질 수가 없었습니다.
       받는 앱이 글을 버리는 경우도 있어서 **그림 안에도 주소를 적어**
       뒀습니다(위 cardImage) — 둘 중 하나는 남습니다. */
    /* 체크 카드가 쓰던 `spec.shareUrl`(받은 사람을 같은 24칸으로 떨구는
       길)은 그 카드를 없애면서 같이 걷었습니다(b507). 남는 길은 앱 주소
       하나입니다. */
    const url = appUrl();
    /* 같이 가는 글(b822) — 카드가 «권하는 말»(`shareLine`)을 주면 그것을 씁니다. 성향 카드는 「너의 여행 성향도
       확인해봐」를 줍니다(persona.js) — 받은 사람이 링크를 누를 까닭이 생깁니다. 안 주는 카드는 예전 그대로. */
    const share = { files:[file], title: spec.title,
                    text: spec.shareLine || `${spec.title} · 기로`, url };
    /* url·text 를 못 받는 기기가 있습니다. 그때는 그림만이라도 보냅니다 —
       여기서 실패하면 아래 내려받기로 떨어져서 공유 자체를 못 하게 됩니다. */
    const payload = navigator.canShare(share) ? share : { files:[file], title: spec.title };
    try { await navigator.share(payload); return; }
    catch (e){ if (e?.name === 'AbortError') return; }
  }
  /* ── 그림을 못 보내는 기기 ─────────────────────────────────────────
   * ⚠ **전에는 여기서 곧장 내려받기로 떨어졌습니다.** 그런데 공유를 누른
   *   사람이 원한 것은 파일이 아니라 **보내는 것**입니다. 그림이 안 되면
   *   글이라도 보내는 편이 낫습니다 — 카드에 적힌 것이 글에도 있습니다.
   *   내려받기는 그것마저 안 될 때의 마지막 수단으로 내립니다. */
  if (spec.shareText && navigator.share){
    try { await navigator.share({ title: spec.title, text: spec.shareText,
                                  url: appUrl() }); return; }
    catch (e){ if (e?.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name + ext;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(fontOk ? '이미지를 저장했어요' : '저장했어요. (글꼴을 못 받아 기본 글꼴로 그렸어요)');
}

/* 어느 크기로 뽑을지 묻습니다. 피드와 스토리는 비율이 아주 달라서
   하나로 뽑아두면 한쪽은 잘리거나 여백이 크게 남습니다. */
/* ── 카드를 공유합니다 ────────────────────────────────────────────────
 * ⚠ **전에는 크기를 먼저 물었습니다 — 세로·정사각·스토리 셋(b393 에서 걷음).**
 *   물을 값어치가 없었습니다. 정사각은 세로가 있으면 고를 이유가 없고
 *   (인스타 피드에서 세로가 화면을 더 먹습니다), 남은 둘 중 실제로 올리는
 *   곳은 **스토리 하나**입니다 — 피드에 올리는 사람이 없습니다.
 *   묻는 창이 하나 줄어서 공유하기 → 바로 공유창이 됩니다.
 *
 * ⚠ **단추도 하나로 합쳤습니다.** 「이미지로 저장」과 「공유」가 따로 있었는데,
 *   공유 쪽은 글만 보내고 저장 쪽은 **그림·글·주소를 다** 보냈습니다.
 *   앞엣것이 뒤엣것을 통째로 포함하니 더 나은 쪽만 남깁니다.
 *
 * 트레이드오프 하나는 알고 있습니다: 9:16 은 **카톡 대화에서 세로로 길게
 * 잘려** 보입니다(눌러야 다 보입니다). 스토리에 올리는 것이 주 용도라
 * 감수합니다. 되돌리려면 아래 'story' 를 'portrait' 로 바꾸면 됩니다. */
/* ── 미리보기 시트(b498) ──────────────────────────────────────────────
 * **전에는 결과를 못 보고 보냈습니다.** 「공유하기」를 누르면 1초 그리고
 * 바로 공유창이 떠서, 어떻게 나올지 모르는 채로 나갔습니다. 발자취 앱이
 * 저장 전에 미리보기와 옵션을 주는 것을 보고 같은 자리를 만듭니다.
 *
 * ⚠ **옵션은 「배경」 하나뿐입니다.** 저쪽은 넷을 주는데(내용·배경·정렬·
 *   대비) 그쪽은 **카드가 한 종류**라 감당됩니다. 우리는 성향·영수증·
 *   체크 셋이고 각각 정보량이 다릅니다 — 셋에 넷씩 두면 결정이 열둘입니다.
 *   값어치가 제일 큰 하나만 둡니다.
 * ⚠ **그릴 때마다 다시 그립니다.** 투명은 캔버스를 처음부터 다르게 그리는
 *   것이라 나중에 못 벗겨냅니다.
 * ⚠ **`objectURL` 을 반드시 놓아줍니다.** 배경을 왔다 갔다 하면 매번 새
 *   blob 이 생깁니다 — 안 놓으면 그만큼 메모리에 쌓입니다. */
let 시트 = null;         /* 지금 열린 미리보기의 상태 */

async function 시트그리기(){
  const s = 시트; if (!s) return;
  const 판 = $('cs_view');
  판.innerHTML = `<div class="empty"><span class="load">그리는 중…</span></div>`;
  if (s.url){ URL.revokeObjectURL(s.url); s.url = null; }
  try {
    const { blob } = await cardImage(s.spec, 'story');
    if (시트 !== s) { return; }               /* 그 사이에 닫혔거나 다시 눌렸습니다 */
    s.blob = blob; s.url = URL.createObjectURL(blob);
    판.innerHTML = `<img src="${s.url}" alt="${esc(s.spec.title || '카드')}">`;
  } catch {
    판.innerHTML = `<div class="empty">그림을 못 만들었어요.</div>`;
  }
}

function 시트닫기(fromPop){
  const s = 시트; 시트 = null;
  if (s?.url) URL.revokeObjectURL(s.url);
  $('cardsheet')?.classList.add('hide');
  /* ⚠ **뒤로가기로 닫힐 때는 또 뒤로 가면 안 됩니다** — 두 칸 물러나
     엉뚱한 화면에 떨어집니다. closeSpree·closeReview 와 같은 수법입니다. */
  if (!fromPop && history.state?.t2 === 'cs') history.back();
}

export function shareCard(spec, name){
  const 판 = $('cardsheet');
  /* 시트가 없는 화면(옛 index.html)에서는 하던 대로 바로 보냅니다 —
     기능이 통째로 막히는 것보다 낫습니다. */
  if (!판) return saveCardImage(spec, 'story', name);
  시트 = { spec, name, url: null, blob: null };
  판.classList.remove('hide');
  /* ⚠⚠ **「배경 포함 / 투명」 줄을 걷었습니다(b775, 사용자: 「굳이
     투명판 없어도 될것 같아」).** ⚠⚠ 이 시트의 옵션은 그것 하나뿐이었습니다
     — 이제 미리보기와 「저장하기」만 남습니다.
     ⚠ 되살리려거든 index.html 의 #cardsheet 줄 · 여기 `시트.배경` · 아래
       #cs_bg 처리기 · 그리는 쪽의 투명 갈래 넷을 같이 되돌려야 합니다. */
  /* 뒤로 가기로 닫힙니다 — 안드로이드에서 시트를 뒤로가기로 못 닫으면
     앱을 나가게 됩니다. */
  if (history.state?.t2 !== 'cs') history.pushState({ t2:'cs' }, '');
  return 시트그리기();
}

/* 시트를 붙입니다. `#cardsheet` 이 있을 때만 — 없으면 위에서 안 씁니다. */
if (typeof document !== 'undefined' && $('cardsheet')){
  /* ⚠ **화살표로 감쌉니다.** 함수를 그대로 달면 click 이벤트가 첫 인자로
     들어가 fromPop 이 참이 되고, 히스토리가 안 물러납니다. */
  $('cs_x').addEventListener('click', () => 시트닫기());
  $('cardsheet').addEventListener('click', e => {
    /* 시트 «밖»(덮개)을 눌러도 닫힙니다. ::before 가 시트의 자식이라
       그 자리 클릭은 시트 자신을 대상으로 옵니다. */
    if (e.target === $('cardsheet')) 시트닫기();
  });
  $('cs_go').addEventListener('click', async () => {
    const s = 시트; if (!s?.blob) return;
    /* ⚠ **이미 그려둔 blob 을 보냅니다.** 여기서 다시 그리면 미리보기와
       보내는 것이 갈릴 수 있고, 1초를 또 기다립니다. */
    시트닫기();
    await sendCardBlob(s.blob, s.spec, s.name);
  });
  window.addEventListener('popstate', () => { if (시트) 시트닫기(true); });
}

/* 평생 누적 값. 별점을 매긴 도시만 셉니다 — "가보고 싶어요"는 간 곳이 아닙니다.
 *
 * **도시 목록을 받아서 씁니다.** 전에는 app.js 의 전역 cities · continentOf ·
 * countryName 을 그냥 집어 썼습니다. 그래서 이 셈은 앱 전체가 뜨고 도시까지
 * 다 받아진 뒤라야 한 번 돌려볼 수 있었습니다 — 즉 아무도 안 돌려봤습니다.
 * 받아서 쓰면 콘솔에서 손으로 만든 자료로도 돌아갑니다(__cardCheck). */
export function personaStats(rows, world = {}){
  const { cities = [], continentOf = {}, countryName = {} } = world;
  const rated = rows.filter(r => r.stars != null);
  const info = id => (cities || []).find(c => c.id === id);

  const byCountry = {}, byContinent = {};
  let fameSum = 0, fameN = 0, starSum = 0;
  let low = 0, high = 0;                    /* 1·2점과 4·5점 — 호불호 판정에 씁니다 */

  for (const r of rated){
    const c = info(r.city_id);
    starSum += Number(r.stars);
    if (Number(r.stars) <= 2) low++;
    if (Number(r.stars) >= 4) high++;
    if (!c) continue;
    byCountry[c.country] = (byCountry[c.country] || 0) + 1;
    const k = continentOf[c.country];
    if (k) byContinent[k] = (byContinent[k] || 0) + 1;
    if (c.fame != null){ fameSum += Number(c.fame); fameN++; }
  }
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const [topCountry, topCountryN] = top(byCountry);
  const [topContinent, topContinentN] = top(byContinent);
  const n = rated.length;

  return {
    cities: n,
    countries: Object.keys(byCountry).length,
    continents: Object.keys(byContinent).length,
    byCountry, byContinent,
    topCountry, topCountryN, topContinent, topContinentN,
    /* 나라 코드를 한국어 이름으로 바꾸는 것도 여기서 끝냅니다. 안 그러면
       아래 규칙표가 countryName 을 또 알아야 하고, 규칙표는 순수해야
       콘솔에서 그대로 돌려볼 수 있습니다. */
    topCountryName: countryName[topCountry] || topCountry,
    avgRating: n ? starSum / n : 0,
    /* 유명도를 모르는 도시는 평균에서 뺍니다. 0으로 치면 평균이 내려가
       "남들이 안 가는 곳"이 아닌데 그렇게 나옵니다. */
    avgFame: fameN ? fameSum / fameN : 0,
    citiesPerCountry: Object.keys(byCountry).length
      ? n / Object.keys(byCountry).length : 0,
    lowRatio: n ? low / n : 0,
    highRatio: n ? high / n : 0,
    wishCount: rows.filter(r => r.want).length,
    best: rated.filter(r => Number(r.stars) >= 4.5)
               .sort((a, b) => b.stars - a.stars)
               /* id 도 같이 넘깁니다 — 부르는 쪽이 그 도시의 사진을 찾아
                  카드 배경으로 씁니다. 이름만 주면 같은 이름을 다시 뒤져야 합니다. */
               .map(r => ({ id: r.city_id, name: info(r.city_id)?.name || r.city_id,
                            stars: r.stars }))
               .slice(0, 3),
  };
}

/* 위에서부터 검사해서 **처음 걸리는 것**을 씁니다. 순서가 곧 우선순위입니다.
 *
 * 문서의 순서(시작 → 특이 → 파고듦 → 별점 → 규모 → 계획)를 그대로 넣고 돌려보니
 * **규모 문구가 한 번도 안 나왔습니다.** 12개국부터 87개국까지 76가지를 다 넣어봤는데
 * 0번이었습니다. 나라가 늘면 대륙 수와 "지구 반대편"이 먼저 늘어서, 60개국을 다녀도
 * "대륙 순례자"에 걸리고 "세계를 절반쯤 본 사람"은 영영 안 뜹니다.
 *
 * 규모가 오히려 더 희소한 축이라 위로 올렸습니다.
 * 50개국은 4대륙보다 훨씬 드뭅니다. 12개국(size3)은 파고드는 유형 뒤에 뒀습니다 —
 * 12개국을 다니면서 한 나라를 깊게 파는 사람은 그쪽이 더 그 사람다운 설명입니다. */
/* ⚠ **문구는 카드의 얼굴입니다(b316 에 전면 교체).**
   전에는 열여덟 중 열둘이 '~하는 사람' 으로 끝났습니다. 그 반복이 카드를
   블로그 목록처럼 읽히게 만들었습니다. 제목은 설명이 아니라 **한마디 선언**
   이어야 합니다 — 인스타에 올라간 카드에서 사람들이 읽는 것은 그 한 줄뿐입니다.
   새로 쓸 때 지킬 것: 길어야 여덟 자, '사람' 으로 안 끝내기, 설명하지 말고
   말하기('남들이 안 가는 도시 매니아' → '아무도 안 가는 쪽'). */
/* ══ 여행 성향 16유형 (b381) ═════════════════════════════════════════
 * 도시 평가만으로 계산합니다. **AI 를 안 부릅니다** — 같은 자료면 언제나
 * 같은 답이 나와야 하고(리포트·성향 카드와 같은 규칙), 공짜여야 합니다.
 *
 * 축 넷을 0~100 으로 재고, 50 을 기준으로 글자 하나씩 골라 코드를 만듭니다.
 * **같은 값을 두 가지로 보여주는 것이 핵심입니다** — 코드는 방향(F/H),
 * 능력치 막대는 점수. 막대를 보면 왜 그 유형이 나왔는지 바로 보입니다.
 *
 * 순서는 개척 → 단골 → 모험 → 만족. 코드 글자 자리와 같습니다.
 *
 * ⚠ 아래 `lo`·`hi` 는 **한국인 기준으로 맞춘 값**입니다. 목표는 각 능력치의
 * 평균이 40~60 에 오는 것 — 한 항목이 대부분 90 이상이거나 10 이하로 나오면
 * 범위가 잘못된 것이니 그때 이 숫자만 고치면 됩니다. */

/* ⚠ `pScale` 과 `SEOUL` 은 **calc.js 로 옮겼습니다(b395).** rec.js 의
   닮은-도시 추천이 같은 자를 쓰기 때문입니다 — 여기 한 벌, 저기 한 벌이면
   한쪽 상수만 고쳐지고 "성향은 멀리(D) 라는데 추천은 가까운 데만 준다"
   같은 일이 조용히 생깁니다. 상수는 calc.js 에서 고치십시오. */

/* ── 국내는 네 축 중 **둘에서만** 뺍니다(b394) ────────────────────────
 * 단골력·모험력은 해외만, 개척력·만족력은 전부 셉니다.
 * 짐작이 아니라 재보고 가른 것입니다(매긴 곳 74 = 국내 24 + 해외 50):
 *
 *     개척 36→39 · 단골 37→13 · 모험 71→85 · 만족 26→27
 *
 * **단골력은 개념이 틀려 있었습니다.** 「제일 많이 간 나라 ÷ 전체」인데
 * 최다 나라가 한국(24/74)이라, 서울 사는 사람이 부산·강릉 간 것이
 * "한 나라만 파는 성향" 으로 읽혔습니다. 국내 여행은 애초에 **나라를
 * 고르는 행위가 아닙니다.** 24점 차이는 결과일 뿐 이유가 아닙니다.
 *
 * **모험력은 무게가 잘못됐습니다.** 국내 24곳의 평균 거리가 229km 인데
 * 이것이 9,000km 짜리와 똑같이 한 표씩 평균에 들어갑니다. 강릉 한 번이
 * 헬싱키 한 번을 상쇄합니다.
 *
 * **개척력·만족력은 그대로 둡니다.** 국내에서 숨은 곳을 찾아다니는 것도
 * 개척의 증거이고, 별점이 후한지 까다로운지는 어디서나 같은 사람의
 * 성질입니다(국내 ★3.56 · 해외 ★3.65 — 거의 같습니다). 3점·1점밖에
 * 안 움직이는데 표본 24개를 버릴 이유가 없습니다.
 *
 * ⚠ **여기만 고치면 안 됩니다.** 화면(persona.js)의 '왜 이 코드인가요' 가
 *   단골력 옆에 "한 나라당 몇 곳" 을 같이 보여줍니다. 그 숫자를 전체로
 *   두면 축은 해외로 세는데 근거는 전체로 적혀, 왜 그렇게 나왔는지
 *   따져보는 사람에게 앞뒤가 안 맞습니다. 그래서 아래에서 `나라당` 을
 *   같이 내보냅니다. */
const 국내 = 'KR';

/* 해외가 이보다 적으면 **나라 몰림**과 **거리**를 못 정한 것으로 두고 화면에서 밝힙니다.
   1곳이면 「제일 많이 간 나라 ÷ 전체」가 1.0 이라 단골력이 100 으로 튑니다 —
   해외 한 번 다녀온 사람이 '한 나라 순정파' 가 됩니다. 3곳이면 다 다른
   나라일 때 0.33(→M), 한 나라일 때 1.0(→L) 이라 비로소 갈립니다. */
const 해외문턱 = 3;

/* ══ 성향 v2 (2026-09-30) ══════════════════════════════════════════════
 * 사용자: 「성향은 여러번 똑같은 도시까지 녹일 수 있고 좀 더 다양성있게 로직을 짜보자」
 *   + 밖에서 받은 명세(KIRO_PERSONA_AND_ANALYTICS_ENHANCEMENT_SPEC) → 재 보고 시안 → 사용자가 고름.
 * 바뀐 것 넷 — 코드 네 글자·유형 이름·그림은 **그대로**입니다(명세 0장 · 사용자 결정).
 *   ① 여러 번 간 도시(city_ratings.visits, 109)를 셉니다. 유명도·거리에는 무게(방문무게)로,
 *      단골력에는 「다시 간 비율」로. **별점은 도시마다 한 번만** 셉니다 — 다섯 번 갔다고
 *      별 하나를 다섯 번 세면 만족력이 그 도시 하나로 기웁니다(명세 9장).
 *   ② 단골력의 뜻 — 「익숙한 곳」 = **한 나라에 몰려 가거나, 같은 도시를 다시 가거나. 더 강한 쪽.**
 *      (사용자가 고름. 명세 그대로 「다시 간 도시 위주」로 하면 일본 도시 스무 곳을 한 번씩 간
 *       사람이 「새로운 곳」이 되어 '한 나라 순정파'·'깊이 파는 사람' 이름과 어긋났습니다.)
 *      다시 간 도시를 **안 알려줬으면 나라 몰림만** 봅니다 — 안 알려줬다고 M 으로 몰지 않습니다.
 *      알려줬는데 다시 간 곳이 없어도 나라 몰림은 그대로 남습니다(둘 중 큰 쪽이라).
 *   ③ 모험력 — 평균이 아니라 **가운뎃값** 60 + 먼 곳(4,500km 넘게) 비율 30 + 가장 먼 곳 10.
 *      평균이면 유럽 한 번이 일본 다섯 번을 덮었습니다(도쿄5·후쿠오카3·파리·싱가포르가 D 로 나왔음).
 *   ④ 흔들림 막기 — 지난번 코드(서버 profiles.persona)가 있으면, 반대쪽으로 `흔들림폭` 넘게
 *      넘어가야 글자가 바뀝니다(명세 11장). 재 보니 평생 바뀌는 횟수가 한 사람당 2.6 → 0.7번.
 * 잰 것(지어낸 여행자 2,000명 · 실제 도시 721곳, 스크래치 p2/sim.html):
 *   가장 많은 유형 19.6% → 13%, 가장 적은 유형 0.5% → 2%, 숨은 성향 맞힘 단골 62→67~73% · 모험 72→89%.
 *   만족력은 **별점 평균 그대로**입니다 — 명세의 「낮은 별점 비율·편차」를 섞으니 덜 맞고(94→83%)
 *   후한 쪽으로 쏠렸습니다(67%).
 * ⚠ 막대에 그리는 값(개척·단골·모험·만족)은 **표본이 적을수록 가운데로 당긴** 값입니다(믿음).
 *   글자는 당기기 전 값으로 정합니다 — 당겨도 가운데를 넘지 않으므로 같은 쪽입니다.
 * ⚠ 막대와 글자는 **어긋나지 않게** 만듭니다(b805 규칙) — 흔들림 막기로 붙잡힌 축은 글자 쪽으로
 *   살짝(2) 기울여 그립니다(`경계` 에도 넣지만 화면에는 안 적습니다 — 「거의 가운데」 딱지는 사용자가 뺐습니다, 2026-09-30). */
const 방문무게 = [1, 1, 1.3, 1.5, 1.65, 1.8];   /* 1~5번(5 = 5번 이상). 명세 6.2 표 */
export const 흔들림폭 = 8;
const 믿음 = n => n / (n + 4);                    /* 5곳 0.56 · 10곳 0.71 · 20곳 0.83 · 50곳 0.93 */
const 먼거리 = 4500;
/* 만족력의 가운데 — **★3.6(2026-09-30 사용자 결정).** 그 날 앱 전체 별점 254개(139개 도시)의 평균이 3.60 이었습니다.
   v1 은 3.20~4.85(가운데 약 4.0)로 「사람들은 대체로 후하게 준다」고 보고 잡았는데, 우리 앱에서는 대부분이
   P 로 나왔습니다(사용자: 「★3.5가 왜 P야?」). 「1~2점대만 주면 P」(가운데 3.0)도 견줬지만 그러면 거의 다 G 라
   P 로 끝나는 여덟 유형이 사라져서 안 골랐습니다. 폭은 전과 같게(1.6) — 2.8 이면 끝까지 까다로움, 4.4 면 끝까지 후함.
   ⚠ 사람이 늘면 다시 재 볼 자리입니다(명세 12장: 판을 올리고 견준 뒤에). */
export const 별가운데 = 3.6;
const 별낮은끝 = 2.8, 별높은끝 = 4.4;
const 백분 = x => Math.max(0, Math.min(100, x * 100));
const 비율 = (v, lo, hi) => 백분((v - lo) / (hi - lo));
const 극 = ['FH', 'ML', 'ND', 'PG'];
/* ── 단골력의 「일본 효과」를 뗍니다(v3, 2026-10-03 사용자: 「단골력에서 일본 효과 떼어내자」) ──────────────
 * 나라 몰림을 셀 때 **가까운 나라(서울에서 1,500km 안 — 일본·중국 동부·대만·블라디보스토크)의 도시는 세 곳을
 * 한 곳으로** 셉니다. 한국 여행자는 다들 일본에 제일 많이 가서, 「제일 많이 간 나라 ÷ 전체」가 일본 몫이 되고
 * 가까이(N) 다닐수록 높았습니다 — 단골력과 모험력이 같은 것(일본에 얼마나 갔나)을 재고 있었습니다.
 * 잰 값(가짜 여행자 — 진짜 계산 그대로 흉내, 10-03):
 *   · 평범한 여행자(일본·동남아 위주, 같은 습관)의 단골↔모험 상관 −0.71 → −0.26 · 그중 L 30% → 2%
 *   · 습관이 다른 여행자 3,000명(한 나라 파기 반, 멀리 반)에서 「한 나라 파는 사람」 맞힘 86~91% → 93~97%
 *     (안 파는데 L: 26%·15% → 9%·1% · 일본처럼 가까운 나라를 파는 사람의 L 97% → 93%)
 *   견준 무게: 1(전) · 0.5(상관 −0.53) · ⅓ · 0.25(가까운 나라 파는 사람을 89% 로 놓침) — ⅓ 이 맞춤.
 * ⚠ **가까운 나라만 다닌 사람은 그대로입니다** — 모든 도시에 같은 무게라 몫이 안 바뀝니다(일본만 스무 곳 → 여전히 L).
 *   섞여 있을 때만 일본 몫이 줄어듭니다: 「일본 반 + 동남아·유럽 반」은 이제 「새로운 곳(M)」.
 * ⚠ 다시 간 비율(visits)은 손대지 않습니다 — 도쿄를 다섯 번 간 사람은 여전히 뚜렷한 단골입니다. */
const 가까운거리 = 1500, 가까운몫 = 1 / 3;
/* v3(10-03): 위 단골력 무게. 판이 오르면 홈 알림·성향 화면의 「바뀌었어요」에 계산 방법이 바뀐 탓이라고 같이 적습니다
   (pshift.js · persona.js — 행동이 바뀐 것처럼 말하지 않게). */
export const PERSONA_VER = 3;

export function personaAxes(rows, world = {}){
  const 표 = new Map((world.cities || []).map(c => [c.id, c]));
  const rated = (rows || []).filter(r => r.stars != null);
  /* ⚠⚠ **국내는 네 축 어디에도 안 셉니다(v2, 2026-09-30 사용자 결정 — 「국내 빼고 문구도 그냥 빼버리자」).**
     b394 는 나라 몰림·모험력에서만 뺐고 유명도·별점은 국내도 셌습니다. 그러면 화면의 「도시 77곳」과 축마다
     센 곳이 달라 앞뒤가 안 맞았습니다(사용자: 「도시77곳으로 내기엔 한국도시 다 빼야하는거아냐?」).
     재 보니 사용자 기록에서 개척 41→45 · 만족 44→47 로만 움직이고 코드는 그대로였습니다.
     목록에 없는 도시도 나라를 모르니 뺍니다. 그래서 성향 확정 문턱도 **해외** 곳 수입니다(persona·pshift·people·rating).
     ⚠ 그 문턱은 **10곳**입니다(2026-10-03 사용자 「문턱 10곳으로 하자」 — 5곳이면 한 곳 더 매길 때 유형이 바뀌는 사람이
       61%, 8곳 37%, 12곳 30% 였음. 처음 보는 사람 기준, 같은 날 잼). */
  const 해외줄 = rated.filter(r => { const c = 표.get(r.city_id); return c && c.country !== 국내; });
  /* 다시 간 도시를 **한 번이라도 알려줬는가.** 시트(visits.js)에서 저장하면 해외 줄마다 숫자(1 이상)가
     적힙니다. 하나도 없으면 「안 알려줌」 — 없는 것을 「한 번도 안 갔다」로 읽지 않습니다. */
  const 알려줌 = 해외줄.some(r => r.visits != null);

  let 유명합 = 0, 유명무게 = 0, 유명수 = 0, 이름난 = 0, 숨은 = 0, 방문합 = 0, 다시간곳 = 0, 몰림합 = 0, 가까운곳 = 0;
  const stars = [], 해외 = [], byCountry = {}, 몰림무게 = {};
  for (const r of 해외줄){
    const c = 표.get(r.city_id);
    /* ↓ 만족력 — 도시마다 한 번(여러 번 갔다고 별을 여러 번 세지 않습니다). */
    stars.push(Number(r.stars));
    const v = Math.min(5, Math.max(1, Math.round(Number(r.visits) || 1))), w = 방문무게[v];
    방문합 += v; if (v >= 2) 다시간곳++;
    /* ↓ 개척력 */
    if (c.fame != null){
      const f = Number(c.fame);
      유명합 += w * f; 유명무게 += w; 유명수++;
      if (f <= 1) 이름난++; else if (f >= 3) 숨은++;
    }
    /* ↓ 나라 몰림 · 모험력 */
    const km = (c.center_lat != null && c.center_lng != null)
      ? distKm(SEOUL[0], SEOUL[1], c.center_lat, c.center_lng) : null;
    해외.push({ km, w, name: c.name });
    if (c.country){
      byCountry[c.country] = (byCountry[c.country] || 0) + 1;
      /* 나라 몰림은 가까운 나라를 ⅓ 로(위 `가까운몫` — 일본 효과). 좌표를 모르면 한 곳으로 셉니다. */
      const 무게 = km != null && km < 가까운거리 ? 가까운몫 : 1;
      if (무게 < 1) 가까운곳++;
      몰림무게[c.country] = (몰림무게[c.country] || 0) + 무게; 몰림합 += 무게;
    }
  }
  const n = stars.length, U = 해외.length, countryN = Object.keys(byCountry).length;

  /* 개척력 — 유명도(1~3 등급, 1 이 이름난 쪽) 평균. 여러 번 간 도시는 무겁게. */
  const 유명평균 = 유명무게 ? 유명합 / 유명무게 : null;
  const 개척원 = 유명평균 == null ? 50 : 백분(fameN(유명평균));

  /* 단골력 — 나라 몰림(가장 몰린 해외 나라의 몫)과 다시 간 비율(전체 방문 중 두 번째부터의 몫).
     다시 간 비율도 해외만입니다(위 ⚠⚠ — 국내는 네 축 어디에도 안 셉니다).
     ⚠ 30% 에서 꽉 찹니다: 열 번 중 세 번이 다시 간 곳이면 뚜렷한 단골입니다.
     ⚠ v3: 몫은 가까운 나라를 ⅓ 로 센 무게로 잽니다(위 `가까운몫`). 그래서 «가장 몰린 나라»(몰린나라)와
       «제일 많이 간 나라»(최다나라 — 곳 수)가 다를 수 있습니다: 일본 6 + 프랑스 4 → 몰린 나라는 프랑스.
       근거 문장은 L 이면 몰린 나라를, M 이면 제일 많이 간 나라를 말합니다(personaWhyHtml). */
  const [최다나라, 최다수] = Object.entries(byCountry).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const [몰린나라, 몰린무게] = Object.entries(몰림무게).sort((a, b) => b[1] - a[1] || byCountry[b[0]] - byCountry[a[0]])[0] || [null, 0];
  const 나라몰림 = U >= 해외문턱 && 몰림합 ? 비율(몰린무게 / 몰림합, 0.10, 0.70) : null;
  /* 가까운 나라와 그 밖이 섞여 있어야 무게가 몫을 바꿉니다 — 그때만 근거 문장에 「세 곳을 한 곳으로」를 붙입니다. */
  const 가까운섞임 = 가까운곳 > 0 && 가까운곳 < U;
  const 다시점수 = 알려줌 && n ? 비율((방문합 - n) / 방문합, 0, 0.30) : null;
  let 단골원 = 50, 단골믿음 = 0, 단골근거 = null;
  if ((다시점수 ?? -1) > (나라몰림 ?? -1)){ 단골원 = 다시점수; 단골믿음 = 믿음(n); 단골근거 = '다시'; }
  else if (나라몰림 != null){ 단골원 = 나라몰림; 단골믿음 = 믿음(U); 단골근거 = '나라'; }

  /* 모험력 — 서울에서의 거리(로그 자, calc.js distN). 여러 번 간 곳은 무겁게 센 가운뎃값. */
  const 거리 = 해외.filter(x => x.km != null).sort((a, b) => a.km - b.km);
  let 모험원 = 0, 가운데 = null, 멀리몫 = 0, 가장먼 = null;
  if (거리.length){
    const 합 = 거리.reduce((s, x) => s + x.w, 0);
    let 누적 = 0;
    for (const x of 거리){ 누적 += x.w; if (누적 >= 합 / 2){ 가운데 = x; break; } }
    가운데 = 가운데 || 거리[거리.length - 1];
    멀리몫 = 거리.filter(x => x.km >= 먼거리).reduce((s, x) => s + x.w, 0) / 합;
    가장먼 = 거리[거리.length - 1];
    모험원 = 60 * distN(가운데.km) + 30 * 멀리몫 + 10 * distN(가장먼.km);
  }

  /* 만족력 — 별점 평균. 가운데는 앱 평균 ★3.6(위 `별가운데`). */
  const 별평균 = n ? stars.reduce((a, b) => a + b, 0) / n : null;
  const 만족원 = 별평균 == null ? 50 : 비율(별평균, 별낮은끝, 별높은끝);

  const 원 = [개척원, 단골원, 모험원, 만족원];
  const 믿음값 = [믿음(유명수), 단골믿음, 믿음(거리.length), 믿음(n)];
  const 보정 = 원.map((x, i) => 50 + (x - 50) * 믿음값[i]);

  /* 못 정한 축 — 막대를 칠하지 않고 「아직 모름」. 글자는 그래도 하나 골라야 합니다:
     해외가 0곳이면 「가까이(N)」(원점수 0), 단골을 모르면 「새로운 곳(M)」(가운데 50 은 낮은 쪽).
     ⚠ v1 은 모르는 축을 50 → L·D 로 냈습니다. 해외에 한 번도 안 간 사람이 '먼 길 마다않는
       외골수' 가 되던 자리입니다. */
  const 추정 = [];
  if (나라몰림 == null && !알려줌) 추정.push('단골력');
  if (U < 해외문턱) 추정.push('모험력');

  let 글자 = 원.map((x, i) => 극[i][x > 50 ? 1 : 0]);
  const 전 = /^[FH][ML][ND][GP]$/.test(world.prev || '') ? world.prev : null;
  const 붙잡음 = [];
  if (전) 글자 = 글자.map((ch, i) => {
    if (ch === 전[i] || Math.abs(보정[i] - 50) >= 흔들림폭) return ch;
    붙잡음.push(AXIS_NAME[i]);
    return 전[i];
  });
  const code = 글자.join('');

  /* 막대에 그릴 값 — 글자 쪽으로 적어도 2 기울입니다(50 은 「아직 모름」만 씁니다). */
  const 보임 = 보정.map((x, i) => {
    if (추정.includes(AXIS_NAME[i])) return 50;
    const 쪽 = code[i] === 극[i][1] ? 1 : -1;
    const 크기 = Math.sign(x - 50) === 쪽 ? Math.max(Math.abs(x - 50), 2) : 2;
    return Math.round(50 + 쪽 * 크기);
  });
  const 경계 = AXIS_NAME.filter((이름, i) => !추정.includes(이름) && Math.abs(보정[i] - 50) < 흔들림폭);

  return { code, 개척: 보임[0], 단골: 보임[1], 모험: 보임[2], 만족: 보임[3],
           판: PERSONA_VER, 원, 보정, 경계, 붙잡음, 추정,
           cities: rated.length, countries: countryN,   /* cities 는 매긴 곳 전부(국내 포함) — 축은 해외만 */
           /* ↓ 화면이 근거를 적을 때 씁니다(personaWhyHtml). 축을 해외로 세면 근거도 해외로 적혀야
                앞뒤가 맞습니다. */
           해외: U, 해외문턱,
           나라당: countryN ? U / countryN : 0,
           avgFame: 유명평균, avgStar: 별평균,
           사실: { n, 유명수, 이름난, 숨은, 알려줌, 다시간곳, 다시간번: 방문합 - n,
                   최다나라, 최다수, 단골근거,
                   몰린나라, 몰린수: 몰린나라 ? byCountry[몰린나라] : 0, 가까운섞임,   /* v3 — 위 「단골력」 ⚠ */
                   최다가까움: !!최다나라 && 몰림무게[최다나라] < byCountry[최다나라],
                   /* 해외가 모자라면 거리를 안 내놓습니다 — 막대는 「아직 모름」인데 옆에 km 가 적혀
                      있으면 그게 더 헷갈립니다. */
                   가운뎃값km: U >= 해외문턱 ? (가운데?.km ?? null) : null,
                   멀리몫, 가장먼곳: 가장먼?.name || null, 가장먼km: 가장먼?.km ?? null,
                   높은별: stars.filter(s => s >= 4.5).length, 낮은별: stars.filter(s => s <= 2).length } };
}

/* 축이 뜻하는 말. 코드 밑에 한 줄로 깝니다.
   ⚠ M·L 은 v2 에 「여러 나라 · 한 나라」 → 「새로운 곳 · 익숙한 곳」(사용자 결정) — 다시 간 도시까지
     담습니다. 코드 글자(M·L)와 유형 이름은 그대로입니다. */
export const AXIS_WORD = {
  F:'유명한 곳', H:'숨은 곳', M:'새로운 곳', L:'익숙한 곳',
  N:'가까이', D:'멀리', P:'까다로움', G:'후함',
};
export const AXIS_NAME = ['개척력', '단골력', '모험력', '만족력'];

/* ── 남이 올린 성향(b808 뒤, 110) ──────────────────────────────────────
 * 사람 화면(people.js)은 그 사람의 별점을 다 받아도 **다시 간 횟수는 못 받습니다**(109 — 남에게 안 보냄).
 * 그래서 막대를 거기서 새로 세면 본인 화면과 어긋납니다 — 본인 앱이 올린 네 숫자(profiles.persona_ax)를
 * 그대로 씁니다. 50 은 본인 화면에서 「아직 모름」이었던 축입니다(위 `보임` 규칙). */
export function personaSaved(code, arr){
  if (!/^[FH][ML][ND][GP]$/.test(code || '') || !Array.isArray(arr) || arr.length !== 4) return null;
  const v = arr.map(Number);
  if (v.some(x => !Number.isFinite(x))) return null;
  const 보임 = v.map((x, i) => {
    if (x === 50) return 50;
    const 쪽 = code[i] === 극[i][1] ? 1 : -1;
    return Math.sign(x - 50) === 쪽 ? Math.round(x) : 50 + 쪽 * 2;
  });
  return { code, 개척: 보임[0], 단골: 보임[1], 모험: 보임[2], 만족: 보임[3],
           추정: AXIS_NAME.filter((_, i) => 보임[i] === 50),
           경계: AXIS_NAME.filter((_, i) => 보임[i] !== 50 && Math.abs(보임[i] - 50) < 흔들림폭) };
}

/* ── 「왜 ○○○○ 인가요」 줄 넷(v2) ── 분석 탭(persona.js)과 사람 화면(people.js)이 **같이 씁니다** ──
 * 전에는 두 화면이 같은 줄을 따로 적고 「같은 말 · 같은 마크업」 주석으로만 묶었습니다. 한 벌로 모읍니다.
 * 근거는 **실제 기록 문장**입니다(명세 14.4). 「도시 유명도 평균 1.69」 같은 날숫자는 사용자가
 * 「41 이라는 숫자가 어떤걸 의미하는거야」라고 물었던 자리라 문장으로 바꿨습니다(값 숫자는 이 카드에만 — b805).
 * `ax` 는 personaAxes 결과(사실은 여기서 읽음), `보임` 은 막대에 그린 값 — 남의 화면이면 그 사람이 올린
 * 값(personaSaved)입니다. 남의 화면은 다시 간 횟수를 못 받으므로(109) 문장은 보이는 별점으로 센 `ax` 에서,
 * 값은 올린 것에서 씁니다.
 * ⚠ 남의 화면(`남`)에서는 다시 간 도시 이야기를 안 합니다 — 그 숫자는 본인만 봅니다. */
export function personaWhyHtml(ax, code, { 보임 = ax, 나라이름 = {}, 남 = false } = {}){
  const s = ax.사실 || {};
  const 퍼 = (a, b) => b ? Math.round(a / b * 100) : 0;
  const km = x => Math.round(x).toLocaleString() + 'km';
  const 모름 = new Set(보임.추정 || []);
  const 나라 = 나라이름[s.최다나라] || s.최다나라 || '';
  const 문턱까지 = Math.max(1, (ax.해외문턱 || 3) - (ax.해외 || 0));

  const 개척말 = !s.유명수 ? '유명도를 아는 해외 도시가 아직 없어요'
    : code[0] === 'H' ? `해외 ${s.유명수}곳 중 ${s.숨은}곳(${퍼(s.숨은, s.유명수)}%)이 덜 알려진 도시예요`
    : `해외 ${s.유명수}곳 중 ${s.이름난}곳(${퍼(s.이름난, s.유명수)}%)이 이름난 관광 도시예요`;
  let 단골말;
  if (모름.has('단골력')) 단골말 = 남 ? '해외 도시가 더 쌓이면 정해져요'
    : `해외 도시 ${문턱까지}곳을 더 매기거나 다시 간 도시를 알려주면 정해져요`;
  /* 다시 간 이야기가 앞에 서는 것은 **L 일 때만** — M 인데 「다시 간 도시 4곳」만 적으면 왜 M 인지가 안 보입니다
     (처음 그려 보고 잡음). M 이면 넓게 다닌 이야기 뒤에 꼬리로 붙습니다(맨 아래 줄). */
  else if (!남 && s.단골근거 === '다시' && code[1] === 'L') 단골말 = `다시 간 도시 ${s.다시간곳}곳 · 모두 ${s.다시간번}번 더 다녀왔어요`;
  /* 남의 L 이 다시 간 횟수에서 왔으면 보이는 별점으로는 설명이 안 됩니다 — 숫자 없이 말만. */
  else if (남 && code[1] === 'L' && !((ax.원?.[1] ?? 0) > 50)) 단골말 = '익숙한 곳을 다시 찾는 편이에요';
  /* v3: L 이면 «가장 몰린 나라»(가까운 나라를 ⅓ 로 센 몫)를, M 이면 «제일 많이 간 나라»(곳 수)를 말합니다 — 일본 6 ·
     프랑스 4 인 L 에게 「일본」을 대면 왜 L 인지 안 보입니다. 무게가 몫을 바꿨으면(가까운 나라와 그 밖이 섞임) 그렇다고 적습니다. */
  else if (code[1] === 'L'){
    const 몰린 = 나라이름[s.몰린나라] || s.몰린나라 || 나라;
    단골말 = `해외 ${ax.해외}곳 중 ${s.몰린수 ?? s.최다수}곳이 ${josa(몰린, '이에요', '예요')}` + (s.가까운섞임 ? ' · 가까운 나라는 세 곳을 한 곳으로 셌어요' : '');
  }
  else 단골말 = `해외 ${ax.해외}곳을 ${ax.countries}개 나라에서 — 제일 많이 간 ${나라}도 ${s.최다수}곳이에요` +
    (s.가까운섞임 && s.최다가까움 ? ' · 가까운 나라는 세 곳을 한 곳으로 셌어요' : '') +
    (!남 && s.알려줌 && s.다시간곳 ? ` · 다시 간 도시 ${s.다시간곳}곳` : '');
  const 모험말 = 모름.has('모험력')
    ? (ax.해외 ? `해외 도시 ${문턱까지}곳을 더 매기면 정해져요` : '아직 해외 도시가 없어요')
    : `해외 도시까지 가운뎃값 ${km(s.가운뎃값km)} · 4,500km 넘는 곳이 ${Math.round((s.멀리몫 || 0) * 100)}%예요`;
  /* 왜 P·G 인지가 보이게 가운데(★3.6)와 견줍니다 — 사용자: 「★3.5가 왜 P야?」(2026-09-30). */
  const 별차 = ax.avgStar == null ? 0 : ax.avgStar - 별가운데;
  /* 가운데와 가까우면 둘째 자리까지 보여 줍니다 — ★3.6 과 ★3.6 을 나란히 두고 「낮아요」라고 하면 거짓말 같습니다. */
  const 만족말 = ax.avgStar == null ? '별점이 아직 없어요'
    : `해외 별점 평균 ★${ax.avgStar.toFixed(Math.abs(별차) < 0.1 ? 2 : 1)} · ` + (Math.abs(별차) < 0.005
      ? `가운데(★${별가운데})와 같아요`
      : `가운데(★${별가운데})보다 ${Math.abs(별차) < 0.25 ? '조금 ' : ''}${별차 < 0 ? '낮아요' : '높아요'}`);

  const 값 = [보임.개척, 보임.단골, 보임.모험, 보임.만족];
  const 줄 = [개척말, 단골말, 모험말, 만족말].map((말, i) => {
    const 이름 = AXIS_NAME[i];
    const 딱지 = 모름.has(이름) ? ' · 아직 모름' : '';
    return `<div class="row"><span class="label">${esc(이름)}${모름.has(이름) ? '' : ' ' + 값[i]}${딱지}
        <div class="memo">${esc(말)}</div></span>
      <span class="val">${esc(code[i])}</span></div>`;
  }).join('');
  return 줄;
}

/* 유형이 바뀐 이유 한 줄(명세 11장) — 홈 알림(pshift.js)과 분석 탭 배지(persona.js)가 같이 씁니다.
   바뀐 글자 자리마다 「○○력이 「…」 쪽으로 넘어갔어요」. 네 축 이름이 다 「력」(받침)이라 「이」 로 둡니다. */
export function personaShiftWhy(전, 지금, 규칙바뀜 = false){
  if (!/^[FH][ML][ND][GP]$/.test(전 || '') || !/^[FH][ML][ND][GP]$/.test(지금 || '')) return '';
  const 바뀜 = [0, 1, 2, 3].filter(i => 전[i] !== 지금[i]);
  /* v3(10-03): 계산 방법이 바뀐 뒤 처음 보는 것이고 단골력 글자가 바뀌었으면, 그 탓일 수 있다고 같이 적습니다 —
     행동이 바뀐 것처럼만 말하면 거짓이 됩니다(부르는 쪽 pshift.js · persona.js 가 판을 기억해 넘김). */
  const 탓 = 규칙바뀜 && 바뀜.includes(1) ? ' · 이제 가까운 나라(일본 등)는 세 곳을 한 곳으로 세서 단골력을 정해요' : '';
  return 바뀜.map(i => `${AXIS_NAME[i]}이 「${AXIS_WORD[지금[i]]}」 쪽으로 넘어갔어요`).join(' · ') + 탓;
}

/* ── 네 축 스펙트럼(b805) ── 분석 탭(persona.js)과 사람 화면(people.js)이 **같이 씁니다.**
 * 밖에서 받은 리포트: 「12·18 이 낮은 성적처럼 보인다」 → 시안 A 「양쪽 스펙트럼」 + 「숫자 빼기」(사용자 결정).
 * 값(0~100)은 점수가 아니라 **두 성향 사이의 자리**입니다(개척력 41 = 유명도 평균 1.69 를 1.10~2.55
 * 사이 자리로 옮긴 것). 0 부터 차오르는 막대로 두면 12 가 못한 것처럼 읽혔습니다 — 그래서 가운데(50)
 * 선에서 기운 쪽으로 칠하고, 기운 쪽 이름만 진하게 둡니다.
 * ⚠ 숫자는 막대에서 뺐습니다 — 근거와 같이 읽히는 「왜 ○○○○ 인가요」에만 남습니다.
 * ⚠ 기운 쪽은 코드 글자와 **같은 규칙**(50 이상이면 H·L·D·G)이라 막대와 네 글자가 어긋나지 않습니다.
 * ⚠ 해외가 모자라 50 으로 둔 축(`추정`)은 칠하지도 굵게 하지도 않고 「아직 모름」만 답니다.
 * ⚠ 공유 카드 그림(drawP16 의 축그리기 · 축한줄)도 같은 스펙트럼입니다(b805, 사용자: 「응 다 바꾸자」) —
 *   극 표(AXIS_POLES)와 기운 쪽 규칙을 같이 씁니다. 한쪽만 바꾸지 마십시오.
 * ⚠ b823: 둥근 주황 막대(사용자가 고른 시안 B). 칠한 조각에 기운 쪽(`r`·`l`)을 달아 «바깥 끝만» 둥글게 합니다
 *   — 가운데 끝은 눈금에 붙어 있어야 「어느 쪽으로 얼마나」가 읽힙니다(app.css .axstrk). 그림 쪽은 스펙트럼막대. */
const AXIS_POLES = [['F', 'H'], ['M', 'L'], ['N', 'D'], ['P', 'G']];
export function axisSpectrum(ax){
  const 모름 = new Set(ax.추정 || []);
  return `<div class="axspec">${AXIS_NAME.map((이름, i) => {
    const v = [ax.개척, ax.단골, ax.모험, ax.만족][i];
    const [왼, 오] = AXIS_POLES[i], 오른 = v >= 50, 몰라 = 모름.has(이름);
    const 폭 = Math.max(Math.abs(v - 50), 1.5);
    const 말 = 몰라 ? '아직 모름' : `${AXIS_WORD[오른 ? 오 : 왼]} 쪽`;
    return `<div class="axsrow" role="img" aria-label="${esc(이름)} — ${esc(말)}">
      <div class="axsname">${esc(이름)}${몰라 ? '<span> · 아직 모름</span>' : ''}</div>
      <div class="axsline"><span class="axsp${!몰라 && !오른 ? ' on' : ''}">${esc(AXIS_WORD[왼])}</span>
        <span class="axstrk">${몰라 ? '' : `<i class="${오른 ? 'r' : 'l'}" style="left:${오른 ? 50 : 50 - 폭}%; width:${폭}%"></i>`}</span>
        <span class="axsp r${!몰라 && 오른 ? ' on' : ''}">${esc(AXIS_WORD[오])}</span></div></div>`;
  }).join('')}</div>`;
}

/* 2×2×2×2 = 16. **빈 칸도 겹침도 없습니다.** */
export const PERSONA16 = {
  FLNG:{ n:'동네 단골',            d:'가던 데 또 가는 게 제일 편한 타입' },
  FLNP:{ n:'눈 높은 재방문러',      d:'같은 데 가면서도 매번 트집 잡는 타입' },
  FLDG:{ n:'한 나라 순정파',        d:'멀리 날아가서도 그 나라만 찾는 타입' },
  FLDP:{ n:'먼 길 마다않는 외골수',  d:'비행기 열 시간 타고 가서 또 그 동네 가는 타입' },
  FMNG:{ n:'근거리 도장깨기',       d:'가까운 유명지는 다 밟아야 직성이 풀리는 타입' },
  FMNP:{ n:'가성비 심사위원',       d:'가까운 데 다니면서 값어치를 따지는 타입' },
  FMDG:{ n:'세계 명소 완주자',      d:'지구 반대편 유명지까지 다 보러 가는 타입' },
  FMDP:{ n:'명소 검열관',          d:'유명하다는 곳마다 가서 실망하고 오는 타입' },
  HLNG:{ n:'골목 탐험가',          d:'가까운 동네 뒷골목이 제일 재밌는 타입' },
  HLNP:{ n:'숨은 맛집 사냥꾼',      d:'아는 사람만 아는 곳을 찾아내야 직성이 풀리는 타입' },
  HLDG:{ n:'깊이 파는 사람',        d:'한 나라를 구석구석 다 훑는 타입' },
  HLDP:{ n:'한 나라 전문가',        d:'그 나라는 현지인보다 잘 아는 타입' },
  HMNG:{ n:'동네 오지 순례자',      d:'가까운 곳에서도 남들 안 가는 데만 찾는 타입' },
  HMNP:{ n:'까칠한 개척자',         d:'새로운 곳을 찾아놓고 또 아쉬워하는 타입' },
  HMDG:{ n:'지구 반대편 방랑자',    d:'멀고 낯선 곳일수록 신나는 타입' },
  HMDP:{ n:'지도 밖 순례자',        d:'검색해도 안 나오는 곳만 골라 가는 타입' },
};

/* ── 상위 % ───────────────────────────────────────────────────────────
 * **사람 수 기반 순위는 초기에 뜻이 없습니다.** 열 명 중 상위 4% 면 반올림해서
 * 1등입니다. 그래서 국가 수 구간을 미리 못박아 둡니다.
 * ⚠ 평생 방문 국가 수 분포는 공개 통계가 없어 **추정치**입니다.
 * 자료가 쌓이면 이 표만 고치면 됩니다. */
const PERSONA_RANK = [[45,'0.5%'], [30,'1%'], [20,'3%'], [15,'6%'],
                      [10,'12%'], [6,'25%'], [3,'50%'], [0,'80%']];
export const personaRank = countries =>
  '상위 ' + (PERSONA_RANK.find(([n]) => Number(countries) >= n)?.[1] || '80%');

/* ── 궁합 ─────────────────────────────────────────────────────────────
 * 240쌍을 적어둘 필요가 없습니다. **코드 두 개를 자리별로 비교**하면 나옵니다.
 * ⚠ **전부 "비슷하면 맞는다" 로 하면 뻔해집니다.** 달라야 좋은 축(단골·만족)을
 * 넣은 것이 이 계산의 핵심입니다 — 파고드는 사람과 훑는 사람이 서로를 채우고,
 * 한 명이 까다로우면 검증 역할을 합니다. */
const MATCH_RULE = [
  { same:true,  w:26, ax:'개척' },   /* 한 명은 오지, 한 명은 도쿄면 갈 곳이 안 정해짐 */
  { same:false, w:12, ax:'단골' },
  { same:true,  w:22, ax:'모험' },   /* 유럽 가자는 사람과 일본 가자는 사람 */
  { same:false, w:16, ax:'만족' },
];
/* ⚠ **고를 때는 자르기 전 점수를 봅니다.** 10~99 로 자른 값으로 고르면
   최고 후보 여럿이 똑같이 99 가 되어 **먼저 적힌 쪽이 뽑힙니다.** 실제로
   FLNG 의 최고가 FMNP(원점수 126)여야 하는데 FLNP(102)가 뽑혔습니다 —
   열여섯 개 전부 그랬습니다. 보여주는 값만 자릅니다. */
const matchRaw = (a, b) => {
  let s = 50;
  MATCH_RULE.forEach((r, i) => { s += (r.same === (a[i] === b[i])) ? r.w : -r.w; });
  return s;
};
export const personaMatch = (a, b) => Math.max(10, Math.min(99, matchRaw(a, b)));

/* 어느 축이 어긋났는지를 짚어줘야 "맞네" 싶습니다. 점수만 있으면 재미가 없습니다. */
const CLASH = {
  개척: '한 명은 인증샷, 한 명은 골목. 둘 다 만족하는 코스가 없음',
  모험: '비행기 표 끊는 순간부터 의견이 갈림',
  단골L: '둘 다 가던 데만 감. 새로운 데는 영영 못 갈 듯',   /* v2: 「한 나라」 → 「익숙한 곳」 */
  단골M: '둘 다 찍고 다녀서 아무것도 깊이 못 봄',
  만족G: '둘 다 다 좋다고 함. 망한 식당도 별 다섯',
  만족P: '둘 다 까다로워서 뭘 먹어도 불만',
};
export function personaMateLine(a, b){
  const s = personaMatch(a, b);
  /* ⚠ **극단에서도 코드를 읽어 말합니다.** 전에는 여기서 통짜 문장 하나를
     돌려줬습니다. 그런데 카드에 실리는 최고·최악은 **정의상 늘 극단**이라,
     열여섯 장이 전부 "실패가 없음 / 3일차에 따로 다니게 됨" 으로 똑같아졌습니다.

     ⚠ 한 번 고치고도 **네 축을 다 안 읽어서 서른두 칸이 여덟 가지**였습니다.
     개척·모험만 읽었더니 나머지 두 자리가 다른 네 유형이 같은 말을 썼습니다.
     극단 짝은 **어느 축이 같고 어느 축이 다른지가 정해져 있으므로**, 같은
     축은 같다고, 다른 축은 다르다고 그대로 읽으면 열여섯이 다 갈립니다.
       최고 — 개척·모험이 같고 단골·만족이 다름 (그래서 서로를 채웁니다)
       최악 — 개척·모험이 다르고 단골·만족이 같음 (그래서 둘 다 같은 데서 막힙니다) */
  /* ⚠ **짧아야 합니다.** 시안의 그 칸은 좁아서 한두 줄이 한계입니다(명세도
     "문구는 한 줄만"). 처음에 설명을 다 풀어 썼더니 세 줄이 되어 상자를
     넘쳤습니다. **네 낱말만 놓고 접속은 최소로** — 그래도 네 자리를 다
     읽으므로 열여섯이 갈립니다.
     조사는 안 붙입니다. 받침에 따라 '라/이라' 가 갈리는데 낱말이 표에서
     오므로 붙여 쓰면 언젠가 어긋납니다. 필요하면 dom.js 의 josa() 를 씁니다. */
  const [f, l, d, p] = [...a].map(ch => AXIS_WORD[ch]);
  if (s >= 90) return `${f}·${d} 같고 ${l}·${p} 달라`;
  if (s <= 19) return `${f}·${d} 반대, 둘 다 ${l}·${p}`;
  /* 어긋난 축을 하나 골라 짚습니다. 가중치가 큰 것부터 봅니다. */
  for (const r of [...MATCH_RULE].sort((x, y) => y.w - x.w)){
    const i = MATCH_RULE.indexOf(r), eq = a[i] === b[i];
    if (r.same === eq) continue;                    /* 이 축은 잘 맞습니다 */
    if (r.same) return CLASH[r.ax];                 /* 같아야 하는데 다름 */
    return CLASH[r.ax + a[i]];                      /* 달라야 하는데 같음 */
  }
  return s >= 70 ? '큰 다툼 없이 다닐 수 있음' : '무난하게 다닐 수 있음';
}

/* 열여섯을 다 재서 제일 잘 맞는 하나와 제일 안 맞는 하나를 고릅니다.
   표를 따로 적어두지 않습니다 — 가중치를 고치면 표가 거짓말이 됩니다. */
export function personaMates(code){
  const others = Object.keys(PERSONA16).filter(c => c !== code);
  let best = others[0], worst = others[0];
  for (const c of others){
    if (matchRaw(code, c) > matchRaw(code, best))  best  = c;
    if (matchRaw(code, c) < matchRaw(code, worst)) worst = c;
  }
  return { best,  bestScore:  personaMatch(code, best),  bestLine:  personaMateLine(code, best),
           worst, worstScore: personaMatch(code, worst), worstLine: personaMateLine(code, worst) };
}

/* 카드 아래 장식 줄. **여권 기계판독구역(MRZ) 흉내입니다** — 진짜 정보는
   위에 따로 다 보여주고 있으니 여기서는 읽을 필요가 없습니다. */
export const personaMrz = (code, countries, cities, rank, year) =>
  `P<KEYRO<<${code}<<${countries}COUNTRIES<<${cities}CITIES<<` +
  `TOP${String(rank).replace(/[^0-9.]/g, '')}PCT<<${year}<`;


/* ── 자가검사 (개발용) ─────────────────────────────────────────────────
 * 콘솔에서 __cardCheck() 를 부르면 아래를 다 돌려 봅니다.
 * 로그인도, 도시 목록도, 별점을 매긴 여행도 필요 없습니다 — 지어낸 값만 봅니다.
 * (calc.js 의 __calcCheck · app.js 의 __settleCheck 와 같은 방식입니다.)
 *
 * 여기 있는 것들이 실제로 물렸던 자리라 검사가 있습니다:
 *   - 표에 키가 없어 배경·아이콘이 undefined 로 나가는 것 (SHELF 의 been 과 같은 모양)
 *   - 규칙표에서 **앞 규칙에 가려 영영 안 나오는 규칙** (실제로 규모 문구가 그랬습니다)
 *   - 도시 목록이 아직 없을 때 (오프라인·첫 화면) 셈이 죽는 것
 */
if (typeof window !== 'undefined') window.__cardCheck = () => {
  const out = [];
  const bad = (name, msgs) =>
    out.push({ 항목:name, 결과: msgs.length ? '✗ ' + msgs.join(' / ') : '✓' });

  const WORLD = {
    cities: [{ id:1, country:'JP', name:'도쿄', fame:5 },
             { id:2, country:'JP', name:'교토', fame:4 },
             { id:3, country:'FR', name:'파리', fame:5 },
             { id:4, country:'KR', name:'부산' }],          /* fame 없음 — 평균에서 빠져야 함 */
    continentOf: { JP:'아시아', FR:'유럽', KR:'아시아' },
    countryName: { JP:'일본', FR:'프랑스', KR:'대한민국' },
  };

  /* 1. 열여섯이 다 있는가. 하나라도 비면 그 사람은 이름 없는 카드를 받습니다. */
  {
    const msgs = [];
    for (const a of 'FH') for (const b of 'ML') for (const c of 'ND') for (const d of 'GP'){
      const k = a + b + c + d;
      if (!PERSONA16[k]) msgs.push(`${k} 없음`);
      else if (!PERSONA16[k].n || !PERSONA16[k].d) msgs.push(`${k} 이름·설명 빔`);
    }
    const 이상한키 = Object.keys(PERSONA16).filter(k => !/^[FH][ML][ND][GP]$/.test(k));
    if (이상한키.length) msgs.push(`코드가 아닌 키: ${이상한키.join(',')}`);
    const names = Object.values(PERSONA16).map(v => v.n);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    if (dup.length) msgs.push(`이름 겹침: ${[...new Set(dup)].join(',')}`);
    /* 축 낱말 여덟도 다 있어야 코드 밑줄이 안 빕니다. */
    for (const ch of 'FHMLNDGP') if (!AXIS_WORD[ch]) msgs.push(`축 낱말 ${ch} 없음`);
    if (AXIS_NAME.length !== 4) msgs.push(`축 이름이 ${AXIS_NAME.length}개`);
    bad('유형 16개 · 이름·설명·축 낱말이 다 있는가', msgs);
  }

  /* 1-b. 배경·아이콘 표. **성향 카드는 이제 안 씁니다** — 그런데 홈 hero(home.js)와
         지도 카드(map.js), 결산 카드(report.js)가 아직 이 키로 색과 아이콘을
         꺼냅니다. 성향 쪽만 보고 지웠다가는 저 셋이 조용히 배경을 잃습니다. */
  {
    const msgs = [];
    if (!PERSONA_ICON.globe) msgs.push("아이콘 'globe' 없음 (map.js 가 씁니다)");
    if (!Object.keys(PERSONA_BG).length) msgs.push('배경표가 비었음');
    for (const [k, v] of Object.entries(PERSONA_BG))
      if (!v || String(v).length < 8) msgs.push(`배경 '${k}' 가 이상함`);
    bad('배경·아이콘 표 (home·map·report 가 씁니다)', msgs);
  }

  /* 2. 어떤 자료가 와도 코드 네 글자가 나와야 합니다. 못 나오면 PERSONA16
        조회가 undefined 가 되고 카드가 통째로 안 그려집니다. */
  {
    const msgs = [];
    for (const [name, rows, world] of [
      ['아무것도 없음', [], { cities: WORLD.cities }],
      ['가보고 싶은 곳만', [{ city_id:1, want:true }], { cities: WORLD.cities }],
      ['도시 목록 없음', [{ city_id:1, stars:5 }], {}],
      ['모르는 도시', [{ city_id:999, stars:3 }], { cities: WORLD.cities }],
      ['유명도·좌표 없음', [{ city_id:4, stars:3 }], { cities: WORLD.cities }],
    ]){
      let a;
      try { a = personaAxes(rows, world); }
      catch (e){ msgs.push(`${name}: 터짐 (${e.message})`); continue; }
      if (!/^[FH][ML][ND][GP]$/.test(a?.code || '')) msgs.push(`${name}: 코드가 '${a?.code}'`);
      else if (!PERSONA16[a.code]) msgs.push(`${name}: ${a.code} 가 표에 없음`);
      for (const k of ['개척', '단골', '모험', '만족'])
        if (!(a?.[k] >= 0 && a?.[k] <= 100)) msgs.push(`${name}: ${k}=${a?.[k]} 가 0~100 밖`);
    }
    bad('빈 자료·모르는 도시에서도 코드가 나오는가', msgs);
  }

  /* 3. 세는 규칙. 별점을 매긴 도시만 세고, 유명도를 모르는 도시는 평균에서 뺍니다. */
  {
    const s = personaStats(
      [{ city_id:1, stars:5 }, { city_id:2, stars:4 }, { city_id:3, stars:2 },
       { city_id:4, stars:null, want:true }], WORLD);
    const msgs = [];
    if (s.cities !== 3)      msgs.push(`도시 ${s.cities} (별점 매긴 3 기대 — 가보고 싶어요는 안 셈)`);
    if (s.wishCount !== 1)   msgs.push(`가보고 싶은 곳 ${s.wishCount} (1 기대)`);
    if (s.countries !== 2)   msgs.push(`나라 ${s.countries} (2 기대)`);
    if (s.continents !== 2)  msgs.push(`대륙 ${s.continents} (2 기대)`);
    if (Math.abs(s.avgRating - 11/3) > 1e-9) msgs.push(`평균 별점 ${s.avgRating}`);
    /* 부산(fame 없음)은 셋 중 하나지만 별점을 안 매겨서 애초에 안 들어옵니다.
       들어온 셋의 유명도 평균은 (5+4+5)/3 입니다. */
    if (Math.abs(s.avgFame - 14/3) > 1e-9) msgs.push(`평균 유명도 ${s.avgFame}`);
    if (s.topCountry !== 'JP') msgs.push(`제일 많이 간 나라 ${s.topCountry}`);
    if (s.topCountryName !== '일본') msgs.push(`나라 이름이 코드 그대로: ${s.topCountryName}`);
    bad('personaStats 세는 규칙', msgs);
  }

  /* 3-b. **국내는 네 축 모두에서 빠집니다(v2 · 2026-09-30, b394 에는 둘에서만).** 축마다 표본이 달랐으니
        어느 축이 무엇을 세는지 한 자리에서 못 박습니다.

        ⚠ **글자가 뒤집히는 자료를 일부러 고릅니다.** 국내를 세느냐 마느냐로
        단골력·모험력·개척력이 **전부 반대로 나오게** 짰습니다. 그래야 규칙을
        되돌리는 순간 이 검사가 셋 다 빨갛게 뜹니다. 점수만 보면 몇 점
        움직였는지로 다투게 되고, 그러면 아무것도 못 잡습니다. */
  {
    const fake = [
      /* 국내 열 곳 — 가깝고(서울 근처) 숨은 곳(fame 3) */
      ...Array.from({ length: 10 }, (_, i) =>
        ({ id: 100 + i, country:'KR', fame:3, center_lat:36.5, center_lng:127.5 })),
      /* 해외 세 곳 — 다 다른 나라, 다 멀리, 다 이름난 곳(fame 1) */
      { id:1, country:'JP', fame:1, center_lat:-33.9, center_lng:151.2 },
      { id:2, country:'FR', fame:1, center_lat: 48.9, center_lng:  2.35 },
      { id:3, country:'US', fame:1, center_lat: 40.7, center_lng:-74.0 },
    ];
    const a = personaAxes(fake.map(c => ({ city_id:c.id, stars:5 })), { cities: fake });
    const msgs = [];
    if (a.해외 !== 3) msgs.push(`해외 ${a.해외} (3 기대)`);
    /* 국내를 세면 최다 나라가 KR 10/13 = 0.77 → L. 해외만 세면 1/3 = 0.33 → M. */
    if (a.code[1] !== 'M') msgs.push(`단골력 ${a.code[1]} — 국내를 세고 있습니다(M 기대)`);
    /* 국내 열 곳(약 120km)이 평균에 들어가면 9,400km 가 2,265km 로 눌려 N 이 됩니다. */
    if (a.code[2] !== 'D') msgs.push(`모험력 ${a.code[2]} — 국내를 세고 있습니다(D 기대)`);
    /* ⚠ v2(2026-09-30 사용자 결정): **개척력·만족력도 국내를 안 셉니다**(b394 에는 셌습니다 — 이 줄의 방향이
       반대였습니다). 다 세면 평균 2.54 → H, 해외만 세면 1.0 → F. 만족력도 국내 별(1점)을 섞으면 P 로 기웁니다. */
    if (a.code[0] !== 'F') msgs.push(`개척력 ${a.code[0]} — 국내를 세고 있습니다(F 기대)`);
    const b = personaAxes(fake.map(c => ({ city_id:c.id, stars: c.country === 'KR' ? 1 : 5 })), { cities: fake });
    if (b.code[3] !== 'G') msgs.push(`만족력 ${b.code[3]} — 국내 별점을 세고 있습니다(G 기대)`);
    if (b.avgStar !== 5) msgs.push(`별 평균 ${b.avgStar} — 해외 셋의 5 만 세야 합니다`);
    bad('국내가 네 축 모두에서 빠지는가', msgs);
  }

  /* 3-c. 문턱. 해외가 세 곳에 못 미치면 두 축을 50 으로 두고 **그 사실을
        내놓습니다**(화면이 밝힐 수 있어야 하므로). 해외 한 곳이면
        「제일 많이 간 나라 ÷ 전체」가 1.0 이라 단골력이 100 으로 튑니다. */
  {
    const fake = [
      { id:100, country:'KR', fame:2, center_lat:36.5, center_lng:127.5 },
      { id:101, country:'KR', fame:2, center_lat:35.1, center_lng:129.0 },
      { id:102, country:'KR', fame:2, center_lat:37.4, center_lng:127.1 },
      { id:1,   country:'JP', fame:1, center_lat:35.7, center_lng:139.7 },
      { id:2,   country:'JP', fame:1, center_lat:35.0, center_lng:135.8 },
    ];
    const a = personaAxes(fake.map(c => ({ city_id:c.id, stars:4 })), { cities: fake });
    const msgs = [];
    if (a.해외 !== 2)    msgs.push(`해외 ${a.해외} (2 기대)`);
    if (a.단골 !== 50)   msgs.push(`단골력 ${a.단골} (50 기대)`);
    if (a.모험 !== 50)   msgs.push(`모험력 ${a.모험} (50 기대)`);
    if (a.추정.length !== 2) msgs.push(`추정 ${JSON.stringify(a.추정)} (둘 기대)`);
    /* 안 센 축 옆에 "평균 230km" 가 적혀 있으면 50 인 것이 더 헷갈립니다. */
    if (a.사실?.가운뎃값km != null) msgs.push(`거리 가운뎃값 ${a.사실.가운뎃값km} — 안 셌으면 안 내놔야 합니다`);
    /* 문턱이 **엉뚱한 축까지** 얼리지 않는지. 개척력은 다섯 곳을 다 셉니다. */
    if (a.개척 === 50)   msgs.push('개척력까지 50 — 문턱이 남의 축을 얼렸습니다');
    bad('해외가 모자라면 두 축만 50 으로 두고 밝히는가', msgs);
  }

  /* 4. 인상 깊었던 곳 — 4.5 이상만, 별점 높은 순, 3개까지. */
  {
    const world = { ...WORLD, cities: [1,2,3,4,5].map(i => ({ id:i, country:'JP', name:'도시'+i })) };
    const s = personaStats(
      [{ city_id:1, stars:5 }, { city_id:2, stars:4.5 }, { city_id:3, stars:5 },
       { city_id:4, stars:4 }, { city_id:5, stars:5 }], world);
    const msgs = [];
    if (s.best.length !== 3) msgs.push(`${s.best.length}개 (3까지)`);
    if (s.best.some(b => b.stars < 4.5)) msgs.push('4.5 미만이 섞임');
    if (s.best.some((b, i) => i && b.stars > s.best[i-1].stars)) msgs.push('별점 순이 아님');
    bad('best · 4.5 이상만 · 높은 순 · 3개까지', msgs);
  }

  /* 5. 열여섯 유형이 **실제로 나오는가**. 옛 규칙표에서는 앞 규칙에 가려
        영영 안 나오는 규칙이 있었습니다 — 실제로 규모 문구가 76가지를 다
        넣어봐도 0번이었습니다. 이제는 네 부등호로만 갈리므로 **가려질 수가
        없습니다.** 대신 볼 것이 바뀝니다: 문턱이 한쪽으로 쏠려 있으면
        열여섯이 표에 다 있어도 실제 사람은 두세 개에만 몰립니다.

        ⚠ **못 나온 유형이 있다고 틀림으로 세지 않습니다.** 아래 가짜 도시는
        좌표가 여섯 군데뿐이라 모험력이 다 잡히지 않습니다. 절반 넘게 비면
        그때는 문턱 문제라 틀림으로 셉니다. */
  {
    const fake = [];
    let id = 0;
    for (const fame of [1, 1.5, 2, 2.5, 3])
      for (const [la, ln] of [[35.7, 139.7], [22.3, 114.2], [13.7, 100.5],
                              [48.9, 2.35], [40.7, -74.0], [-33.9, 151.2]])
        fake.push({ id: ++id, name: 'c' + id, country: 'C' + (id % 7), fame,
                    center_lat: la, center_lng: ln });

    const hit = {}, threw = [];
    let n = 0;
    /* 몇 곳을 · 얼마나 흩어서 · 몇 점으로 · 한 나라에 몰았는가 — 넷을 다 훑습니다. */
    for (const take of [1, 2, 3, 5, 8, 14, 22, 30])
      for (const step of [1, 3, 5, 7, 11])
        for (const star of [1, 2.5, 3.2, 3.8, 4.4, 4.9, 5])
          for (const 몰기 of [0, 1]){
            const rows = [];
            for (let i = 0; i < take; i++)
              rows.push({ city_id: 몰기 ? fake[i % 3].id : fake[(i * step) % fake.length].id,
                          stars: star });
            n++;
            let a;
            try { a = personaAxes(rows, { cities: fake }); }
            catch (e){ threw.push(e.message); continue; }
            hit[a.code] = (hit[a.code] || 0) + 1;
          }
    bad('축 셈이 자료를 보다 터지는가', threw.length ? [...new Set(threw)].slice(0, 3) : []);
    const 없음 = Object.keys(PERSONA16).filter(k => !hit[k]);
    out.push({ 항목: `쏠림 — ${n.toLocaleString()}가지를 훑어 ${16 - 없음.length}/16 유형이 나옴`,
               결과: 없음.length ? '⚠ 안 나옴: ' + 없음.join(',') : '✓' });
    console.log('유형별 횟수:', Object.fromEntries(
      Object.entries(hit).sort((a, b) => b[1] - a[1])));
  }

  /* 5-b. **열여섯에 다 닿을 수 있는가.** 위 격자로는 이 질문에 답이 안 됩니다 —
        한 번 그렇게 세었다가 `H*N*` 넷이 "안 나온다"고 나왔는데, 성향 계산이
        아니라 **가짜 도시 서른 곳이 유명도와 거리를 따로 못 고른 탓**이었습니다.
        (숨은 곳이면서 가까운 도시가 그 서른 안에 거의 없었습니다. 진짜 목록
        469곳에는 얼마든지 있습니다.)

        그래서 훑는 대신 **겨냥합니다.** 열여섯 자리마다 그 자리에 떨어질
        자료를 손으로 만들어 넣고, 정말 그 코드가 나오는지 봅니다. 하나라도
        안 맞으면 문턱이 잘못 잡힌 것이라 **틀림**입니다.
        이러면 못 나오는 유형이 있는지를 표본 운에 맡기지 않게 됩니다. */
  {
    const msgs = [];
    /* 축마다 양 끝을 확실히 넘기는 값. 부등호 경계가 아니라 바깥을 씁니다 —
       경계값을 넣으면 이 검사가 반올림 다툼이 되어 버립니다. */
    const FAME  = { F:1.0,  H:3.0 };                       /* 1 이 이름난 쪽입니다 */
    const COORD = { N:[35.7, 139.7], D:[-33.9, 151.2] };   /* 도쿄 ↔ 시드니 */
    const STAR  = { P:2.6,  G:5.0 };   /* 가운데 ★3.6 기준 양 끝 바깥 */
    for (const a of 'FH') for (const b of 'ML') for (const c of 'ND') for (const d of 'GP'){
      const want = a + b + c + d;
      const rows = [], fake = [];
      for (let i = 0; i < 10; i++){
        fake.push({ id: i + 1, name: 'x' + i, fame: FAME[a],
                    /* 한 나라(L)면 다 같은 나라, 여러 나라(M)면 다 다른 나라 */
                    country: b === 'L' ? 'JP' : 'C' + i,
                    center_lat: COORD[c][0], center_lng: COORD[c][1] });
        rows.push({ city_id: i + 1, stars: STAR[d] });
      }
      let got;
      try { got = personaAxes(rows, { cities: fake }).code; }
      catch (e){ msgs.push(`${want}: 터짐 (${e.message})`); continue; }
      if (got !== want) msgs.push(`${want} 를 겨냥했는데 ${got}`);
    }
    bad('열여섯 자리에 다 닿는가 (자리마다 겨냥해서 확인)', msgs);
  }

  /* 5-c. **고정 프로필 112개(v2, 명세 13장).** 열여섯 유형마다 일곱 가지 — 전형 셋(8·15·30곳) ·
        약하게 기운 것 둘 · 헷갈리게 만든 것 둘(국내 네 곳 섞기 + 익숙한 곳은 «다시 간 횟수로만» L).
        하나라도 다른 코드가 나오면 틀림입니다 — 자를 고치다 한 칸이 무너지면 여기서 빨갛게 뜹니다. */
  {
    const msgs = [];
    const 먼 = [48.9, 2.35], 가까운 = [35.7, 139.7];
    const 변형 = [{ n: 8, 약: false }, { n: 15, 약: false }, { n: 30, 약: false },
                  { n: 10, 약: true }, { n: 20, 약: true },
                  { n: 12, 약: false, 섞기: true }, { n: 12, 약: true, 섞기: true }];
    let 셈 = 0;
    for (const a of 'FH') for (const b of 'ML') for (const c of 'ND') for (const d of 'GP'){
      const want = a + b + c + d;
      for (const { n, 약, 섞기 } of 변형){
        const fake = [], rows = [];
        const 별 = d === 'G' ? (약 ? 4.0 : 5) : (약 ? 3.3 : 2.6);   /* 가운데 ★3.6 */
        for (let i = 0; i < n; i++){
          const fame = a === 'F' ? (약 ? [1, 2, 2][i % 3] : 1) : (약 ? [2, 2, 3][i % 3] : 3);
          const country = b === 'L'
            ? (섞기 ? 'C' + i : 약 ? (i % 2 ? 'JP' : 'C' + i) : 'JP')    /* 섞기면 나라는 흩고 다시 간 횟수로 */
            /* 약한 M = 셋에 하나꼴(30%)만 한 나라. ⚠ `i % 10 < 3` 으로 두었다가 12곳에서 i=10·11 이 또
               일본이 되어 5/12(42%) → L 이 나왔습니다(처음 돌린 날 잡음). 곳 수에 맞춰 셉니다. */
            : (약 ? (i < Math.round(n * 0.3) ? 'JP' : 'C' + i) : 'C' + i);
          const 멀리 = c === 'D' ? (약 ? i % 10 >= 3 : true) : (약 ? i % 10 >= 7 : false);
          const [la, ln] = 멀리 ? 먼 : 가까운;
          fake.push({ id: 'p' + i, name: 'p' + i, fame, country, center_lat: la, center_lng: ln });
          rows.push({ city_id: 'p' + i, stars: 별, visits: 섞기 ? (b === 'L' ? 3 : 1) : null });
        }
        if (섞기) for (let k = 0; k < 4; k++){
          /* 국내 네 곳 — 유명도는 목표와 같게(개척력은 국내도 셉니다), 단골·모험에는 안 들어가야 합니다. */
          fake.push({ id: 'k' + k, name: 'k' + k, fame: a === 'F' ? 1 : 3, country: 'KR',
                      center_lat: 36.5, center_lng: 127.5 });
          rows.push({ city_id: 'k' + k, stars: 별, visits: 1 });
        }
        셈++;
        let got;
        try { got = personaAxes(rows, { cities: fake }).code; }
        catch (e){ msgs.push(`${want}(${n}${약 ? '·약' : ''}${섞기 ? '·섞기' : ''}): 터짐 ${e.message}`); continue; }
        if (got !== want) msgs.push(`${want}(${n}${약 ? '·약' : ''}${섞기 ? '·섞기' : ''}) → ${got}`);
      }
    }
    bad(`고정 프로필 ${셈}개가 다 제 유형으로 나오는가`, msgs.slice(0, 6));
  }

  /* 5-d. **다시 간 도시(v2).** 명세 7.3 예시와 출시 차단 조건(28장 3·4번)을 그대로 겨냥합니다. */
  {
    const msgs = [];
    const W = [{ id: 'tokyo', country: 'JP', fame: 1, center_lat: 35.68, center_lng: 139.69 },
               { id: 'fukuoka', country: 'JP', fame: 1, center_lat: 33.59, center_lng: 130.40 },
               { id: 'paris', country: 'FR', fame: 1, center_lat: 48.86, center_lng: 2.35 },
               { id: 'singapore', country: 'SG', fame: 1, center_lat: 1.35, center_lng: 103.82 }];
    const 줄 = v => [['tokyo', v[0]], ['fukuoka', v[1]], ['paris', v[2]], ['singapore', v[3]]]
      .map(([id, x]) => ({ city_id: id, stars: 4, visits: x }));
    const 여러번 = personaAxes(줄([5, 3, 1, 1]), { cities: W });
    /* 도쿄 다섯 번·후쿠오카 세 번이면 뚜렷한 「익숙한 곳」, 그리고 가운뎃값이 일본이라 「가까이」. */
    if (여러번.code[1] !== 'L' || 여러번.원[1] < 90) msgs.push(`도쿄5·후쿠오카3 → 단골 ${여러번.원[1]} ${여러번.code}`);
    if (여러번.code[2] !== 'N') msgs.push(`도쿄5·후쿠오카3 → 모험 ${여러번.code[2]} (파리 한 번이 거리를 덮음)`);
    /* 별점은 도시마다 한 번 — 다섯 번 갔다고 별 하나를 다섯 번 세지 않습니다. */
    const 한번 = personaAxes(줄([1, 1, 1, 1]), { cities: W });
    if (여러번.avgStar !== 한번.avgStar) msgs.push(`별 평균이 방문 횟수로 바뀜 ${여러번.avgStar} vs ${한번.avgStar}`);
    /* 안 알려줬다고 M 으로 몰지 않습니다 — 나라 몰림만 봅니다. v3: 몰림은 프랑스 둘/넷으로 봅니다(먼 나라라 그대로 L).
       ⚠ 예전에는 일본 둘/넷이었는데, 그건 이제 «일본 효과»라 M 이 맞습니다(아래 「일본 효과」). */
    const W몰림 = [...W, { id: 'nice', country: 'FR', fame: 2, center_lat: 43.70, center_lng: 7.27 }];
    const 모름 = personaAxes(['tokyo', 'paris', 'nice', 'singapore'].map(id => ({ city_id: id, stars: 4, visits: null })), { cities: W몰림 });
    if (모름.사실.알려줌) msgs.push('비어 있는데 「알려줌」');
    if (모름.code[1] !== 'L') msgs.push(`횟수 없이 → ${모름.code[1]} (프랑스 둘/넷 — 나라 몰림 L 기대)`);
    /* v3 일본 효과 — 일본 여섯(가까움) + 베트남 둘·태국·프랑스: 예전엔 일본 60% 로 L, 이제 세 곳을 한 곳으로 세서 M. */
    const 섞음 = [...Array.from({ length: 6 }, (_, i) => ({ id: 'jp' + i, country: 'JP', fame: 2, center_lat: 35 + i / 10, center_lng: 136 })),
                  { id: 'vn1', country: 'VN', fame: 2, center_lat: 16.05, center_lng: 108.2 },
                  { id: 'vn2', country: 'VN', fame: 2, center_lat: 21.03, center_lng: 105.85 },
                  { id: 'th1', country: 'TH', fame: 2, center_lat: 13.75, center_lng: 100.5 },
                  { id: 'fr1', country: 'FR', fame: 2, center_lat: 48.86, center_lng: 2.35 }];
    const 일본섞음 = personaAxes(섞음.map(c => ({ city_id: c.id, stars: 4 })), { cities: 섞음 });
    if (일본섞음.code[1] !== 'M') msgs.push(`일본 6 + 동남아·유럽 4 → ${일본섞음.code[1]} (일본 효과를 떼면 M)`);
    if (!일본섞음.사실.가까운섞임 || !일본섞음.사실.최다가까움) msgs.push('가까운 나라와 그 밖이 섞였는데 근거 문장에 쓸 표시가 없음');
    /* 알려줬는데 다시 간 곳이 없어도 나라 몰림은 남습니다(둘 중 큰 쪽 — 사용자가 고른 뜻). */
    const JP20 = Array.from({ length: 20 }, (_, i) => ({ id: 'j' + i, country: 'JP', fame: 2, center_lat: 35 + i / 10, center_lng: 135 }));
    const 일본만 = personaAxes(JP20.map(c => ({ city_id: c.id, stars: 4, visits: 1 })), { cities: JP20 });
    if (일본만.code[1] !== 'L') msgs.push(`일본 스무 곳 한 번씩 → ${일본만.code[1]} (L 기대)`);
    /* 알려줬으면 해외가 적어도 단골력은 정해집니다 — 모험력만 「아직 모름」. */
    const 적음 = personaAxes([{ city_id: 'tokyo', stars: 4, visits: 1 }, { city_id: 'paris', stars: 4, visits: 1 }], { cities: W });
    if (적음.추정.includes('단골력') || !적음.추정.includes('모험력')) msgs.push(`해외 둘·알려줌 → 추정 ${JSON.stringify(적음.추정)}`);
    /* 해외 0곳이면 「가까이」(v1 은 50 → D 였음). */
    const 국내만 = personaAxes([{ city_id: 'x', stars: 4 }], { cities: [{ id: 'x', country: 'KR', fame: 2, center_lat: 36, center_lng: 128 }] });
    if (국내만.code[2] !== 'N') msgs.push(`해외 0곳 → ${국내만.code[2]} (N 기대)`);
    bad('다시 간 도시 · 별 한 번만 · 안 알려줌은 M 이 아님 · 해외 0곳은 N · 일본 효과(v3)', msgs);
  }

  /* 5-e. **흔들림 막기 · 막대와 글자가 안 어긋나기(v2).** 지난 코드가 있으면 가운데 근처에서는 글자를
        붙잡고, 멀리 넘어가면 바꿉니다. 어느 경우든 막대가 기운 쪽(50 이상 = H·L·D·G)은 글자와 같아야
        합니다 — b805 규칙. 쏠림 격자(위 5)와 같은 식으로 여러 자료 × 여러 지난 코드를 훑습니다. */
  {
    const msgs = [];
    const 조금 = [], 많이 = [];
    for (let i = 0; i < 10; i++){
      조금.push({ id: 'a' + i, country: 'C' + i, fame: i < 6 ? 2 : 1.6, center_lat: 48.9, center_lng: 2.35 });
      많이.push({ id: 'b' + i, country: 'C' + i, fame: 3, center_lat: 48.9, center_lng: 2.35 });
    }
    const 약H = personaAxes(조금.map(c => ({ city_id: c.id, stars: 4 })), { cities: 조금, prev: 'FMDG' });
    if (약H.원[0] <= 50) msgs.push(`약한 H 자료가 H 가 아님(원 ${약H.원[0]})`);
    else if (약H.code[0] !== 'F') msgs.push(`가운데 근처인데 글자가 바뀜 ${약H.code}`);
    else if (!약H.경계.includes('개척력') || !약H.붙잡음.includes('개척력')) msgs.push('붙잡았는데 경계·붙잡음에 없음');
    const 강H = personaAxes(많이.map(c => ({ city_id: c.id, stars: 4 })), { cities: 많이, prev: 'FMDG' });
    if (강H.code[0] !== 'H') msgs.push(`멀리 넘어갔는데 안 바뀜 ${강H.code}`);
    const fake = [];
    let id = 0;
    for (const fame of [1, 1.5, 2, 2.5, 3])
      for (const [la, ln] of [[35.7, 139.7], [22.3, 114.2], [13.7, 100.5], [48.9, 2.35], [40.7, -74.0], [-33.9, 151.2]])
        fake.push({ id: ++id, name: 'c' + id, country: 'C' + (id % 7), fame, center_lat: la, center_lng: ln });
    let 틀림 = 0, 본 = 0;
    for (const take of [1, 3, 5, 8, 14, 30]) for (const step of [1, 5, 11]) for (const star of [2.5, 3.8, 4.4, 5])
      for (const prev of [null, 'FMNP', 'HLDG', 'FLDP', 'HMNG']) for (const 번 of [null, 1, 3]){
        const rows = [];
        for (let i = 0; i < take; i++) rows.push({ city_id: fake[(i * step) % fake.length].id, stars: star, visits: 번 });
        const a = personaAxes(rows, { cities: fake, prev });
        [a.개척, a.단골, a.모험, a.만족].forEach((v, k) => {
          본++;
          if (a.추정.includes(AXIS_NAME[k])){ if (v !== 50) 틀림++; return; }
          if ((v >= 50) !== (a.code[k] === 'HLDG'[k])) 틀림++;
        });
        const s = personaSaved(a.code, [a.개척, a.단골, a.모험, a.만족]);
        if (!s || [s.개척, s.단골, s.모험, s.만족].join() !== [a.개척, a.단골, a.모험, a.만족].join()) 틀림++;
        try { personaWhyHtml(a, a.code); personaWhyHtml(a, a.code, { 남: true }); } catch (e){ msgs.push('근거 줄 터짐 ' + e.message); }
      }
    if (틀림) msgs.push(`막대와 글자가 어긋난 곳 ${틀림}/${본}`);
    bad('흔들림 막기 · 막대=글자 · 올린 값 되읽기 · 근거 줄', [...new Set(msgs)].slice(0, 5));
  }

  /* 6. 궁합. **표를 안 적고 계산으로 뽑으므로 성질만 봅니다.**
        자기 자신을 고르지 않을 것, 최고와 최악이 다를 것, 점수가 대칭일 것
        (내가 본 너와 네가 본 나가 달라지면 아무도 안 믿습니다). */
  {
    const msgs = [];
    for (const code of Object.keys(PERSONA16)){
      const m = personaMates(code);
      if (m.best === code || m.worst === code) msgs.push(`${code}: 자기 자신을 고름`);
      if (m.best === m.worst) msgs.push(`${code}: 최고와 최악이 같음`);
      if (m.bestScore <= m.worstScore) msgs.push(`${code}: 최고가 최악 이하`);
      if (!m.bestLine || !m.worstLine) msgs.push(`${code}: 문구가 빔`);
      if (!PERSONA16[m.best] || !PERSONA16[m.worst]) msgs.push(`${code}: 상대가 표에 없음`);
      for (const other of Object.keys(PERSONA16))
        if (personaMatch(code, other) !== personaMatch(other, code))
          msgs.push(`${code}↔${other}: 점수가 서로 다름`);
    }
    bad('궁합 16개 · 자기 제외 · 대칭 · 최고>최악', [...new Set(msgs)].slice(0, 5));
  }

  /* 6-b. **문구가 카드마다 다른가.** 성질만 봐서는 이걸 못 잡습니다 —
        한 번 고치고도 서른두 칸이 여덟 가지였습니다. 개척·모험만 읽고
        단골·만족을 안 읽어서, 나머지 두 자리가 다른 네 유형이 같은 말을
        썼습니다. 표를 눈으로 뽑아보고서야 알았습니다. 이제는 셉니다.

        짝짓기도 같이 봅니다. 최고·최악이 **열여섯 유형에 한 번씩** 고르게
        돌아가야 합니다. 한 유형이 여럿의 최고로 몰리면 그 유형만 인기가
        되고 나머지는 카드에 이름조차 안 실립니다. */
  {
    const codes = Object.keys(PERSONA16), msgs = [];
    const mates = codes.map(c => personaMates(c));
    const 문구 = new Set(mates.flatMap(m => [m.bestLine, m.worstLine]));
    if (문구.size !== codes.length * 2)
      msgs.push(`문구가 ${codes.length * 2}칸에 ${문구.size}가지뿐`);
    for (const [무엇, key] of [['최고', 'best'], ['최악', 'worst']]){
      const 셈 = {};
      for (const m of mates) 셈[m[key]] = (셈[m[key]] || 0) + 1;
      const 안뽑힘 = codes.filter(c => !셈[c]);
      if (안뽑힘.length) msgs.push(`${무엇}로 한 번도 안 뽑힌 유형: ${안뽑힘.join(',')}`);
      /* 극단 짝은 짝짓기가 일대일이라 서로가 서로를 고릅니다. 안 그러면
         가중치가 어긋난 것입니다. */
      codes.forEach((c, i) => {
        const 짝 = mates[i][key];
        if (personaMates(짝)[key] !== c) msgs.push(`${c}의 ${무엇} ${짝} 가 ${c} 를 안 고름`);
      });
    }
    bad('궁합 문구가 16장 다 다른가 · 짝이 서로를 고르는가', [...new Set(msgs)].slice(0, 5));
  }

  /* 7. 상위% 와 MRZ. 카드 아래 장식이지만 undefined 가 박히면 흉합니다. */
  {
    const msgs = [];
    for (const c of [0, 1, 3, 6, 10, 15, 20, 30, 45, 120]){
      const r = personaRank(c);
      if (!/^상위 [0-9.]+%$/.test(r)) msgs.push(`${c}개국 → '${r}'`);
    }
    const z = personaMrz('FLNG', 12, 40, personaRank(12), 2026);
    if (/undefined|NaN/.test(z)) msgs.push(`MRZ: ${z}`);
    bad('상위% 와 MRZ 문자열', msgs);
  }

  /* ── 카드 안 추천 줄이 넘치면 덜어내는가(b399) ────────────────────────
     캔버스는 **삐져나간 글자를 잘라주지 않습니다.** 그냥 카드 밖에 그려집니다.
     화면에서는 "좀 길구나" 로 보이고 아무도 버그로 안 읽습니다. 그래서 잽니다.
     `measureText` 를 흉내 낸 자로 봅니다 — 진짜 글꼴이 없어도 규칙은 같습니다. */
  {
    const g = { measureText: t => ({ width: [...t].length * 10 }) };
    const msgs = [];
    if (줄여쓰기(g, '나하', 1000) !== '나하') msgs.push('넉넉한데 줄였음');
    /* 좁게 주면 줄어야 합니다. 안 줄면 상자 밖으로 나갑니다. */
    const 좁게 = 줄여쓰기(g, '로스앤젤레스', 45);
    if (g.measureText(좁게).width > 45) msgs.push(`안 줄었음: ${좁게}`);
    if (!좁게.endsWith('…')) msgs.push(`줄였는데 … 가 없음: ${좁게}`);
    /* **하나도 안 들어가도 빈 줄을 내지 않습니다.** 상자 안이 비면 고장으로
       보입니다 — 한 글자와 … 는 남깁니다. */
    const 극단 = 줄여쓰기(g, '로스앤젤레스', 0);
    if (극단 !== '로…') msgs.push(`0폭에서 '${극단}' ('로…' 기대)`);
    bad('카드 안 추천 이름이 넘치면 끝을 줄이는가', msgs);
  }

  console.table(out);
  const ng = out.filter(o => o.결과.startsWith('✗'));
  const warn = out.filter(o => o.결과.startsWith('⚠'));
  console.log(ng.length ? `✗ ${ng.length}건 틀림`
            : warn.length ? `✓ 틀린 것 없음 · ⚠ 살펴볼 것 ${warn.length}건`
            : `✓ ${out.length}건 모두 통과`);
  return out;
};

/* ── 그리기 자가검사 (개발용) ────────────────────────────────────────
 * 콘솔에서 **`await __drawCheck()`** — 위 __cardCheck 와 따로 둡니다.
 * 실제로 캔버스에 그려보므로 느리고(카드 한 장에 1초쯤) 기다려야 합니다.
 * 빠른 검사에 섞으면 `__cardCheck().filter(...)` 가 약속을 돌려주게 되어
 * 부르는 쪽이 다 깨집니다.
 *
 * 보는 것은 하나입니다: **공유된 그림만 보고 여기로 찾아올 수 있는가.**
 * 이 앱은 앱스토어에 없는 PWA 라 이름만 적혀 있으면 검색해도 안 나옵니다.
 */
if (typeof window !== 'undefined') window.__drawCheck = async () => {
  const out = [];
  const bad = (name, msgs) =>
    out.push({ 항목:name, 결과: msgs.length ? '✗ ' + msgs.join(' / ') : '✓' });

  /* 글자는 배경 그라데이션 위에 반투명으로 얹힙니다. 절대 밝기로는 못 봅니다 —
     같은 줄에서 **좌우 끝(글자 없는 자리)과 가운데의 대비**를 봅니다. */
  const 대비 = (g, W, y0, h) => {
    const d = g.getImageData(0, y0, W, h).data;
    let 끝 = 0, n = 0, 최대 = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < W; x++){
        const i = (y * W + x) * 4, b = (d[i] + d[i+1] + d[i+2]) / 3;
        if (x < 60 || x > W - 60){ 끝 += b; n++; }
        else if (b > 최대) 최대 = b;
      }
    return 최대 - 끝 / n;
  };
  const 그리기 = async spec => {
    const { blob } = await cardImage(spec, 'square');
    const bmp = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0);
    return { g, W: cv.width, H: cv.height, size: blob.size };
  };
  /* 배경에 옅게 깔린 것을 재려면 '아주 밝은 점이 몇 개인가' 가 아니라
     '전체가 얼마나 밝아졌는가' 를 봐야 합니다. */
  const 평균밝기 = x => {
    const d = x.g.getImageData(0, Math.round(x.H * .20), x.W, Math.round(x.H * .22)).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += d[i];
    return s / (d.length / 4);
  };
  const 밝은픽셀 = x => {
    const d = x.g.getImageData(0, Math.round(x.H * .45), x.W, Math.round(x.H * .2)).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 235 && d[i+1] > 235) n++;
    return n;
  };
  const base = { g:'rare', icon: PERSONA_ICON.globe, sub:'내 발자국',
                 title:'27개국', nums:'195개국 중 13.8%' };

  try {
    const a = await 그리기(base);
    const m = [];
    if (!a.size) m.push('빈 그림이 나옴');
    /* ⚠ **'주소가 그림 안에 있는가' 를 '이름이 있는가' 로 바꿨습니다(b313).**
       주소를 일부러 뺐는데(위 서명 자리 참고) 검사는 그대로 두면, 매번
       걸리는 것을 무시하게 되고 그러면 진짜가 섞여도 안 보입니다.
       규칙이 화면보다 옛것이면 규칙이 아니라 소음입니다.
       도메인을 사서 주소를 되살리면 여기도 같이 되살리십시오. */
    const 이름 = 대비(a.g, a.W, a.H - 70, 26);
    const 여백 = 대비(a.g, a.W, a.H - 26, 20);
    if (이름 < 여백 + 25)
      m.push(`이름(기로)이 그림에 안 보임 (대비 ${Math.round(이름)} · 여백 ${Math.round(여백)})`);
    bad('공유된 그림에 이름이 남는가', m);
  } catch (e){ bad('공유된 그림에 이름이 남는가', ['터짐: ' + e.message]); }

  try {
    const m = [];
    const paths = [0,1,2,3,4].map(i =>
      `<path class="been" d="M${100 + i*160} 120 h120 v90 h-120 z"/>`).join('');
    const art = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 19 1000 387">
        <style>path{fill:rgba(255,255,255,.16)}path.been{fill:#fff}</style>${paths}</svg>`;
    const 없음 = await 그리기(base);
    const 있음 = await 그리기({ ...base, art, artRatio: 387/1000 });
    /* ⚠ **'밝은 픽셀 수' 로 재던 것을 '평균 밝기' 로 바꿨습니다.**
       b315 에서 지도를 배경으로 옮기면서 50% 투명으로 깔립니다. 흰색이
       회색(128)이 되어 '밝은 픽셀(235 이상)' 이 하나도 안 잡혔고, 그림은
       멀쩡한데 검사만 실패했습니다. 규칙이 화면보다 옛것이면 소음입니다. */
    if (평균밝기(있음) < 평균밝기(없음) + 3) m.push('지도를 넣었는데 그림이 안 바뀜');
    /* **그림이 깨져도 카드는 나와야 합니다.** 지도 하나 때문에 공유를 통째로
       못 하게 되면 안 됩니다. */
    const 깨짐 = await 그리기({ ...base, art:'<svg>망가진 것', artRatio: .4 });
    if (!깨짐.size) m.push('그림이 깨지니 카드가 통째로 안 나옴');
    bad('발자국 지도가 카드에 들어가는가 · 깨져도 버티는가', m);
  } catch (e){ bad('발자국 지도가 카드에 들어가는가', ['터짐: ' + e.message]); }

  console.table(out);
  const ng = out.filter(o => o.결과.startsWith('✗'));
  console.log(ng.length ? `✗ ${ng.length}건 틀림` : `✓ ${out.length}건 모두 통과`);
  return out;
};

