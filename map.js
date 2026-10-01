/* ── 세계지도 · 다녀온 국가 ──────────────────────────────────────────
 * 다녀온 곳을 세계지도에 칠하고, 나라별로 모아 보여주는 화면입니다.
 * 손가락으로 밀고 넓히는 것(핀치·휠)도 여기 있습니다.
 *
 * ── app.js 에서 떼어낸 두 번째 조각입니다(b322) ─────────────────────
 * persona.js(b321)와 같은 방식입니다. app.js 를 import 하지 않고,
 * app.js 만 아는 것은 `setMapCtx` 로 받습니다 — 그래야 고리가 안 생깁니다.
 * `me` 는 로그인할 때마다 바뀌므로 값이 아니라 **함수**로 받습니다.
 *
 * 지도 좌표(WORLD_PATHS)는 app.js 진입점이 `#worldland` 에 한 번 넣어둡니다.
 * 여기서는 그 자리에 그려진 것을 읽고 칠하기만 합니다 — 좌표를 두 곳에서
 * 넣으면 화면과 카드가 어긋납니다.
 *
 * 층: dom.js · db.js · cities.js · card.js · net.js 만 씁니다. */
import { $, esc, toast, flagOf, flagOk, emptyDo, backLabel, toTop,
         coverDeck } from './dom.js?v=b819';
import { openCity } from './city.js?v=b819';
import { distKm } from './calc.js?v=b819';
import { sb } from './db.js?v=b819';
import { cities, countryName, continentOf } from './cities.js?v=b819';
/* ⚠ `PERSONA_ICON` 은 b649 에 안 쓰게 됐습니다 — 발자국 카드가 여권 스탬프
   면으로 바뀌면서 선 아이콘 자리가 없어졌습니다(큰 수와 지도가 그 일을
   합니다). 안 쓰는 것을 가져오면 나중에 "여기도 쓰나" 하고 헷갈립니다. */
import { shareCard } from './card.js?v=b819';

/* UN 회원 193 + 옵서버 2. 여행앱들이 쓰는 기준값입니다.
   **app.js 도 씁니다**(발자국 막대) — 두 곳에 적으면 언젠가 한쪽만 고칩니다.
   여기서 내보내고 app.js 가 가져다 씁니다. */
export const UN_COUNTRIES = 195;

let ctx = { me: () => null, loadCities: async () => {}, showApp: () => {} };
export function setMapCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 세계지도와 통계 ─────────────────────────────────────────────────
 * 숫자만 늘어놓으면 아무도 안 봅니다. 지도 위에 얹어야 채우고 싶어집니다.
 *
 * 퍼센트는 국가로만 셉니다. 도시는 우리가 가진 313곳이 분모라
 * "전 세계 도시의 몇 퍼센트"라고 말할 수가 없습니다.
 * 분모는 UN 기준 195개국(회원 193 + 옵서버 2)을 대륙별로 나눈 수입니다. */
/* 분석 탭도 이 표를 씁니다(b447) — 대륙별 진행도의 분모. 두 벌로 두면
   한쪽만 고쳐집니다. */
export const CONT = [['아시아', 48], ['유럽', 44], ['아프리카', 54],
              ['북아메리카', 23], ['남아메리카', 12], ['오세아니아', 14]];
/* 대륙별로 당겨 보는 자리. 가운데와 폭만 정하고 높이는 화면 비율에서 냅니다 —
   그래야 viewBox 비율이 화면과 같아져서 여백 없이 딱 맞고, 손가락 좌표를
   지도 좌표로 바꾸는 계산도 한 줄로 끝납니다. */
/* ⚠ **내보냅니다(b499).** 분석 탭의 대륙 배지가 같은 창을 씁니다 — 여기서
   자르는 값과 저기서 자르는 값이 다르면 같은 대륙이 두 모양이 됩니다. */
export const CONT_VIEW = {
  '전체':      { cx:500, cy:212, w:1000 },
  '아시아':    { cx:750, cy:193, w:380 },
  '유럽':      { cx:549, cy:105, w:195 },
  '아프리카':  { cx:544, cy:248, w:225 },
  '북아메리카':{ cx:195, cy:145, w:360 },
  '남아메리카':{ cx:340, cy:307, w:160 },
  '오세아니아':{ cx:897, cy:328, w:215 } };

const px = v => (Number(v) + 180) * (1000 / 360);   /* 경도 → x */
const py = v => (90 - Number(v)) * (500 / 180);     /* 위도 → y */
let mapCities = [];

/* ── 도시 깃발은 안 그립니다(b415) ─────────────────────────────────────
 * 전에는 다녀온 도시마다 작은 깃발을 꽂았습니다. 실제로 세어보니
 * **74개 도시에 깃발 148조각**(깃대 74 + 깃발천 74)이었는데 나라 색칠은
 * 26개뿐이라, 유럽처럼 몰린 곳은 깃발이 덩어리로 뭉개져서 **색칠을
 * 오히려 가렸습니다.** 지도는 「어디까지 가봤나」를 한눈에 보여주는
 * 자리인데 그게 안 됐습니다.
 *
 * ⚠ **잃는 것이 없습니다.** 깃발은 누르면 도시가 열렸는데(data-pin),
 *   아래 「국가별 다녀온 도시」 칩에 **같은 data-pin 단추**가 있습니다.
 *   도시를 여는 길은 그대로입니다.
 *
 * ⚠ 되살릴 수 있게 `#pins` 그룹은 index.html 에 그대로 뒀습니다.
 *   되살린다면 **전체 보기 말고 확대했을 때만** 그리십시오 —
 *   지저분했던 것은 전체 보기입니다.
 *
 * 깃발 모양이 필요하면 git 에서 b414 의 drawPins 를 보십시오. */

/* 보이는 창. 가운데와 폭만 들고 있고 높이는 화면 비율에서 냅니다. */
let vb = { ...CONT_VIEW['전체'] };
const MAP_TOP = 15, MAP_BOT = 410;      /* 남극을 뺀 세로 범위 */

function applyView(){
  const el = $('worldsvg'), r = el.getBoundingClientRect();
  const aspect = (r.width && r.height) ? r.height / r.width : 0.4;
  vb.w = Math.min(1000, Math.max(40, vb.w));        /* 40 이면 도시 하나가 꽉 찹니다 */
  const h = vb.w * aspect;
  /* 세로가 지도보다 길면 위아래에 빈 자리를 둡니다.
     가로를 줄여 맞추던 것이 문제였습니다 — 손가락으로 키워도 여기서 도로
     계산해 버려서 크게 보기에서는 확대가 아예 안 먹었습니다. */
  const span = MAP_BOT - MAP_TOP, mid = (MAP_TOP + MAP_BOT) / 2;
  vb.cx = Math.min(1000 - vb.w / 2, Math.max(vb.w / 2, vb.cx));
  vb.cy = h >= span ? mid
        : Math.min(MAP_BOT - h / 2, Math.max(MAP_TOP + h / 2, vb.cy));
  el.setAttribute('viewBox',
    `${(vb.cx - vb.w / 2).toFixed(1)} ${(vb.cy - h / 2).toFixed(1)} ` +
    `${vb.w.toFixed(1)} ${h.toFixed(1)}`);
}

