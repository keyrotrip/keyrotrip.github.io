/* ── 내 도시 이야기(b810, 2026-10-01) ─────────────────────────────────
 * 분석 탭 카드 셋 — 도시 어워즈 · 거리별 별점 · 여행지 월드컵(옛 이름 「진짜 최애」).
 * ⚠ b812: 「성향 | 별점 | 어워즈」 세 칸 — 거리별 별점은 「별점」 칸, 어워즈 · 월드컵은 「어워즈」 칸(drawMyCities 의 `칸`).
 *   어워즈는 그 칸에서 **세로로 한 장씩 다 펼칩니다**(사용자: 「다 펼쳐놓자 세로로」 — b811 의 가로 넘기기를 걷음).
 * 사용자: 「1번부터 시안가자」 → 로컬 앱 분석 탭에 끼운 시안 넷(사용자 기록 77곳) → 고름:
 *   셋 다 · 순위는 B(최애 월드컵) · 국내도 넣기.
 * 명세(KIRO_PERSONA_AND_ANALYTICS_ENHANCEMENT_SPEC 17장)에서 다른 화면과 겹치는 것은 모양을 바꿨습니다:
 *   「여행 반경」 → 거리별 별점(가장 먼 곳·남북 끝은 기록 탭 진기록, 대륙은 발자국에 이미 있음)
 *   「개인 도시 랭킹」 → 동점만 둘씩 골라 가르는 최애 고르기(별점 순 목록은 보관함에 이미 있음)
 * ⚠ **순서를 지어내지 않습니다**(명세 17.2). 동점이면 사진을 나눠 다 보여 주고, 순위는 사용자가 직접 가른
 *   것만 씁니다. ★4.5 가 ★5 를 이기는 식으로 별점과 어긋나는 순위도 안 만듭니다 — 같은 별점끼리만 겨룹니다.
 * ⚠ **국내도 셉니다**(사용자). 성향(card.js)은 국내를 빼지만, 여기는 «내가 매긴 도시» 이야기입니다.
 * 층: dom · db · cities · calc · city(도시 화면). anal.js 가 부릅니다(drawMyCities). persona.js 는 모릅니다. */
import { $, esc, toast, josa, flagOf, flagOk } from './dom.js?v=b827';
import { sb } from './db.js?v=b827';
import { cities, countryName, countryInfo } from './cities.js?v=b827';
import { distKm, SEOUL } from './calc.js?v=b827';
import { openCity } from './city.js?v=b827';

const 국내 = 'KR';
const 셋말 = n => ['', '한', '두', '세', '네', '다섯'][n] || String(n);
const 별글 = s => (Number.isInteger(s) ? String(s) : s.toFixed(1));
const 이름순 = (a, b) => a.name.localeCompare(b.name, 'ko');
/* visits 는 1~5 이고 5 는 「5번 이상」입니다(visits.js · db/109). */
const 번말 = n => n >= 5 ? '다섯 번 이상' : `${셋말(n)} 번`;
/* 도시 종류(cities.kinds, db/113) 열 가지의 화면 이름(b824). ⚠ tags(068, 추천 계산용)와 다른 칸입니다 — 아래 줄들 주석.
   「도시」는 「도시 최애」처럼 쓰면 모든 곳이 도시라 헷갈려 「도심」, 「설상」은 낯선 말이라 「눈·스키」. 나머지는 그대로. */
const 종류이름 = { 유적: '유적', 도시: '도심', 자연: '자연', 미식: '미식', 해변: '해변',
                  축제: '축제', 미술: '미술', 쇼핑: '쇼핑', 설상: '눈·스키', 온천: '온천' };

/* 매긴 도시 하나 = { id, name, stars, fame, kr, km, img, kinds, 나라, visits, 일기, 사진 }. 도시 목록에 없는 곳은 뺍니다.
   b824: 종류(kinds — 화면용 종류, db/113. ⚠ tags 가 아닙니다: tags 는 추천 계산용으로 그대로 두었습니다 —
   바꿔서 재 보니 추천이 나빠졌습니다, 113 머리말) · 나라(모국 코드 — 괌은 미국, 홍콩은 중국: rating.js 의 모국 · cities.js cityCountry 와 같은 규칙) ·
   다시 간 횟수(visits) · 일기 글자 수 · 일기 사진을 더했습니다 — 종류별·나라별 별점과 새 상 셋의 재료입니다.
   anal.js 가 그 칸들(visits · journal · journal_photo)을 같이 받아 옵니다. */
function 줄들(rows){
  const 표 = new Map((cities || []).map(c => [c.id, c]));
  return (rows || []).filter(r => r.stars != null).map(r => {
    const c = 표.get(r.city_id);
    if (!c) return null;
    const km = (c.center_lat != null && c.center_lng != null)
      ? distKm(SEOUL[0], SEOUL[1], c.center_lat, c.center_lng) : null;
    return { id: c.id, name: c.name || c.id, stars: Number(r.stars), fame: c.fame == null ? null : Number(c.fame),
             kr: c.country === 국내, km, img: c.image_url || '',
             kinds: c.kinds || [], 나라: c.cc || countryInfo[c.country]?.parent_code || c.country || '',
             visits: Number(r.visits) || 0, 일기: (r.journal || '').trim().length, 사진: !!r.journal_photo };
  }).filter(Boolean);
}

/* 사진 칸 — 동점이면 나눠서 셋까지. 누르면 그 도시 화면. 사진이 없으면 이름 첫 글자(city.js 와 같은 수법). */
const 사진칸 = (xs, 딱지) => `<div class="awph">${xs.map(x =>
  `<i data-city="${esc(x.id)}" role="button" tabindex="0" aria-label="${esc(x.name)} 보기"${x.img
    ? ` style="background-image:url('${esc(x.img)}')"` : ''}>${x.img ? '' : esc(x.name.slice(0, 1))}</i>`).join('')}${
  딱지 ? `<b>${esc(딱지)}</b>` : ''}</div>`;

/* 사진 줄 — **도시마다 한 장씩, 옆으로 넘겨 봅니다**(b813, 사용자: 「한곳에 다 넣지말고 옆으로 스크롤 하면서 보게해줘」).
   b810~b812 는 동점 도시를 한 칸에 둘·셋으로 나눠 넣었는데 사진이 좁게 잘렸습니다. 한 곳이면 꽉 차게, 둘 넘으면
   86% 폭으로 다음 장이 살짝 보이게 — 넘길 수 있다는 것을 그림이 말합니다. 딱지(상 이름 · 순위)는 장마다 왼쪽 위,
   도시 이름은 장마다 사진 밑. 누르면 그 도시 화면(아래 카드의 click).
   ⚠ 규칙은 「다음 여행」 사진 줄(.crow)과 같습니다 — 음수 여백 없음(b597·b736), 스냅 proximity. */
