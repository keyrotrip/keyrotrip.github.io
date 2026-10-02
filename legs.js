/* ── 구간 — 어느 날 어느 도시에 있나 ──────────────────────────────────
 * 여행 하나가 도시 하나인 경우는 드뭅니다. 로마 3박 · 피렌체 2박처럼
 * **날짜를 도시로 나눈 것**이 구간입니다.
 *
 * 구간이 있어야 되는 것들: 일정 줄에 도시 이름이 붙고, 이동 시간이
 * 계산되고(도시가 다르면 기차·비행기), 리포트가 "몇 곳" 을 셉니다.
 *
 * `legIn`(그날에 걸린 구간)과 `legFor`(없으면 가까운 것)를 나눠 둔 이유는
 * calc.js 의 `legAt`·`legNear` 머리말에 적혀 있습니다 — 폴백이 다릅니다.
 * 여기 있는 것은 `legs` 를 매개변수로 넘겨주는 한 줄 래퍼뿐입니다.
 *
 * 도시 고르개 채우기(`fillCityList`)도 여기 있습니다. 구간을 넣을 때
 * 도시를 골라야 하고, 그 고르개를 여섯 곳이 같이 씁니다.
 *
 * ── app.js 에서 떼어낸 서른두 번째 조각입니다(b356) ──────────────────
 * app.js 만 아는 것은 셋 — 날짜 줄 다시 그리기, 여행 머리말 다시 그리기,
 * 여행을 서버에서 다시 받기.
 *
 * 층: dom.js · db.js · net.js · calc.js · cities.js · trip.js 와 이미
 *     떼어낸 planline.js · planmap.js · planview.js · review.js 를 씁니다. */
import { $, esc } from './dom.js?v=b823';
import { sb } from './db.js?v=b823';
import { fail, netTimeout, drawOffbar, cacheGet, cacheSet, NOROW } from './net.js?v=b823';
import { dateRange, travel, legAt, legNear } from './calc.js?v=b823';
import { cities, countryName, cityCountry } from './cities.js?v=b823';
import { trip, legs, setLegs, transitLines, setTransitLines } from './trip.js?v=b823';
import { arm } from './ui.js?v=b823';
import { drawCats } from './planline.js?v=b823';
import { drawPlanMap } from './planmap.js?v=b823';
import { drawPlans } from './planview.js?v=b823';
import { loadReview } from './review.js?v=b823';

let ctx = { drawDays: () => {}, drawTripHeader: () => {}, fetchTrip: async () => {} };
export function setLegsCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 구간 ───────────────────────────────────────────────────────────
 * 여행 하나가 여러 도시·나라를 도는 경우입니다.
 * 일정과 지출은 날짜로 저절로 구간에 붙습니다 — 하나하나 고를 필요가 없습니다. */
export async function loadLegs(){
  const 그여행 = trip.id;          /* 늦은 답 막기(b799) — tripview.js 의 loadPlans 머리말 */
  const { data, error } = await netTimeout(sb.from('trip_legs')
    /* 도보 상수 둘을 빼먹어서 "도보 약 NaN분" 이 나왔습니다.
       travel() 이 쓰는 다섯 개를 다 가져와야 합니다. */
    /* ⚠ `center_lat/lng` 도 같이 받습니다(b730). **좌표를 찾을 때의
       «기준점»이 여기서 옵니다** — 전에는 「이미 찍힌 일정들의 평균」을
       기준으로 썼는데, 그중 하나가 틀리면 기준이 그쪽으로 끌려가고
       그 다음 것이 더 크게 틀립니다(cands.js 의 `여행기준` 주석). */
    .select('id,city_id,destination,country,start_date,end_date,timezone,currency,' +
            'center_lat,center_lng,' +
            'walk_max_km,walk_min_per_km,walk_base_min,transit_factor,transit_base_min')
    .eq('trip_id', 그여행).order('start_date'));
  if (trip?.id !== 그여행) return;
  /* 구간이 없으면 날짜 칩에 도시가 안 붙고 이동 시간도 못 잽니다. 캐시로 버팁니다. */
  const ck = 'legs:' + 그여행;
  if (error){
    const old = cacheGet(ck);
    if (!old) return fail(error, 'leg');
    setLegs(old); setTransitLines(cacheGet('lines:' + trip.id));
    drawOffbar(); ctx.drawDays(); return;
  }
  cacheSet(ck, data || []);
  setLegs(data);
  /* 노선 딱지 색. 그 여행에 나오는 도시 것만 받습니다. */
  const ids = [...new Set(legs.map(l => l.city_id).filter(Boolean))];
  if (ids.length){
    const r = await sb.from('transit_lines').select('name,color,dark_text').in('city_id', ids);
    /* 못 받아오면 지난번 것. 노선 딱지 색이라 없어도 죽지는 않지만,
       위 구간 캐시가 이걸 꺼내 쓰므로 저장은 해둬야 합니다. */
    setTransitLines(r.error ? cacheGet('lines:' + trip.id) : r.data);
    if (!r.error) cacheSet('lines:' + trip.id, transitLines);
  } else setTransitLines([]);
  drawLegs();
}

/* legIn/legFor 는 calc.js 로 옮겼습니다(legAt/legNear — 왜 폴백이 다른지는 거기 적어
   뒀습니다). legs 를 매개변수로 받게 바뀌어서 여기서는 한 줄 래퍼만 둡니다. */
