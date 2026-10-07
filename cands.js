/* ── 갈 만한 곳 · 빈 시간 · 좌표 채우기 ───────────────────────────────
 * 일정에 넣을 후보를 모으고, 하루 중 **비어 있는 시간**을 찾아 "여기 넣으면
 * 되겠네" 를 짚어 줍니다. 좌표가 없는 곳은 지도 서비스에 물어 채웁니다 —
 * 좌표가 있어야 이동 시간을 계산할 수 있고, 그래야 빈 시간이 말이 됩니다.
 *
 * ── app.js 에서 떼어낸 열아홉 번째 조각입니다(b344) ──────────────────
 * 세 머리말(`후보와 빈 시간` · `좌표 채우기` · `후보를 AI 에게 추천받기`)이
 * 나란히 붙어 있었고 실제로도 한 줄기입니다 — 후보를 모으고(AI 든 검색이든),
 * 좌표를 채우고, 그 좌표로 빈 시간을 잰다. 순서가 곧 이유입니다.
 *
 * app.js 만 아는 것은 셋입니다 — 일정 다시 받기, AI 화면 열기, 대화 다시 받기.
 * `cands`·`fitList`·`DAY_END` 같은 상태는 이 블록에서만 쓰던 것이라
 * 같이 데려왔습니다.
 *
 * 층: 아래층 여럿과 planmap · citysearch · cards 를 씁니다. */
import { $, esc, emptyDo } from './dom.js?v=b836';
import { sb } from './db.js?v=b836';
import { fail, netTimeout, offNote, drawOffbar, isOffline, NOROW } from './net.js?v=b836';
import { dayLabel, distKm, travelMinutes, legFirst } from './calc.js?v=b836';
import { trip, plans, legs } from './trip.js?v=b836';
import { search } from './cities.js?v=b836';
import { picked } from './citysearch.js?v=b836';
import { mapLinks } from './planmap.js?v=b836';
import { openPlanForm } from './cards.js?v=b836';
import { syncSheets } from './ui.js?v=b836';

let ctx = { loadPlans: async () => {}, openAi: () => {}, loadChats: async () => {} };
export function setCandsCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 후보와 빈 시간 ──────────────────────────────────────────────────
 * 도쿄 앱에서 가장 잘 굴러가던 기능입니다. 가고 싶은 곳을 모아두고,
 * 일정 사이에 뜬 시간에 "여기 넣을 수 있어요"라고 알려줍니다.
 *
 * 도쿄에서 겪은 세 가지를 그대로 가져와 막습니다.
 *   1. 밤에서 아침으로 걸친 구간을 빈 시간으로 잡던 것 (Day2 02:38~10:00)
 *      → 낮 시간대로 잘라내고, 그러고도 한 시간이 남을 때만 씁니다.
 *   2. 앞뒤 일정과 사실상 같은 자리를 또 제안하던 것
 *      (우에노 공원을 우에노 온시 공원 옆에)  → 0.3km 안쪽이면 거릅니다.
 *   3. 체류 시간으로 자르면 아무것도 안 남던 것
 *      → 오가는 시간을 뺀 "머물 수 있는 시간"을 보여주고 사용자가 정하게 합니다.
 *
 * 이동 시간은 도쿄의 고정식 대신 v2 의 구간별 상수를 씁니다. 이쪽이 낫습니다. */
const STAY = { 카페:40, 식사:60, 관광:90, 쇼핑:60, 이동:30, 숙소:0, 기타:60 };
const stayMin = c => STAY[c] ?? 60;
const DAY_START = 9 * 60, DAY_END = 21 * 60;   /* 이 밖은 자거나 쉬는 시간으로 봅니다 */
const SAME_KM = 0.3;                           /* 이보다 가까우면 사실상 같은 자리 */
let cands = [], fitList = [];

const toMin = t => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
                     return m ? +m[1] * 60 + +m[2] : 9999; };
export const hhmm = m => { m = Math.max(0, Math.round(m));
                    return ('0' + Math.floor(m / 60) % 24).slice(-2) +
                           ':' + ('0' + (m % 60)).slice(-2); };
/* legOf/tmin 은 calc.js 로 옮겼습니다(legFirst/travelMinutes) — legs 를 매개변수로
   받게 바뀌어서 여기서는 모듈 전역 legs 를 넘겨주는 한 줄 래퍼만 둡니다. */
const legOf = d => legFirst(legs, d);
const tmin = (km, d) => travelMinutes(legs, km, d);

function planGaps(){
  const byDay = {}, out = [];
  (plans || []).forEach(p => (byDay[p.date] = byDay[p.date] || []).push(p));
  Object.keys(byDay).forEach(d => {
    const list = byDay[d].slice().sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
    for (let i = 0; i < list.length - 1; i++){
      const a = list[i], b = list[i + 1];
      const t1 = toMin(a.start_time), t2 = toMin(b.start_time);
      if (t1 >= 9999 || t2 >= 9999) continue;
      /* v2 는 끝 시각을 받으므로 있으면 그걸 씁니다. 도쿄는 없어서 늘 어림했습니다. */
      const e = toMin(a.end_time);
      const aEnd = e < 9999 ? e : t1 + stayMin(a.category);
      if (t2 - aEnd < 60) continue;              /* 한 시간도 안 남으면 넣을 자리가 아닙니다 */
      const from = Math.max(aEnd, DAY_START), to = Math.min(t2, DAY_END);
      if (to - from < 60) continue;
      out.push({ date:d, after:a, before:b, from, to });
    }
  });
  return out;
}