function setMapView(name){
  /* 고른 이름을 mapView 에 적어두고 있었는데 **읽는 곳이 한 군데도 없었습니다.**
     대륙 칩을 뺄 때 읽는 쪽만 지우고 쓰는 쪽이 남은 것입니다. 걷어냈습니다. */
  vb = { ...(CONT_VIEW[name] || CONT_VIEW['전체']) };
  applyView();
}
/* 두 번 두드리면 세계 전체로 돌아옵니다. 대륙 칩을 뺐으니 되돌릴 길이 있어야 합니다. */
$('worldsvg').addEventListener('dblclick', () => setMapView('전체'));

/* 크게 보기 — 지도만 화면을 다 덮습니다. 손바닥만 한 지도에서는
   대륙을 파고들며 보기가 어렵습니다. */
/* 큰 지도를 켠 채로 화면을 벗어나면 어두운 판과 단추가 그대로 남아
   앱 전체를 덮어버립니다. 화면을 옮길 때마다 여기서 걷어냅니다. */
export function shutBigMap(){
  document.querySelector('.mapwrap')?.classList.remove('big');
  ['mapclose','mapzoombtns'].forEach(id => $(id)?.remove());
  document.body.classList.remove('sheeton', 'bigmap');
}

$('mapbig').addEventListener('click', () => {
  const w = document.querySelector('.mapwrap');
  if (w.classList.contains('big')) return;
  w.classList.add('big');
  document.body.classList.add('bigmap');         /* 큰 지도 동안 하단바를 숨깁니다(b482) */
  document.body.classList.add('sheeton');        /* 뒤가 밀리지 않게 */

  const add = (id, html, css) => {
    const el = document.createElement(id === 'mapzoombtns' ? 'div' : 'button');
    el.id = id; el.innerHTML = html; if (css) el.style.cssText = css;
    document.body.appendChild(el); return el;
  };
  const close = add('mapclose', '닫기');
  const zoom  = add('mapzoombtns',
    '<button data-z="in" aria-label="크게">+</button><button data-z="out" aria-label="작게">−</button>' +
    '<button data-z="fit">전체</button>');

  /* 손가락이 안 먹는 기기도 있고 마우스만 있는 화면도 있습니다.
     가운데를 잡고 폭만 줄이거나 늘립니다. */
  zoom.onclick = e => {
    const b = e.target.closest('[data-z]'); if (!b) return;
    if (b.dataset.z === 'fit'){ setMapView('전체'); return; }
    vb.w *= b.dataset.z === 'in' ? 1 / 1.45 : 1.45;
    applyView();
  };
  close.onclick = () => { shutBigMap(); setMapView('전체'); };

  /* 세로로 긴 화면에서 세계 전체를 펼치면 위아래가 텅 빕니다.
     열 때는 빈 곳 없이 꽉 차는 배율에서 시작하고, 전체는 단추로 봅니다. */
  applyView();
  const r = $('worldsvg').getBoundingClientRect();
  const aspect = (r.width && r.height) ? r.height / r.width : .4;
  vb.w = Math.min(1000, (MAP_BOT - MAP_TOP) / aspect);
  vb.cy = (MAP_TOP + MAP_BOT) / 2;
  /* 다녀온 곳이 있으면 그쪽을 가운데 둡니다 — 빈 바다를 보여줄 이유가 없습니다. */
  const xs = mapCities.filter(c => c.center_lng != null).map(c => px(c.center_lng));
  if (xs.length) vb.cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  applyView();
});

/* ── 손가락과 휠 ─────────────────────────────────────────────────────
 * 대륙 칩만으로는 원하는 데를 못 봅니다. 끌어서 옮기고 오므려서 키웁니다.
 * viewBox 비율을 화면 비율과 같게 맞춰뒀으므로 화면 픽셀 하나가
 * 지도 좌표 (폭/화면폭) 만큼입니다 — 변환이 곱셈 한 번입니다. */
{
  const el = $('worldsvg');
  const pts = new Map();          /* 지금 눌린 손가락들 */
  let last = null, moved = 0;

  const perPx = () => vb.w / (el.getBoundingClientRect().width || 1);
  const mid = () => {
    const a = [...pts.values()];
    return { x: a.reduce((s, p) => s + p.x, 0) / a.length,
             y: a.reduce((s, p) => s + p.y, 0) / a.length };
  };
  const spread = () => {
    const a = [...pts.values()];
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
  };

  el.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
    el.setPointerCapture(e.pointerId);
    el.classList.add('drag');
    moved = 0;
    last = pts.size === 2 ? { ...mid(), d: spread() } : { ...mid(), d: null };
  });

  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
    const m = mid();
    if (!last){ last = { ...m, d: pts.size === 2 ? spread() : null }; return; }

    const k = perPx();
    vb.cx -= (m.x - last.x) * k;         /* 끄는 방향과 지도가 같이 움직여야 합니다 */
    vb.cy -= (m.y - last.y) * k;
    moved += Math.abs(m.x - last.x) + Math.abs(m.y - last.y);

    if (pts.size === 2 && last.d){
      const d = spread();
      vb.w *= last.d / d;                /* 벌리면 폭이 줄고 = 확대 */
      last.d = d;
    }
    last.x = m.x; last.y = m.y;
    applyView();
  });

  const up = e => {
    pts.delete(e.pointerId);
    last = pts.size ? { ...mid(), d: pts.size === 2 ? spread() : null } : null;
    if (!pts.size) el.classList.remove('drag');
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);

  el.addEventListener('wheel', e => {
    e.preventDefault();
    const r = el.getBoundingClientRect(), k = perPx();
    /* 커서가 가리키던 지점이 제자리에 있어야 확대가 자연스럽습니다. */
    const ux = vb.cx + (e.clientX - r.left - r.width / 2) * k;
    const uy = vb.cy + (e.clientY - r.top - r.height / 2) * k;
    const f = e.deltaY > 0 ? 1.2 : 1 / 1.2;
    const before = vb.w;
    vb.w = Math.min(1000, Math.max(40, vb.w * f));
    const s = vb.w / before;
    vb.cx = ux + (vb.cx - ux) * s;
    vb.cy = uy + (vb.cy - uy) * s;
    applyView();
  }, { passive:false });

  /* 끌고 나서 손을 떼는 순간 핀이 눌리면 안 됩니다. */
  el.addEventListener('click', e => {
    if (moved > 8){ e.stopPropagation(); moved = 0; }
  }, true);

  addEventListener('resize', () => {
    if (!$('mappane').classList.contains('hide')) applyView();
  });
}

