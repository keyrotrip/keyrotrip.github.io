/* ── 일정 지도 · 지도 링크 ────────────────────────────────────────────
 * 일정 위에 얹는 작은 지도(Leaflet), 그리고 일정 한 줄에서 '지도에서 보기 ·
 * 길찾기' 주소를 만드는 것. 메모를 조각내는 것도 여기 있습니다 — 지도 주소를
 * 만들 때 메모에서 주소를 꺼내 쓰기 때문입니다.
 *
 * ── app.js 에서 떼어낸 열한 번째 조각입니다(b338) ────────────────────
 * **딸린 것이 하나도 없습니다.** app.js 만 아는 이름을 한 개도 안 씁니다.
 * `prep.js` 에 이어 두 번째 ctx 0 입니다.
 *
 * 밖이 이걸 많이 부릅니다(`drawPlanMap` 14곳 · `mapLinks` 8곳). 그건 **떼면
 * 안 되는 이유가 아니라 내보내면 되는 것**입니다 — 방향이 반대입니다.
 * 딸린 것은 '이 조각이 남을 얼마나 아느냐'지 '남이 이걸 얼마나 부르느냐'가
 * 아닙니다. 오히려 여러 곳이 부르는 것일수록 한곳에 모아둘 값이 큽니다.
 *
 * 층: dom.js · calc.js · trip.js 만 씁니다. 네트워크도 DB 도 안 씁니다 —
 * Leaflet 을 받아오는 것 하나뿐입니다. */
import { $, esc } from './dom.js?v=b827';
import { hm, 좌표수상 } from './calc.js?v=b827';
import { plans, legs, pickedDay, catFilter } from './trip.js?v=b827';

/* ── 일정 지도 ───────────────────────────────────────────────────────
 * 목록만 보면 오늘 얼마나 흩어져 다니는지 안 보입니다. 위에 지도를 얹습니다.
 * 좌표가 있는 일정만 찍고, 하나도 없으면 통째로 접습니다.
 * 글자는 영어 지도를 씁니다 — 현지 문자로만 나오면 어디가 어딘지 못 읽습니다. */
let lmap = null, lmarks = null;

/* ── Leaflet 은 쓸 때 불러옵니다 ──────────────────────────────────────
 * 전에는 index.html 의 head 에 defer 로 걸려 있었습니다. 그런데 defer
 * 스크립트와 모듈 스크립트는 **문서 순서대로** 실행됩니다. unpkg 가 느리거나
 * 매달리면 뒤에 있는 app.js 가 아예 실행되지 않고, 그러면 __t2booted 가
 * 안 켜져 부팅 실패 상자만 남습니다. **캐시가 멀쩡해도 그렇습니다** —
 * 재현해서 확인했습니다. 지도 하나가 앱 전체를 붙잡을 이유가 없습니다.
 *
 * 여기서 부르면 늦어도 지도만 늦습니다. 못 받아오면 지도만 안 나옵니다.
 * 실패하면 약속을 지워 다음에 다시 해봅니다 — 한 번 끊겼다고 영영 포기하면
 * 연결이 돌아와도 지도가 안 나옵니다. */
let leafletP = null, leafletWaiting = false;
export function ensureLeaflet(){
  if (window.L) return Promise.resolve(true);
  if (leafletP) return leafletP;
  leafletP = new Promise(resolve => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload  = () => resolve(true);
    s.onerror = () => { leafletP = null; resolve(false); };
    document.head.appendChild(s);
  });
  return leafletP;
}

/* **지도는 기본으로 접습니다.** 재보니 앱 폭 480px 에서 첫 일정 줄이
   3일 여행 560px, 11일 여행 722px 아래에서 시작했습니다. 아이폰 홈 화면
   앱의 세로 여유가 780px 안팎이라 긴 여행은 일정이 한 줄도 안 보였습니다.
   지도는 190px 을 먹는데, 여는 목적이 대개 "오늘 뭐 하지"라 매번 필요하진
   않습니다. 고른 것은 기기에 남겨서 지도를 즐겨 보는 사람은 한 번만 켜면
   됩니다. */
let mapOpen = localStorage.getItem('t2:map') === '1';

function drawMapBtn(pts){
  const b = $('mapbtn');
  /* 찍을 게 없으면 띠도 없앱니다 — 눌러서 빈 지도를 보게 할 이유가 없습니다. */
  b.classList.toggle('hide', !pts);
  b.classList.toggle('on', mapOpen && !!pts);
  /* **글자가 상태를 말해야 합니다**(b365). 전에는 머리줄에 `지도` 라고만
     적혀 있어서, 지도가 이미 펼쳐진 채로 그 단추가 서 있으면 그것이 여는
     것인지 닫는 것인지 알 수가 없었습니다. 지금 하면 무슨 일이 나는지를
     적습니다. */
  b.textContent = mapOpen ? '지도 접기' : '지도 보기';
}