function findFits(){
  const gaps = planGaps();
  const cs = cands.filter(c => c.lat != null && c.lng != null);
  const best = {};
  gaps.forEach(g => {
    if (g.after.lat == null || g.before.lat == null) return;
    cs.forEach(c => {
      const dA = distKm(g.after.lat, g.after.lng, c.lat, c.lng);
      const dB = distKm(c.lat, c.lng, g.before.lat, g.before.lng);
      if (dA == null || dB == null) return;
      if (dA < SAME_KM || dB < SAME_KM) return;
      const go = tmin(dA, g.date), back = tmin(dB, g.date);
      const avail = (g.to - g.from) - go - back;
      if (avail < 40) return;                    /* 40분도 안 되면 갈 만하지 않습니다 */
      if (best[c.id] && best[c.id].avail >= avail) return;
      best[c.id] = { cand:c, date:g.date, at:g.from + go, go, back, avail,
                     tight: avail < stayMin(c.category), after:g.after.title };
    });
  });
  return Object.values(best)
    .sort((a, b) => (b.avail - a.avail) || (a.go - b.go)).slice(0, 3);
}

/* ── 목록은 «하나»입니다(b725, 사용자 요청) ────────────────────────────
 * ⚠⚠ **같은 곳이 두 번 보이던 것을 합쳤습니다.** 위에 「빈 시간에 넣기
 *   좋은 곳」 줄이 따로 있고 아래에 후보 카드가 또 있어서, 긴자 라멘집
 *   하나가 화면에 두 번 나왔습니다(사용자 신고, 두 번째).
 *   b627 에 「↑ 넣을 자리 있어요」 표를 달아 «둘이 다른 것»이라고 알려
 *   주는 길로 갔었는데, 그건 **왜 두 개인지 설명한 것**이지 두 개인 것을
 *   고친 것이 아니었습니다. 설명이 필요하면 대개 구조가 틀린 것입니다.
 * ⚠ 잃은 것이 없는지 세어 봤습니다 — 위 줄에만 있던 것은 «자리 정보»
 *   (언제·어디서 몇 분·머물 수 있는 시간)와 「넣기」 단추 둘뿐입니다.
 *   그 둘을 카드 안으로 옮겼습니다. 지도·삭제는 원래 아래에만 있었습니다.
 * ⚠ **자리가 있는 곳을 위로 올립니다.** 전에 위 줄이 하던 일이 그것입니다 —
 *   합치면서 그것까지 잃으면 「지금 넣을 수 있는 곳」을 못 찾습니다.
 *   그 안에서는 findFits 의 차례(머물 수 있는 시간이 긴 것 먼저)를 지킵니다.
 * ⚠ 단추가 둘인 이유: 「이 자리에 넣기」는 **앱이 찾아준 자리 그대로**,
 *   「일정에 넣기」는 **내가 날짜와 시각을 고르는 것**입니다. 글자가 달라야
 *   두 단추가 왜 있는지 읽힙니다. */
function drawCands(){
  fitList = findFits();
  const 자리 = {};
  fitList.forEach((f, i) => { 자리[f.cand.id] = { f, i }; });
  /* 자리가 있는 것 먼저. 나머지는 원래 차례 그대로입니다(정렬은 안정적입니다). */
  const 차례 = [...cands].sort((a, b) => {
    const A = 자리[a.id], B = 자리[b.id];
    if (A && B) return A.i - B.i;
    return A ? -1 : B ? 1 : 0;
  });

  $('cands').innerHTML = cands.length
    /* 한 줄로 늘어놓으니 답답했습니다. 카드로 펼치고 할 수 있는 일을 다 답니다 —
       일정에 넣기 · 지도 · 삭제. 도쿄 앱의 후보 여행지와 같은 구성입니다. */
    ? 차례.map(c => {
        const ml = mapLinks(c, trip?.destination);
        /* '좌표 없음'은 개발자 말입니다. 사용자에게 뜻하는 것은 하나뿐입니다 —
           이 곳은 지도에 안 뜬다. 아래 '좌표 채우기'가 채워줍니다. */
        /* 현지 이름은 **우리말 이름과 다를 때만** 답니다. 국내 장소는 둘이
           같아서 "삼고정문 / 식사 · 삼고정문"처럼 이름이 두 번 나왔습니다. */
        const loc = c.title_local && c.title_local !== c.title ? c.title_local : null;
        const sub = [c.category, loc].filter(Boolean);
        /* 앱이 찾아준 자리. 없으면 그 줄만 안 나옵니다(b725 — 위 머리말). */
        const 것 = 자리[c.id];
        const f = 것?.f;
        return `<div class="cdc">
          <div class="t"><b>${esc(c.title)}</b>${
            c.lat == null ? ' <span class="val">지도에 아직 안 떠요</span>' : ''}</div>
          ${sub.length ? `<div class="s">${sub.map(esc).join(' · ')}</div>` : ''}
          ${c.memo ? `<div class="m">${esc(c.memo)}</div>` : ''}
          ${f ? `<div class="fit">
            <div class="p">
              <div class="c"><b>${esc(dayLabel(f.date, trip))} · ${hhmm(f.at)}쯤</b></div>
              <div class="c">${esc(f.after)}에서 ${f.go}분 · 머물 수 있는 시간
                <b>${f.avail}분</b> · 다음까지 ${f.back}분${
                f.tight ? ' · 짧게 보고 나와야 해요' : ''}</div>
            </div>
            <button class="small" data-fit="${것.i}">이 자리에 넣기</button>
          </div>` : ''}
          <div class="a">
            <button class="ghost" data-candplan="${esc(c.id)}"
                    style="color:var(--primary)">일정에 넣기</button>
            <a href="${esc(ml.see)}" target="_blank" rel="noopener">지도</a>
            <button class="ghost" data-canddel="${esc(c.id)}"
                    style="color:var(--bad); margin-left:auto">삭제</button>
          </div>
        </div>`;
      }).join('')
    /* 적는 자리가 바로 아래 보입니다 — 단추는 안 답니다. */
    : emptyDo('아직 일정 후보가 없어요.', null, null,
              'AI 제안에서 담거나 아래에 적어보세요.');
  drawGeoBtn();
}