export function legIn(date){ return legAt(legs, date); }
export function legFor(date){ return legNear(legs, date); }

function drawLegs(){
  /* 구간 날짜가 여행 날짜 밖에 있으면 날짜 칩에 도시가 안 붙습니다.
     **그걸 조용히 넘기면 "왜 Day 1 에 도시가 없지"가 됩니다.**
     실제로 구간이 9월 7~17일, 여행이 9월 29일~10월 9일인 자료가 있었고,
     그때는 11일 전부에 엉뚱한 도시가 붙어 있었습니다. 말해줍니다. */
  const off = legs.filter(l =>
    l.end_date < trip.start_date || l.start_date > trip.end_date);
  const warn = off.length
    ? `<div class="memo" style="color:var(--bad); margin-top:8px">
         ${esc(off.map(l => l.destination).join(' · '))} 구간이 여행 날짜
         (${esc(dateRange(trip.start_date, trip.end_date))}) 밖이에요.
         <button class="ghost" id="legfix"
                 style="color:var(--primary); padding:2px 6px">고치기</button></div>`
    : '';

  /* 헤더에는 둘 이상일 때만 보여줍니다. 하나면 위 줄이 이미 그 도시입니다. */
  $('t_legs').innerHTML = (legs.length > 1
    ? legs.map(l => `<span class="day" style="cursor:default">${esc(l.destination)}
        <span class="n">${esc(dateRange(l.start_date, l.end_date))}</span></span>`).join('')
    : '') + warn;
  if ($('legfix')) $('legfix').onclick = () => $('editbtn').click();

  $('legs').innerHTML = legs.map(l =>
    `<div class="row"><span class="label"><b>${esc(l.destination)}</b>
       <div class="memo">${esc(dateRange(l.start_date, l.end_date))} ·
         ${esc(l.currency)}</div></span>
     ${legs.length > 1
       ? `<button class="ghost" aria-label="지우기" data-lact="del" data-id="${esc(l.id)}"
                  style="color:var(--bad)">×</button>` : ''}</div>`).join('')
    || '<div class="empty">구간이 없어요.</div>';
}

/* 도시 목록은 native datalist 로 답니다. 폼이 여럿이라 직접 만든 검색을
   또 붙이면 코드가 두 벌이 됩니다. 모바일에서도 native 가 더 편합니다. */
export function fillCityList(){
  if (!cities) return;
  $('citylist').innerHTML = cities.map(c =>
    `<option value="${esc(c.name)}">${esc(cityCountry(c))}</option>`).join('');
  const opts = Object.entries(countryName)
    .sort((a,b) => a[1].localeCompare(b[1], 'ko'))
    .map(([code, nm]) => `<option value="${esc(code)}">${esc(nm)}</option>`).join('');
  $('g_country').innerHTML = opts;
}

/* 목록에 없는 도시를 치면 나라를 물어봅니다. */
$('g_dest').addEventListener('input', () => {
  const v = $('g_dest').value.trim();
  const hit = cities?.find(c => c.name === v);
  $('g_countrywrap').classList.toggle('hide', !v || !!hit);
});

$('g_add').addEventListener('click', async () => {
  $('legerr').classList.add('hide');
  const v = $('g_dest').value.trim();
  const s = $('g_start').value, e = $('g_end').value;
  if (!v)        return fail('도시를 적어주세요.', 'leg');
  if (!s || !e)  return fail('구간 날짜를 골라주세요.', 'leg');
  if (e < s)     return fail('끝나는 날이 시작보다 빨라요.', 'leg');

  const hit = cities?.find(c => c.name === v);
  const row = { trip_id: trip.id, destination: v, start_date: s, end_date: e };
  if (hit) row.city_id = hit.id;
  else     row.country = $('g_country').value;

  const btn = $('g_add');
  btn.disabled = true; btn.innerHTML = '<span class="load">넣는 중…</span>';
  const { data, error } = await sb.from('trip_legs').insert(row).select('id');
  btn.disabled = false; btn.textContent = '구간 넣기';
  if (error) return fail(error, 'leg');
  if (!data?.length) return fail(NOROW.save, 'leg');

  $('g_dest').value = ''; $('g_countrywrap').classList.add('hide');
  await loadLegs();
  await loadReview();
  await ctx.fetchTrip(trip.id); ctx.drawTripHeader();   /* 대표값이 바뀌었을 수 있습니다 */
  ctx.drawDays(); drawCats(); drawPlans(); drawPlanMap();
});

$('legs').addEventListener('click', async e => {
  const b = e.target.closest('button[data-lact]'); if (!b) return;
  if (b.dataset.armed !== '1'){
    arm(b, '정말 지울까요?'); return;
  }
  b.disabled = true;
  /* 구간은 진짜로 지웁니다. 일정과 지출은 날짜로 붙으므로 같이 사라지지 않습니다. */
  const r = await sb.from('trip_legs').delete().eq('id', b.dataset.id).select('id');
  b.disabled = false;
  if (r.error) return fail(r.error, 'leg');
  if (!r.data?.length) return fail(NOROW.edit, 'leg');
  await loadLegs();
  await loadReview();
  await ctx.fetchTrip(trip.id); ctx.drawTripHeader();
  ctx.drawDays(); drawCats(); drawPlans(); drawPlanMap();
});