const 사진줄 = (xs, 딱지) => `<div class="awrow${xs.length > 1 ? ' many' : ''}">${xs.map((x, i) => {
  const 글 = typeof 딱지 === 'function' ? 딱지(x, i) : 딱지;
  return `<div class="awslide" data-city="${esc(x.id)}" role="button" tabindex="0" aria-label="${esc(x.name)} 보기">
    <i${x.img ? ` style="background-image:url('${esc(x.img)}')"` : ''}>${x.img ? '' : esc(x.name.slice(0, 1))}</i>
    ${글 ? `<b>${esc(글)}</b>` : ''}<span>${esc(x.name)}</span></div>`;
}).join('')}</div>`;

/* ── 접기 ── 카드 통째로(b815). 도시 어워즈와 여행지 월드컵이 같은 규칙입니다(접는카드) — 처음엔 펼쳐 있고,
   제목 줄을 누르면 접힙니다. 접은 것은 기기에 기억합니다(`t2:awfold:<카드 이름>`). 로그아웃하면 forgetLocal 이 지웁니다.
   ⚠⚠ **b813 에는 상마다 따로 접혔습니다** — 사용자: 「도시어워즈 전체를 폈다 접을 수 있게 해줘 하나씩 다 할필요가
     없어」(b815)로 걷었습니다. 상 이름은 이제 그냥 제목(h3)입니다. 되살리지 마십시오.
   ⚠ 「두 걸음 깊은 것은 아무도 안 본다」(b457·b503) 때문에 **기본은 펼침**입니다 — 접는 것은 사용자가 고른 것만. */
const 접힘열쇠 = 이름 => 't2:awfold:' + 이름;
const 접혔나 = 이름 => { try { return localStorage.getItem(접힘열쇠(이름)) === '1'; } catch { return false; } };
function 접기바꾸기(칸, 이름){
  const 접힘 = !칸.classList.contains('fold');
  칸.classList.toggle('fold', 접힘);
  칸.querySelector('.awh')?.setAttribute('aria-expanded', String(!접힘));
  try { 접힘 ? localStorage.setItem(접힘열쇠(이름), '1') : localStorage.removeItem(접힘열쇠(이름)); } catch {}
}

function 카드(제목){
  const el = document.createElement('div');
  el.className = 'card quiet mycard';
  el.innerHTML = `<h2>${esc(제목)}</h2>`;
  el.addEventListener('click', e => {
    const 머리 = e.target.closest('.awh');
    if (머리){ const 칸 = 머리.closest('[data-fold]'); if (칸) 접기바꾸기(칸, 칸.dataset.fold); return; }
    const t = e.target.closest('[data-city]');
    if (t && !t.closest('.fvvs')) openCity(t.dataset.city);
  });
  /* 손가락 말고 키보드로도 — role="button" 칸은 Enter·Space 를 누름으로 받습니다. */
  el.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"]')){ e.preventDefault(); e.target.click(); }
  });
  return el;
}

/* 접는 카드 — 제목(h2) 안에 단추(.awh)를 넣고(h2 를 단추 안에 넣으면 문법이 틀립니다), 그 밑을 몸(.awbody)으로.
   접히면 제목 줄만 남습니다. { el, 몸 } 을 돌려줍니다 — 그리는 쪽은 몸에만 넣습니다. */
function 접는카드(제목){
  const el = 카드(제목), 접힘 = 접혔나(제목);
  el.dataset.fold = 제목;
  el.classList.add('foldcard');
  el.classList.toggle('fold', 접힘);
  el.querySelector('h2').innerHTML = `<button type="button" class="awh" aria-expanded="${!접힘}">
    <span class="awht">${esc(제목)}</span><i class="awchev" aria-hidden="true"></i></button>`;
  const 몸 = document.createElement('div');
  몸.className = 'awbody';
  el.appendChild(몸);
  return { el, 몸 };
}

/* ══ ① 도시 어워즈 ══════════════════════════════════════════════════════
 * 상 여섯. 위에서부터 주고, **한 도시는 상 하나만** 받습니다(최애가 「멀리 가서 좋았던 곳」도 되면 같은 사진이
 * 두 번 나옵니다). 받을 도시가 없는 상은 숨기고, 둘도 안 되면 카드를 안 냅니다.
 * 문턱: 좋았던 상은 ★4 이상, 아쉬운 상은 최애 ★2.5 · 유명한 곳 ★3 이하 — 그보다 느슨하면 「최애 ★3」 같은
 *   말이 됩니다. */
function 어워즈(목록){
  if (목록.length < 5) return null;
  const 쓴 = new Set(), 상 = [];
  const 가장 = (후보, 높은, 문턱) => {
    const 남은 = 후보.filter(x => !쓴.has(x.id));
    if (!남은.length) return [];
    const 값 = 높은 ? Math.max(...남은.map(x => x.stars)) : Math.min(...남은.map(x => x.stars));
    if (높은 ? 값 < 문턱 : 값 > 문턱) return [];
    return 남은.filter(x => x.stars === 값).sort(이름순);
  };
  const 받기 = (이름, xs, 말) => { if (!xs.length) return; xs.forEach(x => 쓴.add(x.id)); 상.push({ 이름, xs, 말 }); };

  const 최고 = 가장(목록, true, 4);
  받기('최애 도시', 최고, 최고.length > 1 && 최고[0].stars === 5
    ? `별 다섯 준 ${셋말(최고.length)} 곳` : '매긴 곳 중 가장 높아요');
  받기('가장 아쉬웠던 곳', 가장(목록, false, 2.5), '매긴 곳 중 가장 낮아요');
  받기('숨은 보석', 가장(목록.filter(x => x.fame === 3), true, 4), '덜 알려졌는데 가장 좋았어요');
  받기('이름값 못한 곳', 가장(목록.filter(x => x.fame === 1), false, 3), '유명한데 아쉬웠어요');
  /* 멀리 — 가장 좋았던 별점 가운데 **가장 먼 한 곳**(동점을 다 보여 주면 유럽 도시 다섯이 한 칸에 섭니다). */
  const 멀리 = 가장(목록.filter(x => !x.kr && x.km != null && x.km >= 4500), true, 4)
    .sort((a, b) => b.km - a.km).slice(0, 1);
  받기('멀리 가서 좋았던 곳', 멀리, 멀리[0] ? `서울에서 ${Math.round(멀리[0].km).toLocaleString()}km` : '');
  받기('가까운 최애', 가장(목록.filter(x => !x.kr && x.km != null && x.km < 1500), true, 4),
    '1,500km 안 해외에서 가장 좋았어요');

  /* ── 별점 말고 다른 자료로 주는 상 셋(b824, 사용자: 「어워즈 칸 1번 가보자」) ──────────────────────
   * 다시 간 횟수(visits) · 일기 · 좋아하는 종류. 별점만 보던 상 여섯과 다른 이야기라 위에 안 섞고 뒤에 둡니다.
   * ⚠⚠ **「가장」이 참이어야 합니다.** 위 상들처럼 «남은 도시 중 가장»으로 고르면, 진짜 1등이 이미 다른 상을 받았을 때
   *   2등에게 「가장 여러 번 갔어요」를 주게 됩니다. 그래서 **전체에서 1등을 찾고** 그중 아직 상을 안 받은 곳만 줍니다 —
   *   1등이 다 이미 받았으면 이 상은 건너뜁니다. 한 도시 상 하나 규칙은 그대로입니다.
   * ⚠ 문턱: 단골은 두 번 이상, 일기는 80자 이상(한 줄 메모는 「많이 쓴」이 아님), 종류 최애는 ★4 이상. */
  const 진짜1등 = (후보, 값) => {
    if (!후보.length) return [];
    const 최고 = Math.max(...후보.map(값));
    return 후보.filter(x => 값(x) === 최고 && !쓴.has(x.id)).sort(이름순);
  };
  const 단골 = 진짜1등(목록.filter(x => (x.visits || 0) >= 2), x => x.visits);
  받기('단골 도시', 단골, 단골[0] ? `${번말(단골[0].visits)} 간 곳 · 가장 여러 번 갔어요` : '');
  const 일기 = 진짜1등(목록.filter(x => (x.일기 || 0) >= 80), x => x.일기);
  받기('일기를 가장 많이 쓴 곳', 일기,
    일기[0] ? `일기 ${일기[0].일기.toLocaleString()}자${일기[0].사진 ? ' · 사진도 남겼어요' : ''}` : '');
  /* 좋아하는 종류는 아래 「여행지 종류별 별점」과 같은 셈(종류표 · 좋아한종류)입니다 — 두 벌로 세면 갈립니다. */
  const 종류 = 좋아한종류(종류표(목록));
  if (종류){
    const 이름 = 종류이름[종류.이름] || 종류.이름;
    const 최고 = Math.max(...종류.xs.map(x => x.stars));
    받기(`${이름} 최애`, 최고 >= 4 ? 진짜1등(종류.xs, x => x.stars) : [],
      `${josa(이름, '을', '를')} 가장 좋아해요 · 그중 별이 가장 높아요`);
  }
  if (상.length < 2) return null;

  /* 카드 통째로 접힙니다(b815 — 위 「접기」). 상 이름은 그냥 제목이고, 사진에는 딱지를 안 붙입니다(b813). */
  const { el, 몸 } = 접는카드('도시 어워즈');
  몸.insertAdjacentHTML('beforeend', `<div class="awgrid">${상.map(a => {
    /* 동점이 많아도 여덟 장까지 — 그 뒤는 「외 N곳」. */
    const 보일 = a.xs.slice(0, 8), 더 = a.xs.length - 보일.length;
    return `<div class="awt"><h3 class="awname">${esc(a.이름)}</h3>
      ${사진줄(보일)}
      <div class="aws"><em>★${별글(a.xs[0].stars)}</em>${a.말 ? ` · ${esc(a.말)}` : ''}${더 ? ` · 외 ${더}곳` : ''}</div></div>`;
  }).join('')}</div>`);
  return el;
}