/* ── 좌표 채우기 ─────────────────────────────────────────────────────
 * 좌표가 없으면 빈 시간 계산과 이동 어림에서 그 줄이 통째로 빠집니다.
 * 도쿄 앱처럼 OpenStreetMap 을 씁니다 — 키도 한도도 없고 AI 횟수도 안 씁니다.
 * 다만 초당 한 번이 그쪽 규칙이라 사이를 띄우고, 실패하면 더 두드리지 않습니다. */
let geoBusy = false;

/* 일정 제목은 장소 이름이 아닌 게 많습니다.
 * "호텔 ➡️ 콜로세움 이동"은 두 지점이고 "트라스테베레 산책 & 저녁"은 할 일입니다.
 * 찾을 만한 이름을 뽑아 넓혀가며 시도합니다.
 * 이동 줄은 도착지를 씁니다 — 그 일정이 끝났을 때 서 있는 자리가 도착지입니다. */
function geoQueries(title){
  const t = String(title || '').replace(/[➡→⇒]️?|->/g, '>').replace(/\s+/g, ' ').trim();
  const out = [];
  const add = s => { s = String(s || '').replace(/\s+/g, ' ').trim();
                     if (s && !out.includes(s)) out.push(s); };
  const main = t.includes('>') ? t.split('>').pop() : t;
  add(main.replace(/\s*이동\s*$/, ''));
  if (!t.includes('>')) add(t);
  const base = main.split(/[&/·,]/)[0]
    .replace(/(쇼핑|점심|저녁|아침|브런치|산책|구경|관람|투어|체험|픽업|이동|출발|도착|입국|출국|체크인|체크아웃)/g, ' ');
  add(base);
  add(base.trim().split(' ')[0]);
  return out.slice(0, 3);
}

/* 이 여행의 기준점. 이미 좌표가 있는 일정들의 한가운데를 씁니다 — 구간 도시의
   좌표를 못 가져오는 여행(직접 쳐서 만든 구간)에서도 이건 늘 있습니다.
   하나도 없으면 `null` 을 주고, 그때는 거리 검사를 안 합니다 —
   **기준이 없을 때 함부로 버리면 멀쩡한 것까지 못 찾게 됩니다.** */
function 여행중심(){
  const pts = (plans || []).filter(p => p.lat != null && p.lng != null);
  if (!pts.length) return null;
  return [pts.reduce((s, p) => s + p.lat, 0) / pts.length,
          pts.reduce((s, p) => s + p.lng, 0) / pts.length];
}

/* ── 좌표를 찾을 때의 기준점(b730) ────────────────────────────────────
 * ⚠⚠ **「그날 있는 도시」가 먼저입니다.** 전에는 `여행중심()` — 이미 찍힌
 *   일정들의 «평균» — 만 썼습니다. 그런데 그중 하나가 틀리면 **기준이
 *   그쪽으로 끌려가고 그 다음 것이 더 크게 틀립니다.** 틀린 점이 기준을
 *   만드는 구조라, 한 번 새면 계속 샙니다.
 * ⚠ 도쿄→교토처럼 구간이 둘인 여행에서는 평균이 **둘 사이 어딘가**를
 *   가리킵니다. 그러면 반경 창이 사실상 두 배가 되어 아무거나 통과합니다.
 * ⚠ 구간에 도시 중심이 없으면(직접 적은 목적지) 옛 방식으로 떨어집니다.
 *   그때도 나라(`countrycodes`)는 걸려 있습니다. */
export function 여행기준(date){
  const l = legOf(date);
  if (l && l.center_lat != null && l.center_lng != null)
    return [Number(l.center_lat), Number(l.center_lng)];
  return 여행중심();
}

/* ── 이름으로 좌표 찾기 ───────────────────────────────────────────────
 * ⚠ **첫 결과를 그냥 받으면 안 됩니다 (b388).** 전에는 `limit=1` 로 물어보고
 *   나온 것을 그대로 썼습니다. 실사용 점검에서 「기온 거리」(교토)에
 *   **오사카 북부 좌표**가 붙었습니다 — 실제와 41.2km 차이인데 화면에는
 *   아무 표시도 없었습니다. 지도 핀도 이동 시간도 거짓말이 됐습니다.
 *   **못 찾는 것보다 틀린 것이 나쁩니다.** 못 찾으면 사용자가 고칠 수 있지만,
 *   틀린 좌표는 맞는 줄 알고 지나갑니다.
 *
 * 셋을 바꿉니다.
 *   1. **나라로 묶습니다**(`countrycodes`). 도시는 틀릴 수 있어도(교토 당일치기)
 *      나라는 늘 맞습니다.
 *   2. **여러 개를 받아 `importance` 가 제일 높은 것**을 고릅니다. 이름난 곳이
 *      동명의 골목보다 위로 올라옵니다 — 교토 기온 vs 오사카의 같은 이름.
 *   3. **너무 멀면 버립니다**(`near` 에서 `maxKm`). 당일치기는 허용해야 하므로
 *      넉넉히 잡되, 다른 나라급으로 튄 것은 못 찾은 것으로 칩니다.
 *
 * 돌려주는 값: `{lat,lng}` · `null`(못 찾음) · `'stop'`(그쪽에서 그만하라 함). */
