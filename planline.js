/* ── 일정 줄 그리기 부품 ──────────────────────────────────────────────
 * 일정 한 줄을 어떻게 보여줄지 정하는 것들입니다. 화면을 통째로 그리는
 * `drawPlans` 는 app.js 에 남아 있고, 여기는 **그 줄에 들어가는 조각**입니다.
 *
 *   `drawCats`    분류 칩 줄(식사·카페·관광…). 12곳이 부릅니다.
 *   `parseMemo`   메모 한 덩어리를 읽히는 조각으로 자릅니다.
 *   `nice`        화살표를 ` → ` 로 고르고 겹친 공백을 줄입니다.
 *   `lineChips`   한 줄 요약에 붙는 작은 표시들.
 *   `dayStat`     하루에 몇 곳인지.
 *
 * ── app.js 에서 떼어낸 스물아홉 번째 조각입니다(b353) ────────────────
 * **b345 에 일부러 두고 갔던 것들입니다.** 그때는 '추천 검사' 머리말이
 * 이것들까지 덮고 있어서, 자체 점검만 떼고 여기는 남겼습니다 — 일정 화면
 * 것이라 아직 자리가 아니었습니다. 탭·목록·초안이 나간 지금은 뗄 만합니다.
 *
 * app.js 만 아는 것은 둘 — 날짜 줄 다시 그리기, 일정 다시 그리기.
 * `catsOpen`(분류 칩을 폈나)은 이 부품이 읽는 값이라 같이 왔습니다.
 * 누르는 손잡이는 app.js 의 날짜 줄에 있어 `setCatsOpen` 으로 넣습니다.
 *
 * 층: dom.js · calc.js · trip.js 와 이미 떼어낸 planmap.js 를 씁니다. */
import { $, esc } from './dom.js?v=b837';
import { hop } from './calc.js?v=b837';
import { plans, legs, transitLines, catFilter, setCatFilter } from './trip.js?v=b837';
import { drawPlanMap, splitParts } from './planmap.js?v=b837';

let ctx = { drawDays: () => {}, drawPlans: () => {} };
export function setPlanLineCtx(o){ ctx = { ...ctx, ...o }; }

/* 분류 칩 줄을 폈는지. 거르는 중이면 강제로 펴 둡니다 — 접힌 채로 걸러지면
   왜 목록이 짧은지 알 길이 없습니다.
   **app.js 에 있던 것을 여기로 옮겼습니다(b353)** — 읽는 곳이 아래
   `drawCats` 뿐입니다. 누르는 손잡이는 저쪽에 남아 설정자로 넣습니다. */
export let catsOpen = false;
export function setCatsOpen(v){ catsOpen = !!v; }

/* ── 일정 지도 · 지도 링크 ────────────────────────────────────────────
 * 지도(Leaflet)·메모 쪼개기·지도 링크는 planmap.js 로 옮겼습니다
 * (b338, 열한 번째 조각). **딸린 것이 없어 ctx 가 없습니다.**
 * 여기서는 맨 위에서 넷을 가져다 쓰기만 합니다. */

/* 지도 주소는 **틀려도 화면에서는 멀쩡해 보입니다** — 눌러서 딴 데가 나와야
   압니다. 그래서 눌러보지 않고도 알 수 있게 검사를 답니다. */
/* 자체 점검 셋(__designCheck · __recCheck · __mapCheck)은 selfcheck.js 로
   옮겼습니다(b345, 스무 번째 조각). 딸린 것이 0 이라 ctx 가 없습니다.
   아래 일정 줄 그리기 부품(parseMemo · nice · lineChips · drawCats ·
   dayStat)은 일정 화면 것이라 여기 남깁니다 — 위 머리말이 그것들까지
   덮고 있었을 뿐입니다. */