/* ══ ② 거리별 별점 ══════════════════════════════════════════════════════
 * 거리대마다 평균 별점. 「멀리 갈수록 좋았나」는 다른 화면에 없는 이야기입니다(명세 19.3 「취향의 반전」의 재료).
 * ⚠ 세 곳 미만인 띠는 그리되 **견주지는 않습니다**(높다·낮다에서 뺌) — 한두 곳 평균으로 말하면 다음 한 곳에 뒤집힙니다.
 * ⚠ 높다·낮다는 아래 `판정`(섞어 보기, b827)이 정합니다. 1등−꼴찌 0.2 로 정하던 것은 우연을 취향이라 불러서 걷었습니다.
 * 막대는 ★1~★5 전체 폭입니다(차이를 부풀리지 않음). 숫자가 주인공입니다. */
const 띠들 = [
  { 이름: '국내', 말: '국내', 맞나: x => x.kr },
  { 이름: '1,500km 안 해외', 말: '1,500km 안 해외', 맞나: x => !x.kr && x.km != null && x.km < 1500 },
  { 이름: '1,500~4,500km', 말: '1,500~4,500km', 맞나: x => !x.kr && x.km >= 1500 && x.km < 4500 },
  { 이름: '4,500~8,000km', 말: '4,500~8,000km', 맞나: x => !x.kr && x.km >= 4500 && x.km < 8000 },
  { 이름: '8,000km 넘게', 말: '8,000km 넘게 간 곳', 맞나: x => !x.kr && x.km >= 8000 },
];
function 거리별(목록){
  if (목록.length < 5) return null;
  const 띠 = 띠들.map(b => {
    const xs = 목록.filter(b.맞나);
    return { ...b, xs, 평균: xs.length ? xs.reduce((a, x) => a + x.stars, 0) / xs.length : null };
  }).filter(b => b.xs.length);
  if (띠.length < 2) return null;
  /* 견주는 무리 = 띠, 나머지를 셀 사람들 = 띠에 든 곳 전부(좌표 없는 해외는 어느 띠에도 안 듦). */
  const 뜻 = 판정(띠, 목록.filter(x => 띠들.some(b => b.맞나(x))));
  const 곳 = xs => xs.map(b => b.말).join('·');
  const 말 = !뜻 ? ''
    : 뜻.높은.length && 뜻.낮은.length ? `${곳(뜻.높은)}에서 별이 다른 거리보다 높고, ${곳(뜻.낮은)}에서는 낮아요`
    : 뜻.높은.length ? `${곳(뜻.높은)}에서 별이 다른 거리보다 높아요`
    : 뜻.낮은.length ? `${곳(뜻.낮은)}에서 별이 다른 거리보다 낮아요`
    : '거리에 따라 뚜렷한 차이는 아직 안 보여요';
  const 높들 = new Set(뜻?.높은 || []);

  const el = 카드('거리별 별점');
  /* 한 줄에 [띠 · 막대 · 별(곳 수)] — b811 에 분석 탭을 두 칸으로 나누며 줄였습니다(사용자가 고른 시안 A). 전에는
     띠마다 이름 줄 · 막대 줄 · 예시 도시 줄의 세 줄이라 카드가 491px 였습니다. 곳 수는 남겨 둡니다 — 여섯 곳과
     스물여덟 곳의 평균은 무게가 다릅니다. */
  el.insertAdjacentHTML('beforeend', 띠.map(b => 별줄(esc(b.이름), b, 높들.has(b))).join('') +
    (말 ? `<div class="memo" style="margin-top:10px">${esc(말)}</div>` : ''));
  return el;
}

/* 별점 줄 하나 [이름 · 막대 · ★평균(곳 수)] — 거리별 · 종류별 · 나라별이 같이 씁니다(b824 에 거리별에서 뽑음).
   이름은 **이미 esc 한 HTML** 로 받습니다(나라별이 국기를 붙입니다). 막대는 ★1~★5 전체 폭(차이를 부풀리지 않음).
   `위` 는 섞어 봐도 뚜렷하게 높은 줄(--brand, 아래 `판정`), `흐림` 은 세 곳이 안 돼 견주지 않은 줄(.thin). */
