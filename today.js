/* ── 오늘 화면 · 날씨 ─────────────────────────────────────────────────
 * **여행 중일 때만** 일정 맨 위에 뜨는 카드입니다. 지금 몇 시고 다음이
 * 무엇인지, 오늘 날씨는 어떤지. 여행 전후로는 안 뜹니다 — 안 뜨는 것이
 * 이 카드의 절반입니다. 늘 떠 있으면 그냥 배경이 됩니다.
 *
 * 날씨는 **하루 한 번, 좌표로** 받습니다(Open-Meteo, 키가 없어도 됩니다).
 * `WMO` 는 세계기상기구 날씨 코드를 사람 말로 옮기는 표입니다.
 *
 * ── app.js 에서 떼어낸 서른네 번째 조각입니다(b358) ──────────────────
 * **딸린 것이 0 입니다.** app.js 만 아는 이름을 하나도 안 씁니다 —
 * prep · planmap · citysearch · selfcheck 에 이어 다섯 번째입니다.
 * 밖으로 나가는 길은 `drawToday` 하나입니다.
 *
 * 층: dom.js · calc.js · trip.js 와 이미 떼어낸 planline · planmap ·
 *     planview · plancheck · cands · legs · tripview 를 씁니다. */
import { $, esc } from './dom.js?v=b824';
import { D1, asDate, hm, hop, todayYmd, 같은곳, 붙은칸, 이동줄인가 } from './calc.js?v=b824';
import { trip, plans, legs, setPickedDay, setTodayOn } from './trip.js?v=b824';
import { drawCats } from './planline.js?v=b824';
import { drawPlanMap } from './planmap.js?v=b824';
import { drawPlans, openPlans } from './planview.js?v=b824';
import { STAY_MIN, mins } from './plancheck.js?v=b824';
import { hhmm } from './cands.js?v=b824';
import { legFor } from './legs.js?v=b824';
import { drawDays } from './tripview.js?v=b824';

/* ── 날씨 ───────────────────────────────────────────────────────────
 * open-meteo 는 키가 없어도 됩니다. 키를 받아 어딘가에 두는 순간
 * 그 키가 새는 걱정이 하나 늘어납니다.
 * 30분 담아둡니다 — 날씨는 그 사이에 안 바뀌고, 탭을 옮길 때마다 부르면 낭비입니다.
 * 못 받아오면 조용히 없는 대로 갑니다. 날씨 때문에 오늘 화면이 안 뜨면 안 됩니다. */
const WMO = [
  [[0], '맑음', '☀'], [[1,2], '구름 조금', '🌤'], [[3], '흐림', '☁'],
  [[45,48], '안개', '🌫'], [[51,53,55,56,57], '이슬비', '🌦'],
  [[61,63,65,66,67], '비', '🌧'], [[71,73,75,77], '눈', '🌨'],
  [[80,81,82], '소나기', '🌦'], [[85,86], '눈 소나기', '🌨'],
  [[95,96,99], '뇌우', '⛈'],
];
async function getWeather(lat, lng){
  if (lat == null || lng == null) return null;
  const key = `t2:wx:${lat.toFixed(2)},${lng.toFixed(2)}`;
  try {
    const old = JSON.parse(localStorage.getItem(key) || 'null');
    if (old && Date.now() - old.at < 1800_000) return old.v;
  } catch {}
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast' +
      `?latitude=${lat}&longitude=${lng}&current_weather=true`);
    if (!r.ok) return null;
    const w = (await r.json())?.current_weather;
    if (!w) return null;
    const hit = WMO.find(([codes]) => codes.includes(w.weathercode));
    const v = { c: Math.round(w.temperature), t: hit?.[1] || '', i: hit?.[2] || '' };
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), v })); } catch {}
    return v;
  } catch { return null; }
}

/* ── 오늘 화면 ──────────────────────────────────────────────────────
 * 여행 중에 앱을 여는 이유는 사실상 하나입니다: 지금 뭘 할 시간인가.
 * 그런데 지금까지는 전체 일정에서 오늘을 눈으로 찾아야 했습니다.
 *
 * 여행 기간 안일 때만 나옵니다. 여행 전이나 다녀온 뒤에는 쓸모가 없고,
 * 안 지우면 "오늘 일정 없음"이 계속 붙어 있어 자리만 먹습니다.
 *
 * 이동 안내는 **지금과 다음 구간에만** 답니다. 하루 전체에 다 달면 소음입니다. */
function todayDayNo(){
  const today = todayYmd();
  if (!trip || today < trip.start_date || today > trip.end_date) return null;
  return { date: today,
           n: Math.round((asDate(today) - asDate(trip.start_date)) / D1) + 1 };
}