export function parseMemo(memo){
  const out = { move:'', cost:'', notes:[] };
  if (!memo) return out;
  for (const part of splitParts(memo)){
    /* 앞에 붙은 이모지와 기호를 걷어냅니다. */
    const s = part.replace(/^[^가-힣A-Za-z0-9([]+/, '').trim();
    if (!s) continue;
    const m = s.match(/^([^:：]{1,16})\s*[:：]\s*([\s\S]+)$/);
    if (m){
      const k = m[1].replace(/\s/g, '');
      if (/이동|가는법/.test(k) && !/비|요금|가격/.test(k)){
        out.move = out.move ? out.move + ' · ' + m[2] : m[2]; continue;
      }
      if (/가격|비용|요금|교통비|입장료|점심|디저트|간식|커피|음료/.test(k)){
        out.cost = out.cost ? out.cost + ' · ' + m[2] : m[2]; continue;
      }
    }
    out.notes.push(s);
  }
  return out;
}
/* 화살표 이모지를 글자로 바꿉니다. 줄 안에서 크기가 들쭉날쭉해 보입니다. */
export const nice = s => String(s ?? '').replace(/\s*[➡→⇒]️?\s*/g, ' → ').replace(/\s{2,}/g, ' ').trim();

/* 노선 딱지. 색은 transit_lines 에서 옵니다 — 도쿄 역 안내판과 같은 색입니다. */
export function lineChips(text){
  const t = String(text || '');
  let hit = (transitLines || []).filter(L => t.includes(L.name));
  /* "세이부 신주쿠선"이 걸리면 "신주쿠선"은 버립니다 — 같은 노선을 두 번 세는 것입니다. */
  hit = hit.filter(L => !hit.some(O => O !== L && O.name.includes(L.name)));
  return hit.slice(0, 3).map(L =>
    `<span class="ln" style="background:${esc(L.color)}${
      L.dark_text ? '; color:#1c1c1e' : ''}">${esc(L.name)}</span>`).join('');
}

/* 분류 칩. 실제로 쓰인 분류만 내놓습니다 — 없는 칸을 눌러 빈 목록을 보게 할
   이유가 없습니다. */
export function drawCats(){
  const used = [...new Set(plans.map(p => p.category).filter(Boolean))];
  /* 날짜 칩 줄 끝의 '분류'로 폅니다. 거르는 중이면 접히지 않습니다. */
  $('cats').classList.toggle('hide', used.length < 2 || !(catsOpen || catFilter));
  /* 일정 카드는 분류마다 색점(kdot)이 찍히는데, 이 칩은 전부 같은 회색이라
     "관광 색이 뭐였지"를 다시 찾아야 했습니다. 카드에서 본 색이 칩에도
     그대로 있으면 눈으로 바로 짝지어집니다 — 카드와 같은 --kc 변수를 씁니다. */
  /* 위 날짜 칩과 마찬가지로 '전체' 대신 무엇의 전체인지 적습니다. */
  $('cats').innerHTML = [['모든 분류', ''], ...used.map(k => [k, k])].map(([label, v]) => {
    const dot = v ? `<i class="k-${esc(v)}"></i>` : '';
    return `<span class="day${catFilter === v ? ' on' : ''}" data-cat="${esc(v)}">${dot}${
      esc(label)}</span>`;
  }).join('');
}
$('cats').addEventListener('click', e => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  setCatFilter(b.dataset.cat);
  /* 날짜 줄 끝의 칩이 지금 거르는 분류를 적으므로 그쪽도 다시 그립니다.
     안 그리면 '식사'만 보는 중인데 칩에는 '분류'라고 적혀 있습니다. */
  ctx.drawDays(); drawCats(); ctx.drawPlans(); drawPlanMap();
});

/* 그날 몇 곳을 다니고 이동에 얼마나 쓰는지. 좌표가 있는 구간만 셉니다. */
export function dayStat(date){
  const list = plans.filter(p => p.date === date);
  let min = 0, km = 0;
  for (let i = 0; i < list.length - 1; i++){
    const h = hop(list[i], list[i+1], legs);
    if (h){ min += h.min; km += h.km; }
  }
  /* fmtM 은 시:분 표기라 걸리는 시간에는 안 맞습니다. "2시간 10분"으로 적습니다. */
  const dur = m => m >= 60 ? `${Math.floor(m/60)}시간${m % 60 ? ' ' + (m%60) + '분' : ''}`
                           : `${m}분`;
  /* 「N곳」에서 이동·숙소 줄은 뺍니다(b799, GPT 리포트) — 공항→호텔이나 체크인은 «곳»이 아닙니다.
     식사·카페는 실제로 들르는 곳이라 셉니다(plancheck 의 「너무 많아요」는 그것도 빼고 셉니다). */
  const 곳 = list.filter(p => p.category !== '이동' && p.category !== '숙소').length;
  return [ `${곳}곳`,
           min ? `이동 ${dur(min)}` : null,
           km  ? `${km.toFixed(1)}km` : null ].filter(Boolean).join(' · ');
}