$('mapbtn').addEventListener('click', () => {
  mapOpen = !mapOpen;
  localStorage.setItem('t2:map', mapOpen ? '1' : '0');
  drawPlanMap();
});

export function drawPlanMap(){
  const box = $('planmap');
  /* **찍을 것을 먼저 세고 나서 Leaflet 을 부릅니다.** 전에는 순서가 반대라,
     지도를 볼 생각이 없어도 열기만 하면 CDN 에서 스크립트와 CSS 를
     받아왔습니다. 이제 접혀 있으면 아예 안 받습니다. */
  let show = pickedDay ? plans.filter(p => p.date === pickedDay) : plans;
  if (catFilter) show = show.filter(p => p.category === catFilter);
  /* ⚠ **수상한 좌표는 안 찍습니다(b732).** 핀 하나가 273km 밖에 있으면
     `fitBounds` 가 거기까지 담느라 **지도가 통째로 줌아웃**되어 그날 일정이
     한 점으로 뭉칩니다 — 틀린 핀 하나가 지도 전체를 못 쓰게 만듭니다.
     판정은 calc.js 의 `좌표수상` 한 곳입니다(그쪽 주석에 사연). */
  const pts = show.filter(p => p.lat != null && p.lng != null && !좌표수상(p, legs, 120, plans));
  drawMapBtn(pts.length);
  if (!pts.length || !mapOpen){ box.classList.add('hide'); return; }

  /* 아직 안 왔으면 자리를 감춰두고 불러옵니다. 오면 그때 다시 그립니다 —
     그래서 부르는 쪽(열 곳)은 이 함수가 기다리는지 몰라도 됩니다. */
  if (!window.L){
    box.classList.add('hide');
    if (!leafletWaiting){
      leafletWaiting = true;
      ensureLeaflet().then(ok => { leafletWaiting = false; if (ok) drawPlanMap(); });
    }
    return;
  }
  box.classList.remove('hide');

  if (!lmap){
    lmap = L.map(box, { zoomControl:false, attributionControl:false });
    /* ⚠⚠ **CARTO 를 걷었습니다(b625).** 어느 날부터 키 없는 요청에
       타일마다 「API KEY REQUIRED」를 대각선으로 찍어 보냅니다 —
       지도가 통째로 그렇게 나옵니다(사용자 사진, 픽셀로 확인).
       무료로 열려 있던 것이 닫힌 것이라 우리가 고칠 수 있는 것이 아닙니다.
       ⚠ OSM 본가 타일은 키가 없습니다. 대신 색이 알록달록해서 종이
         디자인과 안 맞습니다 — **CSS 로 색을 빼서** 맞춥니다
         (app.css 의 `.leaflet-tile`). 타일을 고치는 게 아니라
         화면에서 걸러내는 것이라 정책에도 안 걸립니다.
       ⚠ `{r}`(고해상도)와 `subdomains` 를 뺍니다 — OSM 본가는 @2x 를
         안 주고, 하위 도메인도 안 씁니다. 두면 404 가 납니다.
       ⚠ 출처 표시는 **의무**입니다. 지우지 마십시오. */
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom:19 }).addTo(lmap);
    L.control.attribution({ prefix:false })
      .addAttribution('&copy; OpenStreetMap').addTo(lmap);
    lmarks = L.layerGroup().addTo(lmap);
  }
  lmarks.clearLayers();

  /* 번호를 붙여야 그날 어떤 차례로 도는지 보입니다. */
  pts.forEach((p, i) => {
    const m = L.marker([p.lat, p.lng], { icon: L.divIcon({
      className:'pmk', iconSize:[26,26], iconAnchor:[13,13],
      html:`<span>${i + 1}</span>` }) });
    m.bindPopup(`<b>${esc(p.title)}</b>` +
      (p.start_time ? `<br>${esc(hm(p.start_time))}` : ''));
    m.addTo(lmarks);
  });
  /* 하루만 보고 있으면 다니는 순서를 선으로 잇습니다. */
  if (pickedDay && pts.length > 1)
    L.polyline(pts.map(p => [p.lat, p.lng]),
      { color:'#0066cc', weight:2, opacity:.5, dashArray:'4 4' }).addTo(lmarks);

  const b = L.latLngBounds(pts.map(p => [p.lat, p.lng]));
  lmap.fitBounds(b, { padding:[28,28], maxZoom:15 });
  setTimeout(() => lmap.invalidateSize(), 50);   /* 접혀 있다 펴지면 크기를 다시 잽니다 */
}