function 별줄(이름, b, 위, 흐림){
  const 폭 = Math.max(0, Math.round((b.평균 - 1) / 4 * 100));
  return `<div class="dbr${위 ? ' top' : ''}${흐림 ? ' thin' : ''}">
    <b>${이름}</b>
    <div class="dbt"><i style="width:${폭}%"></i></div>
    <span><em>★${b.평균.toFixed(1)}</em><small>${b.xs.length}곳</small></span></div>`;
}
const 평균 = xs => xs.reduce((a, x) => a + x.stars, 0) / xs.length;
/* 줄 세우기 — **세 곳 넘는 것끼리 평균 높은 순**, 그 밑에 두 곳 이하(흐리게). 평균만으로 세우면 두 곳 ★5 가
   스무 곳 ★4.6 위에 서서 「1등」처럼 읽힙니다(거리별의 「세 곳 미만은 견주지 않는다」와 같은 까닭). */
function 세우기(xs){
  const 순 = (a, b) => b.평균 - a.평균 || b.xs.length - a.xs.length || a.이름.localeCompare(b.이름, 'ko');
  return [...xs.filter(t => t.xs.length >= 3).sort(순), ...xs.filter(t => t.xs.length < 3).sort(순)];
}
/* ══ 취향 판정(b827) — 「한 무리 대 나머지」를 섞어 봐서 ═══════════════════════════════════════
 * 사용자: 「1번가자」(2026-10-03 콘텐츠 점검 리포트 ①). 거리별 · 종류별 · 나라별이 같이 씁니다.
 * ⚠⚠ **1등과 꼴찌가 별 0.2 넘게 벌어지면 「○○가 가장 높고 △△가 가장 낮아요」라고 하던 것을 걷었습니다.** ⚠⚠
 *   별점이 거리·종류·나라와 아무 상관 없는 가짜 사람(한국 여행자 흉내)에게도 그 말이 나왔습니다 — 종류별 20곳 99% ·
 *   거리별 20곳 93% · 나라별 40곳 95%(이 화면 코드에 넣어 잼). 견주는 무리가 많을수록 우연한 0.2 는 거의 늘 생겨서
 *   **매길수록 더 틀렸습니다**(여러 번 견주기 함정).
 * 이제: 세 곳 넘는 무리마다 「그 무리 대 나머지」의 평균 차이를 흔들림으로 나눈 값(t)을 잽니다. 별점을 무작위로 999번
 *   섞어 «가장 큰 t» 가 어디까지 나오는지 보고(섞어 보기 = 순열 검정), 그 95% 선을 넘는 무리만 말합니다 — 무리가 몇 개든
 *   우연으로 말할 확률이 5% 안쪽입니다(가장 큰 값으로 재므로). 나머지보다 위면 「높아요」, 아래면 「낮아요」.
 *   잰 값(가짜 사람 40곳): 취향 없는데 말함 94~99% → 3~4% · 진짜 취향(별 0.8 더) 맞힘 30~41%. 덜 말하지만 말하면 맞습니다.
 *   못 넘으면 「뚜렷한 차이는 아직 안 보여요」 — 옛 「크게 다르지 않아요」는 그것대로 단정이라(적게 매겨 못 가린 것일 수 있음).
 * ⚠ 차이가 별 0.2 밑이면 넘어도 말하지 않습니다 — 많이 매기면 0.1 도 «뚜렷»해지는데 취향이라 부를 크기가 아닙니다.
 * ⚠ 섞는 차례는 자료(도시·별점)로 정한 씨앗으로 고정 — 같은 기록이면 열 때마다 같은 말(경계에서 깜빡이지 않게).
 * ⚠ 화면 값(소수 한 자리)이 같은 것은 같이 말하고 같이 칠합니다(b824 사용자 규칙 — 「★4.3」 둘 중 하나만 칠하면 근거
 *   없어 보임). 뚜렷한 무리가 있을 때만 그 옆에 붙으므로 「우연으로 말할 확률」은 그대로입니다.
 * ⚠ 「○○ 최애」 상(좋아한종류)은 이것을 안 씁니다 — 1등을 «둘째»와 견주고 ★4 이상만이라 우연으로 주는 일이 3~4%(같은 날 잼).
 * 돌려주는 것: null(견줄 무리가 둘이 안 됨 — 말 없음) 또는 { 높은, 낮은 }(둘 다 비면 「아직 안 보여요」). */