export async function osmLookup(q, opts = {}){
  /* ⚠⚠ **반경을 300 → 120km 로 좁혔습니다(b730).** ⚠⚠
   *   외부 QA(2026-09-09)에서 도쿄 일정 하나가 **273.7km** 떨어진 좌표를
   *   달고 「888분 이동」으로 그려졌습니다. 300km 창을 그대로 통과한
   *   것입니다. b388 에 41km 짜리 사고를 겪고 만든 창인데 너무 넓었습니다.
   * ⚠ 120km 는 **하루 안에 다녀올 수 있는 거리**로 잡았습니다 —
   *   도쿄→닛코 125 · 도쿄→하코네 80 · 오사카→교토 43. 그보다 먼 곳은
   *   그 날짜의 «구간»이 따로 있어야 맞습니다.
   * ⚠ **못 찾는 것이 틀린 것보다 낫습니다**(아래 머리말). 창 밖이면
   *   `null` 을 주고, 화면은 「못 찾았어요」라고 말합니다 — 사용자가
   *   고칠 수 있습니다. 틀린 좌표는 맞는 줄 알고 지나갑니다. */
  const { country, near, maxKm = 120 } = opts;
  const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8'
          + (country ? '&countrycodes=' + encodeURIComponent(String(country).toLowerCase()) : '')
          + '&q=' + encodeURIComponent(q);
  try {
    const r = await fetch(u, { headers: { 'Accept-Language': 'ko,en' } });
    if (!r.ok) return r.status === 429 ? 'stop' : null;
    const a = await r.json();
    if (!Array.isArray(a) || !a.length) return null;

    const 성한것 = a.map(x => ({ lat:Number(x.lat), lng:Number(x.lon),
                                 imp:Number(x.importance) || 0 }))
                    .filter(x => Math.abs(x.lat) <= 90 && Math.abs(x.lng) <= 180);
    if (!성한것.length) return null;

    /* 기준점이 있으면 너무 먼 것을 먼저 걷어냅니다. 다 걷히면 못 찾은 것입니다 —
       **남은 것 중 아무거나 주지 않습니다.** 그게 41km 짜리 사고의 원인이었습니다. */
    const 쓸것 = near
      ? 성한것.filter(x => distKm(near[0], near[1], x.lat, x.lng) <= maxKm)
      : 성한것;
    if (!쓸것.length) return null;

    /* 중요도로 고릅니다. 같으면 가까운 쪽입니다. */
    쓸것.sort((x, y) => (y.imp - x.imp)
      || (near ? distKm(near[0], near[1], x.lat, x.lng) - distKm(near[0], near[1], y.lat, y.lng) : 0));
    const { lat, lng } = 쓸것[0];
    return { lat, lng };
  } catch { return null; }
}

/* 좌표가 없는 것들. 일정과 후보를 한 목록으로 다룹니다 —
   버튼을 따로 두면 두 번 눌러야 하고 어느 쪽이 남았는지도 헷갈립니다. */
const needCoord = () => [
  /* ⚠ `memo` 도 같이 보냅니다(b564) — 거기 주소가 들어 있습니다. */
  ...(plans || []).filter(p => p.lat == null)
    .map(p => ({ kind:'plans', id:p.id, title:p.title, date:p.date, memo:p.memo })),
  ...(cands || []).filter(c => c.lat == null)
    .map(c => ({ kind:'candidates', id:c.id, title:c.title })),
];

/* ⚠ **입구가 둘입니다**(b375). 후보 카드의 `#geobtn` 과 일정 카드의
   `#geoplans`. 전에는 후보 쪽 하나뿐이었는데, 좌표가 없어 생기는 일(지도에
   안 뜸 · 이동 시간 못 잼 · 빈 시간에서 빠짐)은 **일정 화면에 나타납니다.**
   후보가 하나도 없으면 그 화면을 열 이유가 없으니 고치는 길이 있는 줄도
   몰랐습니다.
   **진행 표시를 둘 다에 씁니다.** 숨은 단추에만 쓰면 누른 사람은 몇 초 동안
   아무 반응도 못 봅니다(한 곳당 1.1초씩 걸립니다). */
export function drawGeoBtn(){
  const list = needCoord();
  const np = list.filter(x => x.kind === 'plans').length;
  const b = $('geobtn');
  if (b){
    b.classList.toggle('hide', !list.length && !geoBusy);
    /* 일정 몇 곳인지 같이 적습니다. 후보가 비어 있으면 왜 뜨는지 모릅니다. */
    b.textContent = geoBusy ? '중단하기'
      : `좌표 채우기 · ${list.length}곳` + (np ? ` (일정 ${np}곳 포함)` : '');
  }
  /* ⚠ 여기 일정 화면에 띠(`#geoplans`)를 띄웠다가 **b376 에서 걷었습니다.**
     `일정 2곳이 지도에 안 떠요` 를 화면 폭만큼 크게 띄웠는데, 눌러서 못
     찾으면(이름이 장소 이름이 아니면 흔합니다) **그 뒤로 영영 안 사라집니다.**
     고칠 수 없는 것을 계속 재촉하는 띠가 됩니다 — cards.js 에 적어둔
     "늘 켜져 있는 경고는 경고가 아니라 배경입니다" 를 그대로 어겼습니다.
     지금은 **그 줄에 작게** 답니다(planview.js). 사실을 알리되 재촉하지
     않고, 누르면 그 한 곳만 찾아봅니다. */
}