/* ── 메모 쪼개기 ─────────────────────────────────────────────────────
 * 메모 한 덩어리를 그대로 뿌리면 읽히지 않습니다. 실제 메모는 이런 꼴입니다.
 *   "🚇 이동방법: 신바시역 ➡️ [긴자선] 탑승 / 💰 교통비: 약 210엔 / 7번 출구 도보 4분"
 * 슬래시로 자르되 괄호 안의 슬래시는 건드리지 않습니다.
 * "이동방법:" "교통비:" 처럼 앞에 이름이 붙은 조각은 따로 모읍니다. */
export function splitParts(s){
  const raw = String(s).split(/\s+\/\s+/), out = [];
  let buf = '', depth = 0;
  for (const piece of raw){
    buf = buf ? buf + ' / ' + piece : piece;
    depth += (piece.match(/[([]/g) || []).length - (piece.match(/[)\]]/g) || []).length;
    if (depth <= 0){ out.push(buf); buf = ''; depth = 0; }
  }
  if (buf) out.push(buf);
  return out;
}
/* ── 지도 링크 ───────────────────────────────────────────────────────
 * '지도에서 보기'가 **제목만으로 검색**하고 있었습니다
 * (`?api=1&query=아카리조명`). 이름이 같은 가게는 세계에 여럿이라 구글이
 * 아무 곳이나 고릅니다 — 사용자가 "엉뚱한 곳이 나온다"고 한 것이 이것입니다.
 *
 * 그런데 우리는 **더 정확한 것을 이미 둘이나 갖고 있었습니다.**
 *   1. 메모에 붙여넣은 지도 주소 — 사용자가 직접 그 자리를 짚어준 것
 *   2. 좌표(`lat`·`lng`) — 재보니 100개 중 89개에 들어 있는데 한 번도 안 썼습니다
 * 둘 다 버리고 이름으로 검색하고 있었습니다.
 *
 * **순서는 메모의 주소가 먼저입니다.** 좌표는 '좌표 채우기'가 짐작해 넣은
 * 것이고 메모의 주소는 사람이 손으로 짚은 것입니다. 짐작보다 사람이 먼저입니다.
 * 좌표만 있으면 `/@lat,lng,17z` 로 **그 자리를 보면서 이름을 찾게** 합니다 —
 * `query=lat,lng` 로 핀만 찍으면 정확은 해도 가게 정보(영업시간·후기)가
 * 통째로 사라집니다. 이 꼴이면 이름을 못 찾아도 **지도는 옳은 자리**에 섭니다.
 * 둘 다 없으면 이름에 **그 구간의 도시**를 붙입니다 — 그것만으로도 나라를
 * 건너뛰는 일은 없어집니다. */

/* 어느 앱에서 복사했는지는 사용자가 정할 일입니다. 구글·애플·네이버·카카오를
   다 받습니다. 짧은 주소(maps.app.goo.gl)는 우리가 펴볼 수 없으므로 그대로 엽니다 —
   펴보려고 남의 서버에 물어보면 응답이 달라지는 문제가 생깁니다(b265 에서 겪음). */
const MAP_URL = new RegExp('^https?://(?:' + [
  'maps\\.app\\.goo\\.gl', 'goo\\.gl/maps', 'maps\\.google\\.[a-z.]+',
  '(?:www\\.)?google\\.[a-z.]+/maps', 'maps\\.apple\\.com',
  'naver\\.me', '(?:m\\.)?map\\.naver\\.com', 'place\\.map\\.kakao\\.com', 'kko\\.to',
].join('|') + ')(?:[/?]|$)', 'i');

export function memoMapUrl(...texts){
  for (const t of texts)
    for (const m of String(t || '').matchAll(/https?:\/\/[^\s<>"']+/g))
      /* 문장 끝의 문장부호가 주소에 딸려 들어옵니다 */
      if (MAP_URL.test(m[0])) return m[0].replace(/[),.;]+$/, '');
  return null;
}

/* 한 줄(일정 또는 후보)에서 '지도에서 보기'·'길찾기' 주소를 만듭니다.
   `city` 는 이름만으로는 어느 나라인지 모를 때 붙일 도시 이름입니다. */
export function mapLinks(o, city){
  const geo = o.lat != null && o.lng != null;
  const name = encodeURIComponent(o.title_local || o.title || '');
  const q = encodeURIComponent([o.title_local || o.title, city].filter(Boolean).join(' '));
  const url = memoMapUrl(o.memo, o.move_note);
  const see = url ? url
    : geo ? (name ? `https://www.google.com/maps/search/${name}/@${o.lat},${o.lng},17z`
                  : `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}`)
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
  /* 길찾기는 **목적지를 알아야** 합니다. 짧은 주소로는 알 수 없으므로
     좌표가 있으면 좌표로, 없으면 이름+도시로 갑니다. */
  const go = `https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=${
    geo ? `${o.lat},${o.lng}` : q}`;
  return { see, go };
}