export async function drawToday(){
  const box = $('card-today');
  const t = todayDayNo();
  if (!t){ setTodayOn(false); box.classList.add('hide'); box.innerHTML = ''; return; }

  const list = plans.filter(p => p.date === t.date);
  if (!list.length){ setTodayOn(false); box.classList.add('hide'); box.innerHTML = ''; return; }
  setTodayOn(true);

  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const hhmm = m => `${String(Math.floor(m / 60) % 24).padStart(2,'0')}:${
                     String(m % 60).padStart(2,'0')}`;

  /* 시각이 없는 일정은 순서를 못 매기니 아래에 따로 둡니다. */
  const timed = list.filter(p => p.start_time);
  const blank = list.filter(p => !p.start_time);

  let cur = -1;
  timed.forEach((p, i) => { if (mins(p.start_time) <= nowM) cur = i; });
  const next = cur + 1 < timed.length ? cur + 1 : -1;

  const leg = legFor(t.date);
  const wx = await getWeather(leg?.center_lat ?? trip.center_lat,
                             leg?.center_lng ?? trip.center_lng);

  /* 맨 위 한 줄: 다음 일정까지 얼마나 남았는지. 이게 제일 궁금한 것입니다. */
  let head = '';
  if (next >= 0){
    const d = mins(timed[next].start_time) - nowM;
    const when = d <= 0 ? '곧' : d < 60 ? `${d}분 후`
               : `${Math.floor(d / 60)}시간 ${d % 60}분 후`;
    head = `<div class="tdnext"><b>${esc(hm(timed[next].start_time))}
        ${esc(timed[next].title)}</b><span>${esc(when)}</span></div>`;
  } else if (cur >= 0){
    head = `<div class="tdnext"><b>오늘 일정은 여기까지예요</b></div>`;
  }

  const rows = timed.map((p, i) => {
    const done = i < cur, isCur = i === cur, isNext = i === next;
    const tag = isCur ? '지금' : isNext ? '다음' : '';
    let h = `<div class="tdrow${done ? ' is-done' : ''}${isCur ? ' is-cur' : ''}${
        isNext ? ' is-next' : ''}">
      <div class="tt">${esc(hm(p.start_time))}${
        tag ? `<span class="tg">${tag}</span>` : ''}</div>
      <span class="kdot ${p.category ? 'k-' + esc(p.category) : ''}"></span>
      <div class="tb">${esc(p.title)}</div></div>`;

    /* 지금·다음 구간에만. 시간이 모자라면 빨갛게 — 여기가 하루가 깨지는 자리입니다. */
    const nx = timed[i + 1];
    if (nx && (isCur || isNext)){
      const mv = hop(p, nx, legs);
      /* 같은 곳은 줄을 안 그리고, 딱 붙은 칸·이동 일정 앞은 경고만 안 합니다(b785) —
         일정 목록과 같은 규칙(calc.js 의 `붙은칸` 머리말). */
      if (mv && !같은곳(mv)){
        const end = p.end_time ? mins(p.end_time)
                  : mins(p.start_time) + (STAY_MIN[p.category] ?? 30);
        const gap = mins(nx.start_time) - end;
        /* 남은 시간이 음수면 "-20분밖에 없어요"가 됩니다. 말이 안 되는 문장입니다.
           앞 일정이 이미 다음 시작을 넘겼다는 뜻이니 그렇게 적습니다. */
        const tight = !붙은칸(p, nx) && !이동줄인가(nx) && gap < mv.min;
        const why = gap < 0 ? '앞 일정이 이미 넘겼어요'
                  : tight   ? `${gap}분밖에 없어요` : '';
        h += `<div class="tdmv${tight ? ' bad' : ''}">${mv.walk ? '도보' : '이동'}
          약 ${mv.min}분 · ${mv.km.toFixed(1)}km${why ? ' · ' + why : ''}</div>`;
      }
    }
    return h;
  }).join('');

  box.classList.remove('hide');
  box.innerHTML =
    `<div class="tdhead">
       <b>Day ${t.n}</b>
       <span>지금 ${hhmm(nowM)}</span>
       ${leg?.destination ? `<span>${esc(leg.destination)}</span>` : ''}
       ${wx ? `<span class="tdwx">${wx.i} ${wx.c}° ${esc(wx.t)}</span>` : ''}
     </div>
     ${head}
     <div class="tdlist">${rows}</div>
     ${blank.length ? `<div class="tdblank">시각 없는 일정 ${blank.length}개 ·
        ${esc(blank.map(p => p.title).slice(0, 3).join(' · '))}</div>` : ''}`;
}

/* 펼친 줄(openPlans)은 planview.js 로 갔습니다(b354) — 그리는 쪽이 거깁니다. */
$('plans').addEventListener('click', e => {
  if (e.target.closest('a, button')) return;      /* 링크와 버튼은 각자 일합니다 */
  /* 손잡이를 눌렀다 뗀 것은 '펼치기'가 아닙니다. 끌지 않고 톡 눌러도
     여기까지 오는데, 그러면 순서를 바꾸려다 줄이 펼쳐집니다. */
  if (e.target.closest('[data-grip]')) return;
  const row = e.target.closest('[data-ev]'); if (!row) return;
  const id = row.dataset.ev;
  if (openPlans.has(id)) openPlans.delete(id); else openPlans.add(id);
  row.classList.toggle('is-open');
});

$('days').addEventListener('click', e => {
  const b = e.target.closest('.day'); if (!b) return;
  setPickedDay(b.dataset.day || null);
  drawDays(); drawCats(); drawPlans(); drawPlanMap();
});