/* ── 다녀온 국가 ────────────────────────────────────────────────────
 * 사용자 지적: **"국가 눌러서 또 세계지도로 가고, 대륙별로 눌러야 어디 갔는지
 * 알 수 있잖아. 국가별로 어디 갔는지 한눈에 보이는 페이지가 있어야 해."**
 * 맞습니다. 지도 화면의 대륙 펴기는 파고드는 자리이고, 여기는 훑는 자리입니다.
 * 대륙으로 묶되 **나라는 전부 펼쳐 둡니다** — 한눈에 본다는 게 그 뜻입니다.
 *
 * 지도 화면과 같은 자료(my_visited)를 씁니다. 다른 데서 세면 두 화면의
 * 숫자가 언젠가 갈립니다. */
/* flagOk 는 dom.js 로 내렸습니다(b339, 맨 위 import). 짝인 flagOf 도 거기
   있습니다 — 아래에서 같은 계산을 인라인으로 한 번 더 적고 있었습니다. */

/* 어디서 열었는가. 지도 화면에서 열면 닫을 때 **그 지도로** 돌아가야 합니다 —
   프로필로 떨어지면 보던 자리를 잃습니다(b505). */
let 나라온곳 = null;

export async function openCountries(어디서){
  나라온곳 = 어디서 === 'map' ? 'map' : null;
  $('profpane').classList.add('hide');
  /* ⚠ 지도도 **덮는 판**입니다. 안 걷으면 두 판이 겹쳐 섭니다. */
  if (나라온곳 === 'map') $('mappane').classList.add('hide');
  $('ctrypane').classList.remove('hide');
  coverDeck(true);    /* 판이 열린 동안 탭 덱을 숨깁니다(b481) */
  toTop($('ctrypane'));   /* 프로필 안이라 문서가 아니라 setview 를 올립니다(b471) */
  if (history.state?.t2 !== 'ctry') history.pushState({ t2:'ctry' }, '');

  $('ctrylist').innerHTML = '<div class="card"><div class="empty">' +
    '<span class="load">불러오는 중…</span></div></div>';
  await ctx.loadCities();
  const [vis, mine] = await Promise.all([
    sb.rpc('my_visited'),
    sb.from('city_ratings').select('city_id,stars').eq('user_id', ctx.me().id),
  ]);
  const ids  = new Set((vis.data || []).map(v => v.city_id));
  const list = (cities || []).filter(c => ids.has(c.id));
  const stars = Object.fromEntries((mine.data || [])
    .filter(r => r.stars != null).map(r => [r.city_id, Number(r.stars)]));

  const byC = {};
  list.forEach(c => (byC[c.cc] = byC[c.cc] || []).push(c));
  const codes = Object.keys(byC);
  $('ctrysum').textContent = `${codes.length}개국 · ${list.length}도시`;

  if (!codes.length){
    $('ctrylist').innerHTML =
      '<div class="card">' +
      emptyDo('아직 방문한 도시가 없어요.', null, null,
              '도시에 별점을 매기거나 지난 여행을 넣으면 여기 쌓여요.') +
      '</div>';
    return;
  }

  /* 대륙 순서는 지도 화면(CONT)과 같게 둡니다. 두 화면이 다른 순서로
     늘어놓으면 같은 앱처럼 안 읽힙니다. 어디에도 안 걸리는 나라는 맨 뒤. */
  const order = [...CONT.map(([k]) => k), '기타'];
  const groups = {};
  codes.forEach(code => {
    const k = continentOf[code] || '기타';
    (groups[k] = groups[k] || []).push(code);
  });

  /* **나라만 보여줍니다.** 처음엔 나라마다 도시 칩을 다 펴뒀는데, 한국 24곳
     일본 9곳이 붙으니 한 대륙이 화면 두 개가 됐습니다. 사용자 지적:
     "도시 말고 내가 갔던 나라만 보고 싶은 건데."
     나라를 칩으로 촘촘히 깔면 27개국이 한 화면에 들어옵니다.
     도시는 없앤 게 아니라 **한 번 눌러야 나옵니다** — 궁금할 때만 봅니다. */
  const totalOf = Object.fromEntries(CONT);
  const pct = codes.length / UN_COUNTRIES * 100;

  /* **글자만 늘어놓으면 공유할 마음이 안 듭니다.** 국기를 답니다 —
     그림 파일을 스물일곱 장 받아올 필요가 없습니다. 나라 코드 두 글자를
     지역표시기호로 바꾸면 기기가 국기로 그려줍니다(KR → 🇰🇷).
     안 되는 기기에서는 그냥 두 글자가 보입니다 — 깨지지 않습니다. */
  /* **국기를 못 그리는 기기가 있습니다.** 윈도우는 지역표시기호 두 개를
     국기로 합치지 않고 `KR` 처럼 글자 두 개로 그립니다. 그러면 화면이
     "KR JP IT CH LV US…" 코드 나열이 되어 없느니만 못합니다.
     실기기에서 재보고 알았습니다(윈도우 크롬).
     합쳐지는지는 폭으로 압니다 — 합쳐지면 한 글자 폭, 아니면 두 글자 폭. */
  /* 국기 만들기는 dom.js 의 flagOf 하나입니다(b339). 여기 인라인으로
     같은 계산이 적혀 있었습니다 — 두 곳에 두면 언젠가 한쪽만 고칩니다. */
  const flag = code => flagOk() ? flagOf(code) : '';

  const head = `<div class="card ctryhero">
    <div class="big">${codes.length}<i>개국</i></div>
    <div class="sub">${UN_COUNTRIES}개국 중 ${pct.toFixed(1)}% · ${list.length}개 도시</div>
    <div class="track"><i style="width:${Math.min(pct, 100).toFixed(1)}%"></i></div>
    ${flagOk() ? `<div class="flags">${codes
      .sort((a, b) => byC[b].length - byC[a].length)
      .map(c => `<span title="${esc(countryName[c] || c)}">${flag(c)}</span>`).join('')}</div>`
      /* 국기를 못 그리는 기기에서는 대신 나라 수가 많은 순서로 이름을
         몇 개 적습니다. 빈 자리를 남기면 카드가 허전합니다. */
      : `<div class="memo">${esc(codes
          .sort((a, b) => byC[b].length - byC[a].length).slice(0, 6)
          .map(c => countryName[c] || c).join(' · '))}${
          codes.length > 6 ? ` 외 ${codes.length - 6}개국` : ''}</div>`}
    <button class="small" id="ctry_share" style="width:100%; margin-top:14px">
      공유하기</button>
  </div>`;

  $('ctrylist').innerHTML = head + order.filter(k => groups[k]?.length).map(k => {
    const cs = groups[k].sort((a, b) => byC[b].length - byC[a].length
                                     || (countryName[a] || a).localeCompare(countryName[b] || b, 'ko'));
    return `<div class="card">
      <h2><span class="grow">${esc(k)}</span>
        <span class="val">${cs.length}${totalOf[k] ? '/' + totalOf[k] : ''}개국</span></h2>
      <div class="cchips">${cs.map(code =>
        `<button data-ctry="${esc(code)}">${
          flag(code) ? flag(code) + ' ' : ''}${esc(countryName[code] || code)}${
          byC[code].length > 1 ? ` <i>${byC[code].length}</i>` : ''}</button>`).join('')}</div>
      ${cs.map(code => `<div class="hide" data-ctrycity="${esc(code)}"
             style="padding:10px 0 2px; border-top:1px solid var(--line); margin-top:10px">
        <div class="row" style="border:0; padding:0 0 6px; margin:0">
          <span class="label" style="font-weight:600">${
            esc(countryName[code] || code)}</span>
          <span class="val">${byC[code].length}곳</span></div>
        <div class="cchips">${byC[code].map(c =>
          `<button data-pin="${esc(c.id)}">${esc(c.name)}${
            stars[c.id] ? ` ★${stars[c.id]}` : ''}</button>`).join('')}</div>
      </div>`).join('')}
    </div>`;
  }).join('');


  /* 공유 카드. **세계지도를 그대로 씁니다** — 이 페이지에서 제일 자랑스러운
     것은 칠해진 지도이고, 그건 이미 그려져 있습니다(#worldland).
     지도 화면을 한 번도 안 열었으면 비어 있으므로 그때는 국기만 냅니다. */
  /* 지도 화면의 공유와 **같은 카드**입니다(b510) — 위 발자국스펙 하나가
     만듭니다. 전에는 여기와 지도가 각자 만들어서, 같은 숫자를 「다녀온
     나라」와 「내 발자국」 두 이름으로 말했습니다. */
  $('ctry_share').onclick = () => shareCard(발자국스펙(list), 'aitrip-발자국');
}
/* ── 나온 자리로 되돌리기(b453) ───────────────────────────────────────
 * ⚠ 지도·국가목록은 **프로필 위에 얹히는 판**으로 만들어져서, 닫을 때
 *   무조건 `profpane` 을 되살렸습니다. 그런데 이제 **분석 탭**에서도 옵니다 —
 *   거기서 열고 뒤로 가면 **프로필로 떨어졌습니다.**
 * ⚠ 여는 쪽이 어디서 왔는지 적어두고 닫는 쪽이 그리로 돌려보냅니다.
 *   spree.js · home.js 의 reviewBackTo 와 **같은 수법**입니다.
 * ⚠ 한 번 쓰고 바로 비웁니다 — 남기면 프로필에서 연 사람도 튕깁니다. */