const 섞는수 = 999;
const 씨앗 = 글 => { let h = 2166136261; for (let i = 0; i < 글.length; i++){ h ^= 글.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const 난수 = 씨 => () => {                                      /* mulberry32 — 씨앗이 같으면 같은 줄 */
  씨 = (씨 + 0x6D2B79F5) | 0;
  let t = Math.imul(씨 ^ (씨 >>> 15), 1 | 씨);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
function 판정(무리들, 모두){
  const n = 모두.length;
  const 셀 = 무리들.filter(t => t.xs.length >= 3 && n - t.xs.length >= 3);
  if (셀.length < 2) return null;
  const 자리 = new Map(모두.map((x, i) => [x, i]));
  const 칸 = 셀.map(t => t.xs.map(x => 자리.get(x)));
  const 별 = 모두.map(x => x.stars);
  const 합 = 별.reduce((a, b) => a + b, 0), m = 합 / n;
  const 분산 = 별.reduce((a, s) => a + (s - m) ** 2, 0) / (n - 1);
  if (!분산) return { 높은: [], 낮은: [] };                      /* 별이 다 같음 — 다를 것이 없음 */
  /* 섞어도 별 묶음은 그대로라 흔들림(분산)·나머지 합은 안 바뀝니다 — 무리마다 나눌 값을 한 번만 셉니다. */
  const 자 = 칸.map(ix => 1 / Math.sqrt(분산 * (1 / ix.length + 1 / (n - ix.length))));
  const 차이 = s => 칸.map(ix => { let sg = 0; for (const i of ix) sg += s[i]; return sg / ix.length - (합 - sg) / (n - ix.length); });
  const 본 = 차이(별);
  const rnd = 난수(씨앗(모두.map(x => `${x.id}:${x.stars}`).join('|')));
  const s = 별.slice(), 섞은 = [];
  for (let k = 0; k < 섞는수; k++){
    for (let i = n - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const v = s[i]; s[i] = s[j]; s[j] = v; }
    섞은.push(차이(s).reduce((a, d, g) => Math.max(a, Math.abs(d) * 자[g]), 0));
  }
  섞은.sort((a, b) => a - b);
  /* 1,000(섞은 999 + 실제 1) 중 위 50 = 5%. 이 선을 «넘어야» p < 0.05 입니다. */
  const 선 = 섞은[섞는수 + 1 - 50];
  const 쪽 = (t, 위로) => { const g = 셀.indexOf(t), d = 본[g]; return (위로 ? d > 0 : d < 0) && Math.abs(d) >= 0.2 && Math.abs(d) * 자[g] > 선; };
  const 글 = t => t.평균.toFixed(1);
  const 같이 = 위로 => { const 뚜 = 셀.filter(t => 쪽(t, 위로));
    return 셀.filter(t => 뚜.includes(t) || (뚜.some(a => 글(a) === 글(t)) && (위로 ? 본[셀.indexOf(t)] > 0 : 본[셀.indexOf(t)] < 0))); };
  return { 높은: 같이(true), 낮은: 같이(false) };
}
/* 견주는 말(종류별 · 나라별) — `모두` 는 나머지를 셀 사람들(종류가 정해진 곳 / 나라가 있는 곳). */
function 견주기(줄, 무엇, 모두){
  const 뜻 = 판정(줄, 모두);
  if (!뜻) return { 말: '', 높들: new Set() };
  const 이름 = xs => xs.map(t => t.보일 || t.이름).join('·');
  const { 높은, 낮은 } = 뜻;
  const 말 = 높은.length && 낮은.length ? `${josa(이름(높은), '은', '는')} 다른 ${무엇}보다 별이 높고, ${josa(이름(낮은), '은', '는')} 낮아요`
    : 높은.length ? `${josa(이름(높은), '이', '가')} 다른 ${무엇}보다 별이 높아요`
    : 낮은.length ? `${josa(이름(낮은), '이', '가')} 다른 ${무엇}보다 별이 낮아요`
    : `${무엇}에 따라 뚜렷한 차이는 아직 안 보여요`;
  return { 말, 높들: new Set(높은) };
}

/* ══ ④ 여행지 종류별 별점(b824, 사용자: 「별점 칸 1번」) ═════════════════════════════════════
 * 도시 종류(cities.kinds) 열 가지마다 평균 별점 — 「해변을 좋아하나, 유적을 좋아하나」. 거리별과 같은 줄 모양.
 * ⚠ 한 도시에 종류가 여럿이면(평균 2.1개) 그 종류마다 셉니다. 종류가 없는 도시(721곳 중 253곳, 10-02 실측)는 뺍니다 —
 *   그래서 곳 수 합이 매긴 수와 안 맞습니다. 카드 끝에 「종류가 정해진 N곳으로 셌어요」를 답니다.
 * ⚠ 국내도 셉니다(이 칸 규칙 — 머리말). 성향(card.js)은 국내를 빼지만 여기는 «내가 매긴 도시» 이야기입니다. */
function 종류표(목록){
  const 표 = new Map();
  for (const x of 목록) for (const t of x.kinds || []){ if (!표.has(t)) 표.set(t, []); 표.get(t).push(x); }
  return 세우기([...표].map(([이름, xs]) => ({ 이름, 보일: 종류이름[이름] || 이름, xs, 평균: 평균(xs) })));
}
/* 가장 좋아한 종류 — 세 곳 넘는 종류의 1등이 **둘째보다** 0.2 넘게 높을 때만(「○○ 최애」 상이 씁니다).
   카드의 견주는 말(1등과 꼴찌)보다 엄격합니다 — 「좋아한다」는 1등이 뚜렷해야 할 수 있는 말입니다. */
function 좋아한종류(표){
  const 셀 = 표.filter(t => t.xs.length >= 3);
  if (셀.length < 2) return null;
  return 셀[0].평균 - 셀[1].평균 >= 0.2 ? 셀[0] : null;
}
function 종류별(목록){
  if (목록.length < 5) return null;
  const 줄 = 종류표(목록);
  if (줄.length < 2) return null;
  const 종류있는 = 목록.filter(x => (x.kinds || []).length);
  const { 말, 높들 } = 견주기(줄, '종류', 종류있는);
  const 센곳 = 종류있는.length;
  const el = 카드('여행지 종류별 별점');
  el.insertAdjacentHTML('beforeend', 줄.map(t => 별줄(esc(t.보일), t, 높들.has(t), t.xs.length < 3)).join('') +
    `<div class="memo" style="margin-top:10px">${말 ? esc(말) + ' · ' : ''}종류가 정해진 ${센곳}곳으로 셌어요</div>`);
  return el;
}

/* ══ ⑤ 나라별 별점(b824, 사용자: 「별점 칸 2번」) ═════════════════════════════════════════
 * 두 곳 이상 매긴 나라만 — 한 곳이면 그 도시 별점이지 나라 평균이 아닙니다. 나라는 모국(줄들의 `나라`).
 * 발자국(기록 탭)은 «몇 나라를 갔나», 여기는 «어디가 좋았나» — 안 겹칩니다. 국기는 그릴 수 있는 기기에서만(map.js 와 같은 수법). */
function 나라별(목록){
  if (목록.length < 5) return null;
  const 표 = new Map();
  for (const x of 목록) if (x.나라){ if (!표.has(x.나라)) 표.set(x.나라, []); 표.get(x.나라).push(x); }
  const 다 = [...표].map(([code, xs]) => ({ code, 이름: countryName[code] || code, xs, 평균: 평균(xs) }));
  const 줄 = 세우기(다.filter(n => n.xs.length >= 2));
  if (줄.length < 2) return null;
  const { 말, 높들 } = 견주기(줄, '나라', 목록.filter(x => x.나라));
  const 한곳 = 다.length - 줄.length;
  const 깃 = code => (flagOk() ? `<i class="dbflag">${flagOf(code)}</i>` : '');
  const 밑 = [말, 한곳 ? `한 곳만 매긴 나라 ${한곳}곳은 뺐어요` : ''].filter(Boolean).map(esc).join(' · ');
  const el = 카드('나라별 별점');
  el.insertAdjacentHTML('beforeend', 줄.map(n => 별줄(깃(n.code) + esc(n.이름), n, 높들.has(n), n.xs.length < 3)).join('') +
    (밑 ? `<div class="memo" style="margin-top:10px">${밑}</div>` : ''));
  return el;
}

/* ══ ③ 여행지 월드컵(옛 「진짜 최애」) ═════════════════════════════════════════════════
 * 별점 높은 순으로 세 자리를 채우고, **같은 별점끼리만** 둘씩 보여 줘 가르게 합니다(명세 17.2 「동점 비교만」).
 * 가른 결과는 city_ratings.fav_rank 에 적습니다(111) — 1·2·3 = 순위, 0 = 같이 겨뤘지만 셋 밖, 빈칸 = 안 겨룸.
 * ⚠ 동점 층에 **안 겨룬 도시가 하나라도 있으면**(새로 ★5 를 줬다든가) 다시 고르라고 합니다. 옛 순위가 새 도시를
 *   모른 채 서 있으면 거짓말입니다.
 * ⚠ 가를 동점이 없으면(별점이 다 다르면) 겨루지 않고 바로 1·2·3위를 보입니다.
 * ⚠ 110·111 트리거가 fav_rank 만 바뀐 줄은 updated_at 을 안 건드립니다 — 일기장·보관함 최신순이 안 흔들립니다. */
function 자리들(목록){
  const 층 = [...new Set(목록.map(x => x.stars))].sort((a, b) => b - a);
  const 자리 = [];
  let 남 = 3;
  for (const s of 층){
    if (남 <= 0) break;
    const xs = 목록.filter(x => x.stars === s).sort(이름순);
    const 뽑을 = Math.min(남, xs.length);
    자리.push({ 별: s, xs, 뽑을 });
    남 -= 뽑을;
  }
  return 자리;
}
/* 저장된 순위로 셋을 세웁니다. 동점 층에 안 겨룬 곳이 있거나 칸 수가 안 맞으면 null(다시 고르기). */
function 저장순위(자리, 순위표){
  const 셋 = [];
  for (const z of 자리){
    if (z.xs.length === 1){ 셋.push(z.xs[0]); continue; }
    if (z.xs.some(x => 순위표[x.id] == null)) return null;
    const 뽑힌 = z.xs.filter(x => 순위표[x.id] >= 1).sort((a, b) => 순위표[a.id] - 순위표[b.id]);
    if (뽑힌.length !== z.뽑을) return null;
    셋.push(...뽑힌);
  }
  return 셋;
}
/* 같은 별점 층 안에서 위 `뽑을` 자리만 줄 세웁니다 — 아래서부터 넣기. 셋이면 두세 번, 열이면 스무 번 안쪽. */
async function 가르기(자리, 묻기){
  const 셋 = [];
  for (const z of 자리){
    if (z.xs.length === 1){ 셋.push(z.xs[0]); continue; }
    const L = [];
    for (const x of z.xs){
      if (L.length === z.뽑을){
        if ((await 묻기(L[L.length - 1], x)) !== x) continue;   /* 꼴찌도 못 이기면 여기서 끝 */
        L.pop();
      }
      let i = L.length;
      while (i > 0 && (await 묻기(L[i - 1], x)) === x) i--;
      L.splice(i, 0, x);
    }
    셋.push(...L);
  }
  return 셋;
}

async function 최애(목록, uid){
  if (목록.length < 5) return null;
  const 자리 = 자리들(목록);
  const 동점 = 자리.some(z => z.xs.length > 1);
  /* 저장된 순위 — 111 을 안 돌렸으면 칸이 없어서 오류가 옵니다. 그때는 저장된 것이 없는 것으로 봅니다. */
  let 순위표 = {};
  if (동점 && uid){
    const r = await sb.from('city_ratings').select('city_id,fav_rank').eq('user_id', uid).not('fav_rank', 'is', null);
    if (!r.error) for (const x of r.data || []) if (x.fav_rank != null) 순위표[x.city_id] = x.fav_rank;
  }
  /* 이름은 「진짜 최애」 → 「여행지 월드컵」(2026-10-01 사용자). 접기는 도시 어워즈와 같은 접는카드(위 「접기」). */
  const { el, 몸 } = 접는카드('여행지 월드컵');

  /* 1·2·3위 — 어워즈와 같은 사진 줄(옆으로 넘겨 보기, b813). 딱지에 순위와 별점. */
  const 시상 = (셋, 다시) => {
    몸.innerHTML = 사진줄(셋, (x, i) => `${i + 1}위 · ★${별글(x.stars)}`) +
      (다시 ? `<button class="p16open" data-fv="again">다시 고르기 ›</button>` : '');
    몸.querySelector('[data-fv="again"]')?.addEventListener('click', () => 시작(''));
  };

  /* ⚠⚠ **「고르기 시작」 단추 없이 첫 대결이 바로 펼쳐집니다(b813, 사용자: 「여행지 월드컵도 펼쳐줘」).** ⚠⚠
     b810~b812 는 안내 한 줄 + 단추였습니다. 그래서 「그만하기」도 걷었습니다 — 돌아갈 «시작 전» 화면이 없습니다.
     고르다 다른 탭에 가면 다음에 처음부터(저장은 끝까지 골랐을 때 한 번).
     ⚠ 두 도시는 **위아래로** 크게 놓습니다 — 둘을 한눈에 봐야 고를 수 있어서 여기만은 옆으로 넘기지 않습니다. */
  async function 시작(안내){
    let 번 = 0;
    const 층 = 자리.filter(z => z.xs.length > 1);
    const 말 = 층.length === 1
      ? `★${별글(층[0].별)} 준 ${층[0].xs.length}곳 중 ${층[0].뽑을 === 1 ? '진짜 1위' : '1·2·3위'}를 골라 주세요`
      : '별점이 같은 곳끼리 두 곳씩 골라 1·2·3위를 정해요';
    const 묻기 = (a, b) => new Promise(res => {
      번++;
      몸.innerHTML = `<div class="memo">${esc((안내 || '') + 말)}</div>
        <div class="fvvs">
          <div class="fvc" data-pick="a" role="button" tabindex="0" aria-label="${esc(a.name)} 고르기">${사진칸([a])}<div class="awn">${esc(a.name)}</div></div>
          <div class="fvx">VS</div>
          <div class="fvc" data-pick="b" role="button" tabindex="0" aria-label="${esc(b.name)} 고르기">${사진칸([b])}<div class="awn">${esc(b.name)}</div></div>
        </div>
        <div class="memo" style="text-align:center">어디가 더 좋았어요? · ${번}번째</div>`;
      몸.querySelectorAll('[data-pick]').forEach(p => p.addEventListener('click', () => res(p.dataset.pick === 'a' ? a : b)));
    });
    const 셋 = await 가르기(자리, 묻기);
    await 저장(셋);
    시상(셋, true);
  }

  async function 저장(셋){
    if (!uid) return;
    /* 동점 층의 도시마다: 뽑혔으면 1~3(셋 안의 자리), 아니면 0. 층 밖에 남은 옛 순위는 비웁니다. */
    const 새 = {};
    for (const z of 자리) if (z.xs.length > 1) for (const x of z.xs) 새[x.id] = 0;
    셋.forEach((x, i) => { if (x.id in 새) 새[x.id] = i + 1; });
    const 묶음 = new Map();
    for (const [id, v] of Object.entries(새)){ if (!묶음.has(v)) 묶음.set(v, []); 묶음.get(v).push(id); }
    const 옛 = Object.keys(순위표).filter(id => !(id in 새));
    const rs = await Promise.all([
      ...[...묶음].map(([v, ids]) => sb.from('city_ratings').update({ fav_rank: v }).eq('user_id', uid).in('city_id', ids)),
      ...(옛.length ? [sb.from('city_ratings').update({ fav_rank: null }).eq('user_id', uid).in('city_id', 옛)] : [])]);
    const 틀림 = rs.find(r => r.error);
    if (틀림){
      toast('순위를 저장하지 못했어요');
      self.reportError?.(new Error('최애 순위 저장: ' + (틀림.error.message || '')));
      return;
    }
    순위표 = Object.fromEntries(Object.entries(새));
  }

  if (!동점){ 시상(자리.flatMap(z => z.xs), false); return el; }
  const 있던 = 저장순위(자리, 순위표);
  if (있던) 시상(있던, true);
  /* 기다리지 않습니다 — 고르기는 사용자가 누를 때까지 안 끝나므로, 여기서 기다리면 탭 전체가 멈춥니다. */
  else 시작(Object.keys(순위표).length ? '새로 매긴 곳이 생겨서 다시 골라야 해요 · ' : '')
    .catch(e => { console.error('@mycity', e); self.reportError?.(e); });
  return el;
}

/* ── 부르는 곳(anal.js) ── 「내 별점」 카드 바로 밑에 차례대로 붙입니다.
 * ⚠ 하나가 터져도 나머지는 붙입니다 — 카드 하나 때문에 탭 끝이 비면 안 됩니다. */
export async function drawMyCities(rows, 칸 = {}, uid){
  /* b812: 칸이 둘로 갈렸습니다 — 거리별 별점은 「별점」 칸, 도시 어워즈 · 여행지 월드컵은 「어워즈」 칸(anal.js). */
  const 목록 = 줄들(rows);
  const 붙이기 = (곳, 만들기) => {
    try { const el = 만들기(); if (곳 && el) 곳.appendChild(el); }
    catch (e){ console.error('@mycity', e); self.reportError?.(e); }
  };
  붙이기(칸.어워즈, () => 어워즈(목록));
  붙이기(칸.별점, () => 거리별(목록));
  /* b824: 별점 칸에 둘 더 — 종류별 · 나라별(거리별과 같은 줄 모양). 차례는 사용자가 고른 번호 순(1 종류 · 2 나라). */
  붙이기(칸.별점, () => 종류별(목록));
  붙이기(칸.별점, () => 나라별(목록));
  try { const el = await 최애(목록, uid); if (칸.어워즈 && el) 칸.어워즈.appendChild(el); }
  catch (e){ console.error('@mycity', e); self.reportError?.(e); }
}

/* ── 자가검사 ── 콘솔에서 __myCityCheck(). 지어낸 도시로 규칙만 봅니다. */
if (typeof window !== 'undefined') window.__myCityCheck = async () => {
  const out = [];
  const bad = (항목, msgs) => out.push({ 항목, 결과: msgs.length ? '✗ ' + msgs.join(' / ') : '✓' });
  const 도 = (id, stars, fame, kr, km) => ({ id, name: id, stars, fame, kr, km, img: '' });
  /* 1. 순위 — 같은 별점끼리만 겨루고, 결과가 별점 순서를 거스르지 않는다. */
  {
    const msgs = [];
    const 목록 = [도('a', 5), 도('b', 5), 도('c', 5), 도('d', 4.5), 도('e', 4.5), 도('f', 4)];
    const 자리 = 자리들(목록);
    if (자리.length !== 1 || 자리[0].뽑을 !== 3) msgs.push(`★5 셋이면 층 하나·셋 뽑기여야 함 ${JSON.stringify(자리.map(z => [z.별, z.뽑을]))}`);
    const 취향 = ['c', 'a', 'b'];                           /* 이 사람은 c > a > b */
    let 물음 = 0;
    const 셋 = await 가르기(자리, async (x, y) => { 물음++; return 취향.indexOf(x.id) < 취향.indexOf(y.id) ? x : y; });
    if (셋.map(x => x.id).join() !== 'c,a,b') msgs.push(`결과 ${셋.map(x => x.id)}`);
    if (물음 > 3) msgs.push(`세 곳에 ${물음}번 물음`);
    const 목록2 = [도('a', 5), 도('b', 4.5), 도('c', 4.5), 도('d', 4.5), 도('e', 4.5)];
    const 자리2 = 자리들(목록2);
    const 취향2 = ['e', 'c', 'b', 'd'];
    const 셋2 = await 가르기(자리2, async (x, y) => (취향2.indexOf(x.id) < 취향2.indexOf(y.id) ? x : y));
    if (셋2.map(x => x.id).join() !== 'a,e,c') msgs.push(`★5 하나 + ★4.5 넷에서 두 자리 → ${셋2.map(x => x.id)}`);
    /* 저장된 순위 되읽기 · 새 동점 도시가 생기면 null */
    const 표 = { a: 0, b: 0, c: 0, e: 1, d: 0 };
    표.c = 2; 표.b = 0;
    if (저장순위(자리2, 표)?.map(x => x.id).join() !== 'a,e,c') msgs.push('저장된 순위를 못 읽음');
    if (저장순위(자리들([...목록2, 도('z', 4.5)]), 표) !== null) msgs.push('새 동점 도시가 생겨도 옛 순위를 씀');
    bad('최애 고르기 — 동점끼리만 · 순서 · 저장 되읽기', msgs);
  }
  /* 2. 어워즈 — 한 도시는 상 하나 · 문턱 · 둘 미만이면 카드 없음. */
  {
    const msgs = [];
    const 목록 = [도('p', 5, 1, false, 9000), 도('q', 5, 3, false, 8500), 도('r', 1, 1, false, 3000),
                  도('s', 4.5, 2, false, 1000), 도('t', 3, 2, true, 200), 도('u', 2.5, 1, false, 9500)];
    const el = 어워즈(목록);
    const 글 = el ? el.textContent : '';
    if (!el) msgs.push('카드가 안 나옴');
    else {
      /* 사진 장으로 셉니다 — 글자로 세면 접힘 줄(b813, 머리의 「★5 · p · q」)과 사진 밑 이름이 같이 걸립니다. */
      const 장 = [...el.querySelectorAll('.awslide')].map(s => s.dataset.city);
      if (new Set(장).size !== 장.length) msgs.push('한 도시가 두 상을 받음');
      if (!/가장 아쉬웠던 곳/.test(글)) msgs.push('★1 이 있는데 「가장 아쉬웠던 곳」이 없음');
      if (!/가까운 최애/.test(글)) msgs.push('1,000km ★4.5 가 있는데 「가까운 최애」가 없음');
    }
    if (어워즈([도('a', 3), 도('b', 3), 도('c', 3), 도('d', 3), 도('e', 3)])) msgs.push('다 ★3 인데 카드가 나옴');
    bad('도시 어워즈 — 상 하나씩 · 문턱 · 없으면 숨김', msgs);
  }
  /* 3. 거리별(b827 판정) — 뚜렷하면 그 띠를 부름 · 세 곳 미만 띠는 안 부름 · 작은 차이는 「아직 안 보여요」 · 같은 답.
     ⚠ 섞어 보기는 여덟 곳쯤으로는 뚜렷하다고 하지 않습니다(그게 맞음) — 그래서 자료를 띠마다 여섯 곳으로 키웠습니다. */
  {
    const msgs = [];
    const 여럿 = (머리, n, 별들, kr, km) => Array.from({ length: n }, (_, i) => 도(`${머리}${i}`, 별들[i % 별들.length], 2, kr, km));
    /* 먼 곳 여섯 ★5 · 국내 여섯 ★3 · 가까운 해외 여섯 ★3~3.5 · 1,500~4,500km 한 곳 ★1(세 곳이 안 돼 못 부름) */
    const 목록 = [...여럿('k', 6, [3], true, 100), ...여럿('n', 6, [3, 3.5], false, 1000),
                  ...여럿('f', 6, [5], false, 9000), 도('m1', 1, 2, false, 3000)];
    const 글 = 거리별(목록)?.textContent || '';
    if (!/8,000km 넘게 간 곳에서 별이 다른 거리보다 높/.test(글)) msgs.push('먼 곳이 뚜렷이 높은데 말이 없음: ' + 글.slice(-50));
    if (/1,500~4,500km에서/.test(글)) msgs.push('한 곳뿐인 띠를 부름');
    if ((거리별(목록)?.textContent || '') !== 글) msgs.push('같은 기록인데 열 때마다 말이 다름');
    const 같음 = 거리별([도('a', 3, 2, true, 1), 도('b', 3, 2, true, 1), 도('c', 3.1, 2, true, 1),
                        도('d', 3, 2, false, 9000), 도('e', 3.1, 2, false, 9000), 도('f', 3, 2, false, 9000)])?.textContent || '';
    if (!/뚜렷한 차이는 아직 안 보여요/.test(같음)) msgs.push('0.1 차이를 취향이라 부름');
    bad('거리별 별점 — 섞어 보기 판정 · 세 곳 문턱 · 작은 차이 · 같은 답', msgs);
  }
  /* 4. 종류별 · 나라별(b824 · b827 판정) — 세 곳 넘는 것끼리만 · 위에 세움 · 두 곳 이하는 흐리게 밑에 · 한 곳 나라는 뺌. */
  {
    const msgs = [];
    const 종 = (id, stars, kinds, 나라) => ({ ...도(id, stars, 2, 나라 === 'KR', 1000), kinds, 나라 });
    const 여럿 = (머리, n, stars, kinds, 나라) => Array.from({ length: n }, (_, i) => 종(`${머리}${i}`, stars, kinds, 나라));
    /* 해변(태국) 여섯 ★5 · 유적(이탈리아) 여섯 ★3 · 미식(한국 다섯 + 프랑스 하나) ★4 · 온천(일본) 한 곳 ★5 */
    const 목록 = [...여럿('a', 6, 5, ['해변'], 'TH'), ...여럿('d', 6, 3, ['유적'], 'IT'),
                  ...여럿('m', 5, 4, ['미식'], 'KR'), 종('h', 4, ['미식'], 'FR'), 종('g', 5, ['온천'], 'JP')];
    const 글 = 종류별(목록)?.textContent || '';
    if (!/해변은 다른 종류보다 별이 높고, 유적은 낮아요/.test(글)) msgs.push('뚜렷한 해변·유적을 못 부름: ' + 글.slice(-60));
    const 첫줄 = 종류별(목록)?.querySelector('.dbr b')?.textContent;
    if (첫줄 !== '해변') msgs.push(`맨 위가 해변이 아님(${첫줄}) — 한 곳 ★5 온천이 올라섬`);
    const 나 = 나라별(목록);
    const 나라줄 = [...(나?.querySelectorAll('.dbr') || [])];
    if (나라줄.some(r => /일본|프랑스/.test(r.textContent))) msgs.push('한 곳만 매긴 나라가 줄에 나옴');
    if (!/한 곳만 매긴 나라 2곳은 뺐어요/.test(나?.textContent || '')) msgs.push('뺀 나라 수를 안 적음');
    /* 화면 값이 같으면 같이 — 뚜렷한 태국 ★5.0(여덟 곳) 옆의 한국 ★5.0(네 곳)도 같이 칠하고 같이 말함(b824 규칙). */
    const 같 = 나라별([...여럿('t', 8, 5, [], 'TH'), ...여럿('k', 4, 5, [], 'KR'), ...여럿('v', 8, 3, [], 'VN')]);
    if ((같?.querySelectorAll('.dbr.top') || []).length !== 2) msgs.push('★5.0 둘 중 하나만 칠함');
    /* ⚠ 나라 이름은 목록을 받아야 생깁니다 — CI(tools/check-app.mjs)는 서버에 못 닿아 「TH·KR」로 나옵니다(b827 에 CI 가
         「태국·한국」을 찾다 실패). 화면이 쓰는 것과 같은 이름(없으면 코드)으로 찾습니다. */
    const 이 = c => countryName[c] || c;
    if (!(같?.textContent || '').includes(`${이('TH')}·${이('KR')}`)) msgs.push('같은 ★5.0 을 같이 말하지 않음: ' + (같?.textContent || '').slice(-50));
    /* 작은 차이 — 4.17 대 4.0(0.17)은 말하지 않음. */
    const 잔 = 종류별([종('a1', 4.5, ['해변'], 'TH'), 종('a2', 4, ['해변'], 'TH'), 종('a3', 4, ['해변'], 'TH'),
                       종('b1', 4, ['유적'], 'IT'), 종('b2', 4, ['유적'], 'IT'), 종('b3', 4, ['유적'], 'IT')]);
    if (!/뚜렷한 차이는 아직 안 보여요/.test(잔?.textContent || '')) msgs.push('0.17 차이를 취향이라 부름');
    bad('종류별 · 나라별 — 섞어 보기 판정 · 세 곳 문턱 · 흐린 줄 · 한 곳 나라 · 화면 값 동점', msgs);
  }
  /* 5. 새 상 셋(b824) — 「가장」은 전체 1등에게만. 1등이 이미 상을 받았으면 2등에게 넘기지 않고 건너뜀. */
  {
    const msgs = [];
    const 상 = (id, stars, visits, 일기) => ({ ...도(id, stars, 2, false, 3000), visits, 일기, kinds: [] });
    /* 「최애 도시」(★5)가 가장 여러 번 간 곳이기도 하다 → 단골은 건너뛰어야(★4 세 번 간 곳에 「가장」을 주면 거짓). */
    const el = 어워즈([상('top', 5, 5, 0), 상('two', 4, 3, 0), 상('x', 3, 1, 0), 상('y', 3, 1, 0), 상('w', 1, 1, 0),
                       상('j', 3.5, 1, 300)]);
    const 글 = el?.textContent || '';
    if (/단골 도시/.test(글)) msgs.push('1등(최애)이 이미 상을 받았는데 2등에게 「단골」을 줌');
    if (!/일기를 가장 많이 쓴 곳/.test(글)) msgs.push('일기 300자 도시에 상이 없음');
    bad('새 상 — 진짜 1등만 · 아니면 건너뜀', msgs);
  }
  /* 6. 우연을 취향이라 부르지 않는가(b827) — 별이 종류와 상관없는 30곳짜리 기록 40벌. 옛 규칙(1등−꼴찌 0.2)이면 거의 다
        말했습니다(10-03 점검: 20곳 99%). 섞어 보기는 5% 안쪽이어야 하므로 40벌 중 여섯 벌(15%)을 넘으면 틀린 것으로 봅니다. */
  {
    const msgs = [];
    const 종류들 = ['해변', '자연', '유적', '미식', '도심', '미술'];
    let 말함 = 0;
    for (let 벌 = 0; 벌 < 40; 벌++){
      let 씨 = 벌 * 7919 + 13;
      const 다음 = () => (씨 = (씨 * 16807) % 2147483647) / 2147483647;
      const 목록 = Array.from({ length: 30 }, (_, i) => {
        const 별 = Math.round((2.5 + 다음() * 2.5) * 2) / 2;
        const 첫 = 종류들[Math.floor(다음() * 6)], 둘 = 다음() < 0.5 ? 종류들[Math.floor(다음() * 6)] : 첫;
        return { ...도(`r${벌}_${i}`, 별, 2, false, 3000), kinds: [...new Set([첫, 둘])], 나라: 'TH' };
      });
      if (/보다 별이/.test(종류별(목록)?.textContent || '')) 말함++;
    }
    if (말함 > 6) msgs.push(`40벌 중 ${말함}벌에 취향이 있다고 함`);
    bad(`우연을 취향이라 부르지 않는가 — 상관없는 기록 40벌 중 ${말함}벌에 말함`, msgs);
  }
  console.table(out);
  return out;
};
