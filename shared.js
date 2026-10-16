/* ── 링크로 받은 일정 보기 (b880, 2·3단계) ────────────────────────────
 * `?plan=<토큰>` 으로 들어온 사람에게 보여주는 **보기 전용** 화면입니다.
 *
 * ⚠⚠ **로그인 없이 열립니다.** 그것이 이 기능의 전부입니다 — 부모님께,
 *   친구에게 일정을 보여주는데 「가입하세요」가 뜨면 아무도 안 봅니다.
 *   서버는 `get_shared_trip`(db/001, 익명 실행 허용)이 **나갈 것만 손으로
 *   골라** 줍니다. RLS 로 익명을 여는 길은 쓰지 않습니다.
 * ⚠ 메모는 안 옵니다(db/135, 사용자 결정) — 주소·가격·예약번호가 거기
 *   들어 있습니다. 지출·일행·일기·준비물·대화도 애초에 안 나옵니다.
 *
 * 3단계 「나도 이대로 가기」는 아래 `가져가기` 입니다:
 *   · 로그인 안 했으면 토큰을 담아두고 로그인으로 보냅니다(돌아와서 이어집니다)
 *   · 날짜는 **내 출발일로 옮깁니다**(사용자 결정) — 간격은 그대로
 *
 * 층: dom.js · net.js · db.js · calc.js · ctx(openTrip·me) */
import { $, esc, toast } from './dom.js?v=b889';
import { fail, netTimeout } from './net.js?v=b889';
import { sb } from './db.js?v=b889';
import { dayLabel, hm, dateRange, todayYmd, asDate, D1 } from './calc.js?v=b889';

let ctx = { openTrip: async () => {}, me: () => null, showApp: () => {} };
export function setSharedCtx(o){ ctx = { ...ctx, ...o }; }

let 열림 = null;              /* { token, trip, plans } */

export function isSharedOpen(){ return !!열림; }

export function closeShared(fromPop){
  if (!fromPop && history.state?.t2 === 'shared'){ history.back(); return; }
  열림 = null;
  $('sharedpane')?.classList.add('hide');
  document.body.classList.remove('sharedon');
}

/* 로그인하고 돌아오면 이어서 가져갑니다 — 구글에 다녀오는 동안 주소가
   사라지므로 `?join=` 과 같은 수법으로 담아 둡니다(app.js 머리말). */
const 담아둔키 = 't2:planlink';
export const 담아둔링크 = () => sessionStorage.getItem(담아둔키) || '';
export const 담아둔링크비우기 = () => sessionStorage.removeItem(담아둔키);

export async function openShared(token){
  const t = String(token || '').trim();
  if (!t) return;
  const 판 = $('sharedpane'); if (!판) return;
  판.classList.remove('hide');
  document.body.classList.add('sharedon');
  if (history.state?.t2 !== 'shared') history.pushState({ t2:'shared' }, '');
  $('sharedbody').innerHTML = `<div class="empty"><span class="load">일정을 받는 중…</span></div>`;

  const r = await netTimeout(sb.rpc('get_shared_trip', { p_token: t }));
  if (r.error){ fail(r.error, '일정을 못 받았어요'); 그릴것없음('일정을 못 받았어요'); return; }
  if (!r.data){ 그릴것없음('링크가 만료되었어요', '일정을 만든 사람이 공유를 껐을 수 있어요.'); return; }

  열림 = { token: t, trip: r.data.trip || {}, plans: r.data.plans || [] };
  그리기();
}

/* ⚠ 빈 화면에 **나갈 길**을 답니다. 죽은 링크로 들어온 사람에게 × 하나만
   주면 「뭐지」 하고 닫습니다 — 어차피 온 사람이니 앱을 한 번 보여 줍니다. */
function 그릴것없음(제목, 풀이){
  열림 = null;
  $('sharedbody').innerHTML = `<div class="empty"><b>${esc(제목)}</b>${
    풀이 ? `<div class="memo">${esc(풀이)}</div>` : ''}
    <button type="button" class="ghost" id="shd_look">기로 둘러보기</button></div>`;
  $('shd_look')?.addEventListener('click', () => closeShared());
}

function 밤글(t){
  const a = asDate(t.start_date), b = asDate(t.end_date);
  const 일 = Math.round((b - a) / D1) + 1;
  return 일 > 1 ? `${일 - 1}박 ${일}일` : '당일';
}

function 그리기(){
  const { trip: t, plans } = 열림;
  const 날 = [...new Set(plans.map(p => p.date).filter(Boolean))].sort();
  const 토막 = 날.map(d => {
    const 그날 = plans.filter(p => p.date === d);
    return `<section class="shdday">
      <h3>${esc(dayLabel(d, t))}</h3>
      ${그날.map(줄).join('')}</section>`;
  }).join('');

  $('sharedbody').innerHTML = `
    <header class="shdhead">
      <p class="shdkicker">기로에서 짠 일정</p>
      <h2>${esc(t.title || '여행')}</h2>
      <p class="shdmeta">${esc([밤글(t), t.destination,
          dateRange(t.start_date, t.end_date)].filter(Boolean).join(' · '))}</p>
    </header>
    ${토막 || `<div class="empty">아직 일정이 없어요.</div>`}
    <div class="shdcta">
      <button type="button" class="primary" id="shd_take">나도 이대로 가기</button>
      <p class="memo">내 여행으로 담아요. 날짜는 내가 가는 날로 옮겨 드려요.</p>
    </div>`;
  $('shd_take').addEventListener('click', 날짜묻기);
}

/* 한 줄. 시각이 없으면 가운뎃점 — 그림 카드·글과 같은 표시입니다. */
function 줄(p){
  const t = hm(p.start_time);
  return `<div class="shdrow">
    <em>${esc(t || '·')}</em>
    <span><b>${esc(p.title || '')}</b>${
      p.move_note ? `<i>${esc(p.move_note)}</i>` : ''}</span></div>`;
}

/* ── 3단계 「나도 이대로 가기」 ───────────────────────────────────────
 * ⚠ 날짜를 **묻고** 나서 옮깁니다(사용자 결정). 안 물으면 남의 지난 여행이
 *   지난 날짜 그대로 들어와 「예정된 여행」에도 안 뜹니다. */
function 날짜묻기(){
  if (!ctx.me()){
    /* 로그인하고 돌아와서 이어집니다 — 여기서 그냥 「로그인하세요」로 끝내면
       사람이 링크를 다시 찾아와야 합니다. */
    sessionStorage.setItem(담아둔키, 열림.token);
    toast('로그인하면 내 여행으로 담을 수 있어요');
    closeShared();
    return;
  }
  const 칸 = $('shdtake');
  칸.classList.remove('hide');
  $('shd_start').value = todayYmd();
  $('shd_start').focus();
}

async function 가져가기(){
  const 날 = $('shd_start').value;
  if (!날) return toast('가는 날을 골라 주세요');
  const b = $('shd_go'); b.disabled = true; b.textContent = '담는 중…';
  const r = await netTimeout(sb.rpc('copy_shared_trip',
    { p_token: 열림.token, p_start: 날 }));
  b.disabled = false; b.textContent = '담기';
  if (r.error) return fail(r.error, '못 담았어요');
  const id = r.data;
  $('shdtake').classList.add('hide');
  closeShared();
  toast('내 여행으로 담았어요');
  await ctx.openTrip(id);
}

if (typeof document !== 'undefined' && $('sharedpane')){
  $('shd_x').addEventListener('click', () => closeShared());
  $('shd_go').addEventListener('click', 가져가기);
  $('shd_cancel').addEventListener('click', () => $('shdtake').classList.add('hide'));
}