/* 뒤로 단추 글자는 dom.js 의 backLabel 하나입니다(b457) — 여기 있었는데
   persona.js 가 import 없이 쓰다가 죽었습니다. 최하위로 내렸습니다. */
let 왔던탭 = null;
export function mapBackTo(tab){
  왔던탭 = tab;
  /* 여는 순간 글자도 맞춥니다 — 화면이 열린 뒤에 바꾸면 한 프레임 동안
     옛 글자가 보입니다. */
  const L = backLabel(tab);
  const a = $('mapback'), b = $('ctryback');
  if (a) a.textContent = L;
  if (b) b.textContent = L;
}
function 돌아가기(){
  const t = 왔던탭; 왔던탭 = null;
  if (t && ctx.showApp){ ctx.showApp(t); return true; }
  return false;
}
export function closeCountries(fromPop){
  if (!fromPop && history.state?.t2 === 'ctry'){ history.back(); return; }
  /* ⚠ **이미 걷힌 뒤면 아무것도 안 합니다(b505).** 나라 목록을 열어둔 채
     탭을 옮기면 showApp 이 판을 다 걷는데, 그 뒤에 뒤로가기가 여기까지
     와서 **지도를 되살려 놓는** 일이 생깁니다. */
  const 열려있었나 = !$('ctrypane').classList.contains('hide');
  $('ctrypane').classList.add('hide');
  if (!열려있었나){ 나라온곳 = null; return; }
  /* ⚠ 지도에서 왔으면 지도로 — 덱은 **계속 덮어둔 채**입니다. 지도도 덮는
     판이라 여기서 coverDeck(false) 를 하면 덱이 그 밑으로 되살아납니다. */
  if (나라온곳 === 'map'){ 나라온곳 = null; $('mappane').classList.remove('hide'); return; }
  coverDeck(false);
  if (돌아가기()) return;
  $('profpane').classList.remove('hide');
}

$('ctryback').addEventListener('click', () => closeCountries());
/* 도시 칩을 누르면 그 도시로. 지도 화면과 같은 규칙입니다. */
$('ctrypane').addEventListener('click', e => {
  /* 나라 칩을 누르면 그 나라의 도시가 펴집니다. 다시 누르면 접힙니다.
     **도시 칩보다 먼저 봅니다** — 펴진 도시 칩도 나라 칩 안에 있지 않으므로
     순서 문제는 없지만, 앞으로 겹칠 때를 대비해 좁은 쪽을 먼저 둡니다. */
  const p = e.target.closest('[data-pin]');
  if (p) return openCity(p.dataset.pin);
  const c = e.target.closest('[data-ctry]');
  if (c){
    const box = $('ctrypane').querySelector(
      `[data-ctrycity="${CSS.escape(c.dataset.ctry)}"]`);
    if (box) box.classList.toggle('hide');
    c.classList.toggle('on', box && !box.classList.contains('hide'));
  }
});