/* ── 붙여넣은 «주소»를 OSM 이 알아듣는 꼴로(b564) ─────────────────────
 * ⚠⚠ **구글에서 복사한 일본 주소는 그대로는 한 곳도 안 찾힙니다.** ⚠⚠
 *   실측(Nominatim, 200 OK 에 빈 배열):
 *     「일본 〒104-0061 Tokyo, Chuo City, Ginza, 6 Chome−4−16 …」  0건
 *     「東京都中央区銀座6-4-16」(일본어)                            0건
 *     「Ginza, 6 Chome-4-16, Chuo City, Tokyo」                     0건
 *   그런데 **꼴만 바꾸면 찾힙니다**:
 *     「6-4-16 Ginza, Chuo, Tokyo, Japan」  → 긴자6초메 35.66926, 139.76443
 *   막힌 것도, 한도에 걸린 것도 아닙니다. OSM 은 일본 주소를
 *   **「번지 동네, 구, 도, Japan」** 꼴로만 알아듣습니다.
 *
 * 그래서 세 가지를 차례로 물어봅니다 — 앞엣것이 더 정확합니다.
 *   ① 번지 + 동네 + 구 + 도        (블록 단위 · 제일 정확)
 *   ② 동네 + 구 + 도               (동네 단위)
 *   ③ 우편번호                     (우편구역 가운데)
 *
 * ⚠ **「Bldg」가 붙은 조각은 건물이지 동네가 아닙니다.** 이걸로 갈랐습니다 —
 *   「6 Chome-4-16 Hanatsubaki Bldg」 의 남은 글자를 동네로 쓰면
 *   「Hanatsubaki」 를 찾게 되고 그런 동네는 없습니다. 그때는 **한 칸 앞**
 *   조각이 동네입니다(Ginza). 반대로 「1 Chome-2-6 Nihonbashiningyocho」
 *   처럼 건물 표시가 없으면 남은 글자가 곧 동네입니다.
 * ⚠ 「−」(빼기 기호 U+2212)와 전각 숫자를 먼저 폅니다 — 구글이 그렇게
 *   복사해 줍니다. 눈으로는 붙임표와 구별이 안 갑니다.
 * ⚠ 이 함수는 **질의만 만듭니다.** 고르는 것은 osmLookup 이 합니다
 *   (나라·기준점으로 걸러내는 규칙이 거기 있습니다). */
export function addressQueries(text){
  let t = String(text || '').replace(/[−–—－]/g, '-')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  const 우편 = (t.match(/\b\d{3}-\d{4}\b/) || [])[0] || null;
  t = t.replace(/〒/g, '').replace(/\b\d{3}-\d{4}\b/g, ' ')
       .replace(/일본/g, ' ').replace(/\bJapan\b/gi, ' ');
  const 조각 = t.split(',').map(x => x.trim()).filter(Boolean);
  const 번지꼴 = p => p.match(/(\d+)\s*Chome[-\s]*(\d+)[-\s]*(\d+)/i)
                   || p.match(/\b(\d+)-(\d+)-(\d+)\b/);
  const 건물꼴 = /\b(Bldg|Building|Tower|Annex)\b|ビル|\d+\s*階|\b\d+\s*F\b/i;
  let 번지 = null, 동네 = null, 구 = null, 도 = null, 번지칸 = -1;
  조각.forEach((p, i) => {
    const m = 번지꼴(p);
    if (m && !번지){
      번지 = `${m[1]}-${m[2]}-${m[3]}`; 번지칸 = i;
      const 남 = p.replace(m[0], '').trim().replace(/^[-,\s]+|[-,\s]+$/g, '');
      if (남 && /^[A-Za-z]/.test(남) && !건물꼴.test(남)) 동네 = 남;
      return;
    }
    if (/\bCity\b|区$|-ku$/i.test(p)){ 구 = p.replace(/\s*City\b/i, '').trim(); return; }
    if (!도 && /^(Tokyo|Osaka|Kyoto|Fukuoka|Sapporo|Nagoya|Yokohama|Kobe)\b/i.test(p))
      도 = p.trim();
  });
  if (!동네 && 번지칸 > 0){
    const 앞 = 조각[번지칸 - 1].trim();
    if (/^[A-Za-z]/.test(앞) && 앞 !== 구 && 앞 !== 도 && !번지꼴(앞) && !건물꼴.test(앞))
      동네 = 앞;
  }
  if (!동네){
    const 후보 = 조각.filter(p => /^[A-Za-z]/.test(p) && p !== 구 && p !== 도
                                  && !번지꼴(p) && !건물꼴.test(p));
    동네 = 후보[후보.length - 1] || null;
  }
  /* ⚠ **주소처럼 안 생겼으면 아무것도 안 묻습니다(b564).** 메모가 「Age」
     한 마디면 「Age, Japan」 같은 질의가 만들어지는데, 그건 찾는 것이
     아니라 «아무거나 걸리기를 바라는» 것입니다. 우편번호도 번지도 없고
     쉼표로 나뉜 조각도 둘이 안 되면 주소가 아닙니다.
     ⚠ 못 찾는 것은 괜찮습니다. **엉뚱한 데 찍히는 것이 나쁩니다** —
       41km 떨어진 데를 잡았던 b388 이 그 값을 치른 자리입니다. */
  if (!우편 && !번지 && 조각.length < 2) return [];
  const q = [];
  if (번지 && 동네) q.push([`${번지} ${동네}`, 구, 도, 'Japan'].filter(Boolean).join(', '));
  if (동네)         q.push([동네, 구, 도, 'Japan'].filter(Boolean).join(', '));
  if (우편)         q.push(`${우편} Japan`);
  return q;
}