/* ── 발자국 카드는 하나입니다(b510) ──────────────────────────────────
 * 지도 화면의 공유와 나라 목록의 공유가 **거의 같은 카드를 따로** 만들고
 * 있었습니다. 하나는 「내 발자국 28개국」, 하나는 「다녀온 나라 28개국」 —
 * 같은 숫자를 다른 이름으로 두 번 말합니다. 사용자 지적.
 * b649 에 **깃발 벽**까지 이 하나를 씁니다. 셋 다 같은 것을 말합니다.
 *
 * ⚠⚠ **여권 스탬프 면으로 다시 그렸습니다(b649, 사용자 요청).**
 *   전에는 이 카드만 어두운 남보라 그러데이션(`g:'rare'`)이었습니다.
 *   앱이 종이(여권·엽서)로 갈아입은 뒤에도 여기만 옛 톤이라, 성향 카드와
 *   나란히 올리면 **다른 앱에서 나온 것**으로 보였습니다.
 *   → `kind:'stamps'` 로 넘겨 `card.js` 의 `drawStamps` 가 크림 종이에
 *     그립니다. 내용은 그대로고 그림만 바뀝니다.
 *   b776 에 **성향 카드와 같은 틀**로 한 번 더 갈아입었습니다(지도 히어로 ·
 *   대륙 막대 · 깃발 벽, 사용자가 시안 ㄴ 을 고름). 대륙 막대 때문에
 *   `byCont` 가, 많이 간 나라 셋에 깃발을 달려고 `top` 에 나라 코드가 늘었습니다.
 *
 * ⚠ **세는 자료를 받아서 씁니다.** 여기서 다시 받아오면 부르는 쪽이 이미
 *   가진 것을 한 번 더 묻는 셈이고, 두 화면의 숫자가 갈릴 수 있습니다.
 * ⚠ 지도 칠(.been)도 여기서 합니다. 예전에는 지도 화면이 칠해둔 것을
 *   빌려 썼는데, 프로필에서 나라 목록으로 바로 들어오면 지도를 한 번도
 *   안 연 상태라 **전부 회색인 카드**가 나왔습니다.
 * ⚠ **국기는 이제 이모지가 아닙니다.** `flagOk()` 로 기기를 재던 줄을
 *   걷었습니다 — 카드는 `flags.svg` 의 그림을 캔버스에 그리므로 기기가
 *   이모지를 못 그려도 상관없습니다. 나라 코드만 넘깁니다.
 * ⚠ **밖에서도 씁니다**(shelf.js 의 깃발 벽). export 를 떼지 마십시오. */
export function 발자국스펙(도시들){
  const byC = {};
  (도시들 || []).forEach(c => (byC[c.cc] = byC[c.cc] || []).push(c));
  /* 많이 간 나라부터. 깃발 격자도 이 순서라 앞줄이 그 사람다운 줄이 됩니다. */
  const codes = Object.keys(byC).sort((a, b) => byC[b].length - byC[a].length);
  const conts = new Set(codes.map(c => continentOf[c]).filter(Boolean));
  const pct = codes.length / UN_COUNTRIES * 100;

  const 갔다 = new Set(codes);   /* codes 는 이미 모국으로 접힌 것입니다(c.cc) */
  document.querySelectorAll('#worldland path').forEach(p =>
    p.classList.toggle('been', 갔다.has(p.dataset.c)));
  const land = $('worldland')?.innerHTML || '';

  return {
    kind: 'stamps',
    /* 공유 글에 실리는 한 줄입니다(sendCardBlob). */
    title: `${UN_COUNTRIES}개국 중 ${pct.toFixed(1)}%`,
    codes,
    countries: codes.length,
    cities: (도시들 || []).length,
    conts: conts.size,
    total: UN_COUNTRIES,
    pct,
    /* [이름, 도시 수, 나라 코드] — 코드는 카드가 깃발을 꺼내는 데 씁니다(b776). */
    top: codes.slice(0, 3).map(c => [countryName[c] || c, byC[c].length, c]),
    /* 대륙 여섯 [이름, 분모, 다녀온 나라 수] — 카드의 막대(b776).
       ⚠ 분모는 지도 화면 「대륙별」과 **같은 표**(CONT)입니다. 여기서 따로
         적으면 같은 앱이 두 가지 수를 말합니다. */
    byCont: CONT.map(([k, total]) => [k, total, codes.filter(c => continentOf[c] === k).length]),
    land,
    /* ⚠ 여권 코드 줄(`mrz`)을 걷었습니다(b776) — 카드가 성향 카드 틀로
       바뀌며 그리지 않습니다. */
  };
}