/* ── 한 곳만 찾기 ────────────────────────────────────────────────────
 * 일정 줄의 '지도에 안 떠요' 를 누르면 **그 한 곳만** 찾습니다(b376).
 * 일괄 채우기와 같은 식을 써야 결과가 갈리지 않으므로 여기 한 곳에 둡니다.
 * 돌려주는 값: true = 채움, false = 못 찾음. */
async function geoOne(it){
  /* ⚠ **도시 이름을 글자로 붙이지 않습니다 (b388).** 전에는 `"기온 거리 오사카"`
     처럼 도시를 검색어에 우겨넣었습니다. 같은 이름이 여러 나라에 있을 때
     엉뚱한 데로 가는 것을 막으려던 것인데, **당일치기를 못 견뎠습니다** —
     교토 기온을 오사카에서 찾으니 41km 떨어진 다른 곳이 잡혔습니다.
     이제 나라(`countrycodes`)로 묶고 여행지를 기준점으로만 씁니다. */
  const leg = legOf(it.date) || (legs || [])[0];
  const country = leg?.country || trip?.country || '';
  const 기준 = 여행기준(it.date);
  const city = leg?.destination || trip?.destination || '';

  let hit = null;
  /* ⚠⚠ **메모에 든 주소를 «먼저» 씁니다(b564).** ⚠⚠ 전에는 «제목»으로만
     찾았습니다 — 「스시야」·「아카리조명」 같은 우리말 이름은 OSM 에
     없으므로 영영 못 찾습니다. 그런데 주소는 **메모에 이미 적혀
     있었습니다.** 있는 것을 안 쓰고 없는 것을 찾고 있었던 셈입니다.
     실측: 「스시야」로는 0건, 메모의 주소를 다듬으니 긴자6초메로 잡힙니다. */
  for (const q of addressQueries(it.memo || '')){
    hit = await osmLookup(q, { country, near: 기준 });
    if (hit === 'stop') return 'stop';
    if (hit) break;
    await new Promise(r => setTimeout(r, 1100));
  }
  if (hit) return await 저장(it, hit);
  for (const q of geoQueries(it.title)){
    /* 이름만으로 먼저 찾고, 못 찾으면 도시를 덧붙여 한 번 더 봅니다.
       「구로몬 시장」처럼 흔한 이름은 도시가 있어야 잡힙니다. */
    hit = await osmLookup(q, { country, near: 기준 });
    if (hit === 'stop') return 'stop';
    if (!hit && city && !q.includes(city)){
      await new Promise(r => setTimeout(r, 1100));
      hit = await osmLookup(`${q} ${city}`, { country, near: 기준 });
      if (hit === 'stop') return 'stop';
    }
    if (hit) break;
    await new Promise(r => setTimeout(r, 1100));   /* 초당 한 번이 그쪽 규칙입니다 */
  }
  if (!hit) return false;
  return await 저장(it, hit);
}

/* 찾은 좌표를 넣습니다. **두 갈래(주소·제목)가 같은 길로 저장해야** 결과가
   갈리지 않습니다 — 한쪽만 고치는 일이 없게 여기 하나로 둡니다(b564). */
async function 저장(it, hit){
  const r = await sb.from(it.kind).update({ lat: hit.lat, lng: hit.lng })
    .eq('id', it.id).select('id');
  return !r.error && !!r.data?.length;
}

/* 일정 한 줄에서 부릅니다. 찾으면 일정을 다시 받아 화면이 저절로 고쳐집니다.
 * ⚠⚠ **`memo` 를 반드시 같이 넘기십시오(b571).** ⚠⚠
 *   b564 에서 「주소는 메모에 이미 적혀 있다」를 알아내고 `geoOne` 이 메모를
 *   먼저 보게 고쳤는데, **일괄(`needCoord`) 쪽만 고치고 여기를 빠뜨렸습니다.**
 *   그래서 한 줄짜리 「위치 찾기」는 여전히 **제목으로만** 찾았고,
 *   「스시야」 같은 우리말 이름은 OSM 에 없으니 영영 못 찾았습니다
 *   (사용자 지적: 「이거 아직도 주소 못찾는다」 — 메모에 주소가 그대로 있는 채로).
 *   실측: 그 메모로 만든 질의 `6-4-16 Ginza, Chuo, Tokyo, Japan` 은
 *   35.669261 / 139.764429 로 **한 번에 잡힙니다.** 안 넘겼을 뿐이었습니다.
 *   ⚠ 입구가 둘인 기능은 **둘 다 고쳤는지** 확인하십시오. 이 파일 위쪽
 *     `drawGeoBtn` 주석에도 「입구가 둘입니다」라고 적혀 있습니다. */