export async function openMap(){
  $('profpane').classList.add('hide');
  $('mappane').classList.remove('hide');
  coverDeck(true);
  toTop($('mappane'));
  if (history.state?.t2 !== 'map') history.pushState({ t2:'map' }, '');

  await ctx.loadCities();
  const [vis, mine] = await Promise.all([
    sb.rpc('my_visited'),
    sb.from('city_ratings').select('city_id,stars').eq('user_id', ctx.me().id)
  ]);
  const ids = new Set((vis.data || []).map(v => v.city_id));
  mapCities = (cities || []).filter(c => ids.has(c.id));
  const stars = Object.fromEntries((mine.data || [])
    .filter(r => r.stars != null).map(r => [r.city_id, Number(r.stars)]));

  /* 다녀온 나라를 칠합니다. 싱가포르나 홍콩처럼 이 축척에서 면이 없는 곳은
     칠할 자리가 없어 핀으로만 보입니다. */
  /* ⚠ `c.cc` 는 속령을 모국으로 접은 나라입니다(cities.js) — 괌을 칠하면
     미국이 칠해집니다. `c.country` 로 칠하면 `#worldland` 에 GU 면이 없어
     **아무 데도 안 칠해집니다.** */
  const gone = new Set(mapCities.map(c => c.cc));
  document.querySelectorAll('#worldland path').forEach(p =>
    p.classList.toggle('been', gone.has(p.dataset.c)));
  setMapView('전체');

  /* ── 전체 ── */
  const conts = new Set(mapCities.map(c => continentOf[c.cc]).filter(Boolean));
  const pct = gone.size / UN_COUNTRIES * 100;
  $('m_total').innerHTML =
    /* ⚠ **누를 수 있어야 합니다(b452).** 여기 숫자 셋이 `cursor:default` 에
       핸들러도 없어서 **눌러도 아무 일이 없었습니다.** 프로필에는 같은
       숫자가 보관함으로 이어져 있는데, 지도 화면에서만 죽어 있었습니다.
       프로필과 **같은 이름**(data-shelf · data-openmap)을 답니다 — 여는
       절차는 app.js 가 한 곳에서 맡습니다.
       ⚠ 「대륙」은 누를 곳이 없습니다(대륙별 목록이 이 화면 아래에 이미
         있습니다). 그것만 `cursor:default` 로 남깁니다. */
    `<div class="stats" style="margin:0">
       <!-- ⚠ **「국가」는 보관함이 아니라 나라 목록입니다(b505).** 여기만
            data-shelf 였습니다 — 눌러보면 **평가한 도시**가 나와서, 프로필의
            똑같이 생긴 「국가」 타일(나라 목록)과 다른 곳으로 갔습니다.
            같은 것을 누른 줄 알았는데 다른 화면이 나왔습니다.
            「도시」는 보관함이 맞습니다 — 도시 목록이니까요.
            ⚠⚠ **이 주석은 템플릿 리터럴 안입니다 — 역따옴표를 쓰면 문자열이
              거기서 끊겨 앱이 통째로 안 뜹니다.** b505 에 실제로 그랬습니다
              (map.js 를 가져오는 모듈 아홉이 같이 죽었습니다). -->
       <button data-openmap="1"><b>${gone.size}</b><span>국가</span></button>
       <button data-shelf="mine"><b>${mapCities.length}</b><span>도시</span></button>
       <button style="cursor:default"><b>${conts.size}/6</b><span>대륙</span></button>
     </div>
     <div class="memo" style="text-align:center; margin-top:10px">
       ${UN_COUNTRIES}개국 중 <b>${gone.size}개국</b> · ${pct.toFixed(1)}%</div>
     <div class="fp"><i style="width:${Math.max(pct, 1.2).toFixed(1)}%"></i></div>`;

  /* ── 발자국을 카드로 ──────────────────────────────────────────────
     **여기가 이 앱에서 제일 내보이고 싶은 그림입니다.** 성향 카드보다
     "몇 개국 다녀왔다"가 훨씬 자랑거리라, 공유가 유입으로 이어질 자리는
     여기입니다. 그런데 여태 공유가 아예 없었습니다.
     지도는 **화면에 그려져 있는 것을 그대로 빌려 씁니다** — 어느 나라를
     칠할지 다시 정하면 화면과 어긋납니다. 위에서 이미 .been 을 붙여뒀습니다.
     칠은 카드 배경(남색→보라) 위에 얹히므로 흰색 두 단계로만 씁니다. */
  $('fp_img').onclick = () => shareCard(발자국스펙(mapCities), 'aitrip-발자국');


  /* ── 대륙별 ── 퍼센트는 국가로만 셉니다 ── */
  /* **막대만 있고 어느 나라인지가 없었습니다.** "유럽 19/44국"을 보고 나면
     바로 드는 생각이 "어느 19개국이지?"인데 답할 자리가 없었습니다.
     아래 국가별 목록은 **도시**가 주인공이라 나라를 세려면 눈으로 세야 했습니다.
     줄을 누르면 그 대륙의 국가 이름이 펴집니다 — 한 겹 안에 두는 이유는
     여섯 대륙을 다 펴두면 그 카드가 화면 몇 개가 되기 때문입니다. */
  $('m_cont').innerHTML = CONT.map(([k, total]) => {
    const cs = mapCities.filter(c => continentOf[c.cc] === k);
    const ns = [...new Set(cs.map(c => c.cc))]
      .sort((a, b) => (countryName[a] || a).localeCompare(countryName[b] || b, 'ko'));
    const p = ns.length / total * 100;
    return `<div class="crow" data-cont="${esc(k)}" data-zoom="${esc(k)}">
      <span class="nm">${esc(k)}</span>
      <span class="bar"><i style="width:${p.toFixed(1)}%"></i></span>
      <span class="n">${ns.length}/${total}국 · ${cs.length}곳</span></div>` +
      `<div class="cchips hide" data-contlist="${esc(k)}"
            style="padding:0 0 10px">${
        ns.length ? ns.map(code => `<button data-czoom="${esc(code)}">${
            esc(countryName[code] || code)} ${
            cs.filter(c => c.cc === code).length}</button>`).join('')
          : '<span class="memo">아직 없어요</span>'}</div>`;
  }).join('');

  /* ── 국가별 ── 많이 간 나라부터 ── */
  /* 카드 통째로 접힙니다(b815 — 아래 「국가별 접기」). 나라 줄은 그냥 이름 줄입니다. */
  const byC = {};
  mapCities.forEach(c => (byC[c.cc] = byC[c.cc] || []).push(c));
  const order = Object.entries(byC).sort((a, b) => b[1].length - a[1].length);
  $('m_country').innerHTML = order.length
    ? order.map(([code, cs]) => `<div class="ctryblk" data-ctry="${esc(code)}">
        <div class="row ctryh"><span class="label">${esc(countryName[code] || code)}</span>
          <span class="val">${cs.length}곳</span></div>
        <div class="cchips">${cs.map(c =>
          `<button data-pin="${esc(c.id)}">${esc(c.name)}${
            stars[c.id] ? ` ★${stars[c.id]}` : ''}</button>`).join('')}</div>
      </div>`).join('')
    : emptyDo('아직 방문한 도시가 없어요.', null, null,
              '도시에 별점을 매기면 그 나라가 칠해져요.');
  국가별접기(카드접혔나(), false);

  /* ── 분석 ── 대륙별 카드 바로 밑입니다(b550, 사용자 결정) ────────────
   * 별점 분포 · 가장 많이 간 나라 · 최북단 · 가장 먼 두 도시.
   *
   * ⚠⚠ **이 자리는 다섯 번째입니다. 옮기기 전에 내력을 읽으십시오.** ⚠⚠
   *     분석 탭        b457 이전. 「분석 첫 화면이 너무 길다」로 나감
   *     지도 화면      b457~b541. 「대륙별·국가별을 다 지나야 나와서
   *                    아무도 못 본다」로 나감 → b515 에 국가별 «위»로
   *                    올려서 그 문제는 이미 고쳐졌습니다
   *     성향 탭        b542~b545. 「성향이 아니라 발자국 이야기」로 나감
   *     기록 탭        b546~b549. 「이름이 이상하다」로 나감 — 그 탭이
   *                    「기록」이라 「진기록」이라 부를 수밖에 없었습니다
   *     지도 화면      b550. **이름을 「분석」으로 되돌리고** 여기로.
   *   네 번 다 이유가 같았습니다: **그 화면의 주제와 다르다.** 이 화면은
   *   「내가 어디를 얼마나 다녔나」를 파고드는 자리라 여기가 맞습니다.
   *
   * ⚠ **국가별 목록보다 «위»입니다(b515).** 아래 목록은 나라가 스물여덟이면
   *   화면 여러 장이라, 그 밑에 두면 여기까지 내려오는 사람이 없습니다.
   * ⚠ **세는 자료는 위와 같은 것입니다**(mapCities · stars). 여기서 다시
   *   받아오면 같은 화면 안에서 두 숫자가 갈립니다.
   * ⚠ 칸은 **내림**입니다. 별점이 0.5 단위라 4.5 는 ★4 칸입니다. 반올림하면
   *   아래 「별 다섯을 준 곳」(정확히 5.0)과 어긋나고, 한 화면에 두 숫자가
   *   다르면 둘 다 못 믿게 됩니다.
   * ⚠ 띠 안에는 글자를 안 넣습니다 — 좁은 칸은 어차피 안 들어가서 같은 것이
   *   두 자리에 나뉩니다. 띠는 비율만, 숫자는 아래 범례가 맡습니다. */
  const 내도시 = mapCities.filter(c => stars[c.id] != null);
  const 기록칸 = $('m_rec');
  if (기록칸){
    const 통 = [0, 0, 0, 0, 0];
    내도시.forEach(c => {
      const n = Math.floor(Number(stars[c.id]));
      if (n >= 1 && n <= 5) 통[n - 1]++;
    });
    const 합 = 통.reduce((a, b) => a + b, 0) || 1;
    /* ★5 초록에서 ★1 붉은색으로. */
    const 색 = ['#C4626B', '#D08A5A', '#C9A227', '#7FA05A', '#4C8C4A'];
    기록칸.classList.toggle('hide', !내도시.length);
    기록칸.innerHTML = !내도시.length ? '' : `<h2>분석</h2>
      <div class="stackwrap">
        <div class="stack">${[5, 4, 3, 2, 1].map(n => 통[n - 1]
          ? `<i style="width:${(통[n - 1] / 합 * 100).toFixed(1)}%;
               background:${색[n - 1]}" title="★${n} ${통[n - 1]}곳"></i>` : '').join('')}</div>
        <div class="stackleg">${[5, 4, 3, 2, 1].map(n =>
          `<span${통[n - 1] ? '' : ' class="off"'}><b style="background:${
            색[n - 1]}"></b>★${n} ${통[n - 1]}곳</span>`).join('')}</div>
      </div>
      ${funRows(내도시, stars).map(([k, v]) =>
        `<div class="row"><span class="label">${esc(k)}</span>
           <span class="val">${esc(v)}</span></div>`).join('')}`;
  }

}

/* ── 기록 ── 숫자를 곱씹게 만드는 자리 ────────────────────────────────
 * ⚠ **분석 탭이 씁니다(b457).** 지도 화면 맨 아래에 있었습니다 — 지도를
 *   열고 대륙별·국가별을 다 지나야 나와서 사실상 아무도 못 봤습니다.
 *   「가장 먼 두 도시」 같은 것은 지도의 부록이 아니라 **분석**입니다.
 * ⚠ **계산만 합니다.** 그리는 것은 부르는 쪽 몫입니다 — 여기서 DOM 까지
 *   건드리면 지도와 분석이 같은 자리를 두고 다툽니다.
 * ⚠ 도시 목록과 별점을 **받아서** 씁니다. 여기서 다시 받아오면 부르는
 *   쪽이 이미 가진 것을 한 번 더 묻는 셈입니다. */
export function funRows(도시들, 별점표){
  const withPos = 도시들.filter(c => c.center_lat != null);
  const north = withPos.reduce((a, c) => !a || c.center_lat > a.center_lat ? c : a, null);
  const south = withPos.reduce((a, c) => !a || c.center_lat < a.center_lat ? c : a, null);
  /* 다녀온 도시 가운데 가장 멀리 떨어진 두 곳. 313곳이라 다 재도 금방입니다. */
  let far = null;
  for (let i = 0; i < withPos.length; i++)
    for (let j = i + 1; j < withPos.length; j++){
      const d = distKm(withPos[i].center_lat, withPos[i].center_lng,
                       withPos[j].center_lat, withPos[j].center_lng);
      if (!far || d > far.d) far = { d, a: withPos[i], b: withPos[j] };
    }
  const byC = {};
  도시들.forEach(c => (byC[c.cc] = byC[c.cc] || []).push(c));
  const order = Object.entries(byC).sort((a, b) => b[1].length - a[1].length);
  const sv = 도시들.map(c => 별점표[c.id]).filter(v => v != null);
  const avg = sv.length ? sv.reduce((a, b) => a + b, 0) / sv.length : null;
  /* ── 후한 나라 · 박한 나라(b483) ────────────────────────────────────
     ⚠ **세 곳 이상 매긴 나라만 셉니다.** 한 곳만 매긴 나라가 ★5 면
       「가장 후한 나라」로 올라오는데, 그건 그 나라 이야기가 아니라
       그 도시 하나 이야기입니다. 표본이 적으면 아무 말도 안 하는 편이
       낫습니다.
     ⚠ 그런 나라가 **둘 미만이면 두 줄 다 뺍니다.** 후한 곳과 박한 곳이
       같은 나라면 비교가 아니라 그냥 한 나라 별점입니다. */
  const 나라평균 = order
    .map(([코드, cs]) => {
      const vs = cs.map(c => 별점표[c.id]).filter(v => v != null);
      return { 코드, 수: vs.length,
               평균: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null };
    })
    .filter(x => x.수 >= 3 && x.평균 != null)
    .sort((a, b) => b.평균 - a.평균);
  const 이름 = x => `${countryName[x.코드] || x.코드} ★${x.평균.toFixed(1)}`;
  const 후박 = 나라평균.length >= 2
    ? [['후한 나라', 이름(나라평균[0])],
       ['박한 나라', 이름(나라평균[나라평균.length - 1])]]
    : [];

  return [
    ['가장 많이 간 국가', order.length
      ? `${countryName[order[0][0]] || order[0][0]} · ${order[0][1].length}곳` : '–'],
    ['가장 북쪽', north ? north.name : '–'],
    ['가장 남쪽', south ? south.name : '–'],
    ['가장 먼 두 도시', far
      ? `${far.a.name} ~ ${far.b.name} · ${Math.round(far.d).toLocaleString()}km` : '–'],
    ['내 별점 평균', avg != null ? `★ ${avg.toFixed(2)}` : '–'],
    ['별 다섯을 준 곳', String(sv.filter(v => v === 5).length) + '곳'],
    ...후박,
  ];
}

/* ── 국가별 접기(b813 → b815) ─────────────────────────────────────────
 * b813 사용자: 「국가별 다녀온 도시도 세로로 너무 길어서 이것도 접을 수 있게 해줘」 → 나라마다 접기 + 「모두 접기」.
 * ⚠⚠ **b815 에 카드 통째로 바꿨습니다** — 사용자: 「국가별 방문한 도시도 그냥 통으로 할 수 있게 해줘 국가별로
 *   하지말고」. 분석 탭 도시 어워즈(mycity.js 접는카드)와 같은 모양입니다 — 제목 줄 오른쪽 꺾쇠, 기본은 펼침.
 * 접은 것은 기기에 기억합니다(`t2:ctryfold` = '1'). b813 의 옛 값(나라 코드 목록)은 '1' 이 아니라 펼침으로 읽힙니다.
 * 로그아웃하면 forgetLocal 이 t2: 를 다 지웁니다.
 * ⚠ 위 「대륙별」에서 나라 칩을 누르면 카드를 **펴고** 그 나라로 데려갑니다(접힌 채로 데려가면 빈손입니다). */
const 접힘열쇠 = 't2:ctryfold';
const 카드접혔나 = () => { try { return localStorage.getItem(접힘열쇠) === '1'; } catch { return false; } };
/* 적기 = false 면 화면만 맞춥니다(그릴 때). */
function 국가별접기(접기, 적기 = true){
  $('m_countrycard')?.classList.toggle('fold', 접기);
  $('m_ctryfold')?.setAttribute('aria-expanded', String(!접기));
  if (!적기) return;
  try { 접기 ? localStorage.setItem(접힘열쇠, '1') : localStorage.removeItem(접힘열쇠); } catch {}
}

export function closeMap(fromPop){
  if (!fromPop && history.state?.t2 === 'map'){ history.back(); return; }
  shutBigMap();
  $('mappane').classList.add('hide');
  coverDeck(false);
  if (돌아가기()) return;
  $('profpane').classList.remove('hide');
}
/* ⚠ **`?.` 입니다(b554).** 이 단추는 화면에서 안 보이는 「프로그램이 누르는
   자리」라, 언젠가 정리하다 지워질 수 있습니다. 그때 여기서 터지면 지도
   화면이 통째로 안 열립니다 — 모듈이 로드되다 죽기 때문입니다. */
$('openmap')?.addEventListener('click', openMap);

/* 앱 자체를 권하는 자리. 여행 초대(그 여행에 들어오는 것)와는 다릅니다.
   휴대폰은 기본 공유창을 띄우고, 안 되는 브라우저는 주소만 복사합니다. */
/* 잠깐 뜨는 알림. 아이콘 버튼이라 글자를 바꿔 알릴 자리가 없습니다. */
/* toast 는 dom.js 로 옮겼습니다 (맨 위 import) — net.js 도 씁니다. */

$('shareapp').addEventListener('click', async () => {
  const url  = location.origin + location.pathname;
  /* ⚠ **앞뒤가 뒤집혀 있었습니다(b397).** 'AI가 여행 일정을 짜주고…' 였습니다.
     그런데 이 단추가 있는 자리가 **발자국 지도**입니다 — 평가로 만들어진
     것을 보다가 앱을 권하는데 일정 이야기가 먼저 나갔습니다.
     밖으로 퍼지는 것(성향 카드·발자국·영수증)은 전부 평가에서 나옵니다.
     index.html 의 og 와 **같은 말을 해야 합니다** — 한쪽만 고치면 같은 앱이
     두 가지로 소개됩니다. */
  const text = '방문한 해외 도시를 매기면 16가지 중 내 여행 성향이 나와요. 일정도 여기서 짜요.';
  const msg  = `${text}\n${url}`;

  /* 휴대폰은 기본 공유창을 씁니다. */
  if (navigator.share){
    try { await navigator.share({ title:'기로', text, url }); return; }
    catch (e){ if (e?.name === 'AbortError') return; }   /* 닫은 것은 실패가 아닙니다 */
  }
  /* 클립보드는 창이 포커스를 잃었거나 권한이 없으면 그냥 거절합니다.
     "복사하지 못했습니다"가 그래서 떴습니다. 옛 방식으로 한 번 더 해봅니다. */
  let ok = false;
  try { await navigator.clipboard.writeText(msg); ok = true; } catch {}
  if (!ok){
    try {
      const t = document.createElement('textarea');
      t.value = msg;
      t.style.cssText = 'position:fixed; top:-9999px; opacity:0';
      document.body.appendChild(t); t.select();
      ok = document.execCommand('copy');
      t.remove();
    } catch {}
  }
  /* 그래도 안 되면 주소를 눈앞에 띄워 직접 복사하게 합니다.
     실패했다고만 하고 끝나면 할 수 있는 것이 없습니다. */
  toast(ok ? '주소를 복사했어요' : url);
});
$('mapback').addEventListener('click', () => closeMap());

$('mappane').addEventListener('click', e => {
  /* 대륙 줄을 누르면 그 대륙의 국가 이름이 펴집니다. 지도도 그리로 당깁니다 —
     둘 다 "이 대륙을 보고 싶다"는 같은 뜻이라 한 번에 합니다.
     **국가 칩(data-czoom)이 먼저입니다** — 칩은 대륙 줄 밖에 있지만
     아래 data-zoom 이 그 위를 먼저 잡으면 칩이 안 눌립니다. */
  /* 국가별 접기(b815) — 카드 제목 줄. */
  if (e.target.closest('#m_ctryfold')){
    /* ⚠ `!$(…)?.` 로 쓰지 않습니다 — 카드가 없으면 undefined 가 뒤집혀 «접기»가 됩니다(tools/optneg.pl). */
    const 카드 = $('m_countrycard');
    if (카드) 국가별접기(!카드.classList.contains('fold'));
    return;
  }
  const cz = e.target.closest('[data-czoom]');
  if (cz){
    /* 그 나라의 도시들을 아래 '국가별' 목록에서 찾아 보여줍니다.
       지도를 나라 단위로 당기는 것은 setMapView 가 대륙까지만 알아서
       지금은 못 합니다 — 대륙으로만 당기고 목록으로 데려갑니다.
       카드가 접혀 있으면 펴고, 그 나라 줄로 데려갑니다(가운데 — 위 끝은 iOS 흐림 밑입니다). */
    setMapView(continentOf[cz.dataset.czoom] || '전체');
    if ($('m_countrycard')?.classList.contains('fold')) 국가별접기(false);
    const 블록 = $('m_country')?.querySelector(`.ctryblk[data-ctry="${CSS.escape(cz.dataset.czoom)}"]`);
    if (블록) 블록.scrollIntoView({ behavior:'smooth', block:'center' });
    else $('m_country')?.scrollIntoView({ behavior:'smooth', block:'start' });
    return;
  }
  const row = e.target.closest('[data-cont]');
  if (row){
    const list = $('mappane').querySelector(
      `[data-contlist="${CSS.escape(row.dataset.cont)}"]`);
    if (list) list.classList.toggle('hide');
  }
  const z = e.target.closest('[data-zoom]');
  if (z) return setMapView(z.dataset.zoom);
  const p = e.target.closest('[data-pin]');
  if (p) return openCity(p.dataset.pin);
});

/* 톱니를 누르면 설정, 뒤로 누르면 프로필. 설정을 프로필에 다 늘어놓으면
   정작 보러 온 숫자가 아래로 밀립니다. */