export async function fillOnePlan(id, title, date, memo){
  const ok = await geoOne({ kind:'plans', id, title, date, memo });
  if (ok === true) await ctx.loadPlans();
  return ok;
}

/* ── 일정 좌표 채우기(b835) ── 표 불러오기와 같은 길(sheetimp.js 의 `좌표찾기`)입니다.
 * ① AI 가 줄마다 «실제로 어디인지»의 현지 이름을 짓고(「오이타 공항」 → 「大分空港」),
 * ② 그날 지역 기준점 가까이에서 지도 자료(OSM)로 찾고, ③ 못 찾은 곳(대개 숙소)은 주소로 국토지리원·OSM.
 * **AI 는 좌표를 짓지 않습니다** — 좌표는 늘 지도 자료에서 옵니다.
 * 사용자(10-08): 「AI 성능이 너무 떨어져」 — 앱 AI 가 「좌표를 채울 수 없어요」라고만 했습니다. 이 단추(아래 fillCoords)는
 *   한국어 제목을 그대로 OSM 에 물어 거의 못 찾았고, AI 대화에는 좌표를 채우는 동작이 아예 없었습니다.
 *   이제 둘 다 이 함수를 씁니다(aiui.js 의 「좌표 채우기」 신호).
 * ⚠ 열려 있는 여행(trip.js 의 trip · plans · legs)만 다룹니다.
 * 돌려주는 값: 좌표찾기 그대로 + { 없음: true }(좌표 빠진 일정이 없을 때). */
export async function 일정좌표채우기(진행 = () => {}, 그만 = () => false){
  const list = (plans || []).filter(p => p.lat == null || p.lng == null)
    .map(p => ({ id: p.id, date: p.date, title: p.title, memo: p.memo, move_note: p.move_note, area: '' }));
  if (!trip || !list.length) return { 찍음: 0, 못찾음: [], 장소아님: 0, 없음: true };
  /* 쓸 때 불러옵니다 — sheetimp.js 가 이 파일을 불러서, 위에서 불러오면 서로 물립니다. */
  const { 좌표찾기 } = await import('./sheetimp.js?v=b836');
  const r = await 좌표찾기(list, 진행, 그만);
  await ctx.loadPlans();
  return r;
}

async function fillCoords(){
  if (geoBusy){ geoBusy = false; return; }
  const list = needCoord();
  if (!list.length) return;
  geoBusy = true; drawGeoBtn();
  let done = 0, miss = 0;

  /* ① 일정은 먼저 AI 현지 이름 → 지도 자료로(위 `일정좌표채우기`, b835). */
  if (list.some(x => x.kind === 'plans')){
    const r = await 일정좌표채우기((단계, i, n) => {
      if (geoBusy) $('geobtn').textContent = 단계 === '이름' ? '이름 찾는 중…'
        : 단계 === '주소' ? '주소로 찾는 중…' : `채우는 중… ${i}/${n}`;
    }, () => !geoBusy);
    done += r.찍음 || 0;
  }

  /* ② 남은 것(못 찾은 일정 · 후보)은 예전 길로 — 메모의 주소 · 구글 지도 링크 · 제목을 봅니다. */
  const 남은 = geoBusy ? needCoord() : [];
  for (const it of 남은){
    if (!geoBusy) break;
    const ok = await geoOne(it);
    if (ok === 'stop'){ geoBusy = false; break; }
    if (ok) done++; else miss++;
    $('geobtn').textContent = `채우는 중… ${done + miss}/${list.length}`;
    await new Promise(r => setTimeout(r, 1100));
  }

  geoBusy = false;
  await ctx.loadPlans();
  await loadCands();
  /* loadPlans 가 일정을 다시 그리면서 띠도 새로 셉니다. 그래도 여기서 한 번
     더 부릅니다 — 후보만 채워진 경우에는 일정 쪽이 안 다시 그려집니다. */
  drawGeoBtn();
  /* ⚠ **막다른 안내였습니다 (b388).** 전에는 "이름을 장소 이름으로 고치면
     찾을 수 있어요" 라고만 했는데, 시킨 대로 「기요미즈데라」를
     「Kiyomizu-dera」(세계적 명소)로 고쳐도 여전히 못 찾았습니다.
     **되는 길을 알려줘야 안내입니다.** 지도 링크는 확실히 됩니다 —
     실측에서 오차 0.00km 였습니다. */
  if (miss) fail(`${done}곳을 채웠어요. ${miss}곳은 이름으로 못 찾았어요. ` +
                 `그 줄의 「수정」을 열고 메모 칸에 구글 지도 링크를 붙여넣으면 ` +
                 `바로 잡힙니다 — 이름을 바꾸는 것보다 이 쪽이 확실해요.`, 'cand');
}
$('geobtn').addEventListener('click', fillCoords, false);

async function loadCands(){
  if (!trip) return;
  const r = await netTimeout(sb.from('candidates')
    .select('id,title,title_local,category,memo,lat,lng')
    .eq('trip_id', trip.id).is('deleted_at', null).order('created_at'));
  if (r.error){
    if (isOffline(r.error)){ offNote('cands'); drawOffbar(); return; }
    return fail(r.error, 'cand'); }
  cands = r.data || [];
  drawCands();
}

/* ── 후보를 AI 에게 추천받기 ─────────────────────────────────────────
 * 그냥 "추천해줘"라고 물으면 이미 담아둔 곳을 또 말합니다.
 * 담긴 것과 일정에 넣은 것을 같이 적어 보내 겹치지 않게 합니다.
 *
 * 답은 AI 시트에서 받습니다. 여기서 따로 그리면 담기 카드와 되돌리기를
 * 두 벌로 만들게 되고, 언젠가 한쪽만 고칩니다. */
$('c_ai').addEventListener('click', async () => {
  if (!trip) return;
  const taken = [...cands.map(c => c.title),
                 ...plans.map(p => p.title)].filter(Boolean);
  /* 너무 길면 물음이 목록에 묻힙니다. 앞쪽 40개면 겹침을 막기에 충분합니다. */
  const list = [...new Set(taken)].slice(0, 40);

  const leg = legs.length ? legs[0] : null;
  const where = leg?.destination || trip.destination || '';
  const msg = `${where} 에서 가볼 만한 곳을 추천해줘.` +
    (list.length ? ` 다만 이미 담아뒀거나 일정에 넣은 곳은 빼줘: ${list.join(', ')}` : '');

  /* 후보 시트를 닫고 AI 시트를 엽니다. 둘이 겹쳐 있으면 답을 못 봅니다. */
  $('card-cand').classList.add('hide');
  syncSheets();
  ctx.openAi();
  /* ⚠ **고르개에 없으면 한 칸을 만들어 넣습니다(b759).** 그 칸은 이제
     «다가오는 여행»만 담습니다(plancheck.js 의 `loadAi`) — 지난 여행을
     열어 놓고 여기를 누르면 `value` 대입이 조용히 빈 값이 되어, 엉뚱하게
     「여행 선택」 상태의 대화가 열립니다. 지금 보고 있는 여행이 빠질 수는
     없으므로 여기서 채웁니다. */
  {
    const 칸 = $('ai_trip');
    if (칸 && !칸.querySelector(`option[value="${trip.id}"]`))
      칸.insertAdjacentHTML('beforeend',
        `<option value="${esc(trip.id)}">${esc(trip.title || '이 여행')}</option>`);
  }
  $('ai_trip').value = trip.id;
  await ctx.loadChats(trip.id);
  $('ai_msg').value = msg;
  $('ai_send').click();
});

/* ⚠ 여기 `scrollIntoView` 가 있었습니다(b366 에서 뗌). `card-cand` 도 `SHEETS`
   라 화면 바닥에 시트로 뜨는데, **그 변환이 한 박자 늦게 와서** 누르는 순간에는
   아직 문서 맨 아래의 보통 요소입니다. 그래서 열 때 화면이 밑으로 굴러갔고,
   닫으면 그 자리에 남아 "닫았더니 맨 밑" 이 됐습니다.
   끌어갈 필요가 없으니 아예 안 움직입니다 — 열기 전 자리에 그대로 있습니다. */
$('candbtn').addEventListener('click', async () => {
  $('card-cand').classList.remove('hide');
  await loadCands();
});
$('candclose').addEventListener('click', () => $('card-cand').classList.add('hide'));

$('c_add').addEventListener('click', async () => {
  const t = $('c_title').value.trim();
  if (!t) return;
  /* 좌표는 안 받습니다. AI 제안으로 담으면 좌표가 같이 옵니다.
     손으로 적은 것은 좌표가 없어 빈 시간 계산에서는 빠집니다. */
  const r = await sb.from('candidates')
    .insert({ trip_id: trip.id, title: t, source: 'manual' }).select('id');
  if (r.error) return fail(r.error, 'cand');
  if (!r.data?.length) return fail(NOROW.save, 'cand');
  $('c_title').value = '';
  await loadCands();
});
$('c_title').addEventListener('keydown', e => { if (e.key === 'Enter') $('c_add').click(); });

$('card-cand').addEventListener('click', async e => {
  const f = e.target.closest('[data-fit]');
  if (f){
    /* 제안한 자리 그대로 일정 칸을 채워 엽니다. 날짜와 시각까지 미리 넣습니다. */
    const x = fitList[+f.dataset.fit]; if (!x) return;
    /* 후보의 좌표도 같이 넘깁니다. 예전에는 폼을 거치면서 사라져서,
       빈 시간을 좌표로 계산해 놓고 정작 넣은 일정에는 좌표가 없었습니다. */
    openPlanForm({
      title: x.cand.title, category: x.cand.category, memo: x.cand.memo,
      date: x.date, start_time: hhmm(x.at),
      end_time: hhmm(x.at + Math.min(x.avail, stayMin(x.cand.category))),
      lat: x.cand.lat, lng: x.cand.lng,
    });
    $('card-cand').classList.add('hide');
    return;
  }
  /* 후보를 일정으로. 빈 시간 제안을 안 거치고 바로 넣고 싶을 때 씁니다. */
  const cp = e.target.closest('[data-candplan]');
  if (cp){
    const c = cands.find(x => x.id === cp.dataset.candplan); if (!c) return;
    openPlanForm({ title: c.title, category: c.category, memo: c.memo,
                   lat: c.lat, lng: c.lng });
    $('card-cand').classList.add('hide');
    return;
  }

  const d = e.target.closest('[data-canddel]');
  if (d){
    const r = await sb.from('candidates')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', d.dataset.canddel).select('id');
    if (r.error) return fail(r.error, 'cand');
    if (!r.data?.length) return fail(NOROW.del, 'cand');
    await loadCands();
  }
});

