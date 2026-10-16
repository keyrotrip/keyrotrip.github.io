/* ── 평가 탭 「나라별」(b874) ───────────────────────────────────────────
 * 사용자(10-14): 「사용자들이 직접 '언제 다 매기냐'고 했다」 — 도시 700곳이 한 줄로 늘어서 끝이 안 보였습니다.
 *   ① 가 본 나라 고르기(b877 대륙별 한 화면 · 대륙마다 두 줄 + 더 보기 · 한국 포함) — 옛 설명: (도시 많은 나라 순 · 「다른 나라 찾기」는 그 자리에서 펼침 + 이름 찾기)
 *   ② 고른 나라 도시만 — 안 매긴 곳 위(유명한 곳부터), 매긴 곳은 아래 묶음(별 높은 순)
 *      별을 누르면 2초 보여 준 뒤 아래로 내려갑니다 — 그 사이 또 누르면 처음부터 다시 셉니다(고치는 중엔 안 내려감).
 *      0.7초는 「수정하고 싶은데 들어가는 게 빠르다」(사용자 시연 10-14). 내려간 뒤에도 「매긴 곳」에서 고칠 수 있습니다.
 *   ③ 해외 10곳을 채운 그 순간 한 번 「10곳 다 매겼어요」 — 그 뒤로 진행 막대는 걷습니다.
 * ⚠ 별점은 꼭 남깁니다(사용자) — 「가 봤어요」 체크만 하는 길은 없습니다. 별이 있어야 지구본·성향·숫자에 잡힙니다.
 * ⚠ 평가 탭은 «늘 나라별로» 열립니다(사용자). 「전체 도시」는 예전 화면 그대로입니다.
 * ⚠ 저장·도시 열기·성향 열기는 ctx 로 받습니다 — 이 파일이 rating.js 를 안 읽어야 시연 페이지(_demo_ratecc.html)에서
 *   가짜 저장으로 돌릴 수 있습니다. 고른 나라는 이 기기에만 기억합니다(localStorage, 못 쓰면 매번 고르기). */
import { $, esc, flagSprite } from './dom.js?v=b882';
import { cities, countryName, continentOf, chosung, onlyCho } from './cities.js?v=b882';
import { starHtml, paintStars, starValue } from './stars.js?v=b882';
import { 인기, 별받음, cityStat, myRates, avgTail } from './rate.js?v=b882';
/* ★4.5 묻기(b861) — 전체 도시 목록(rating.js)은 쓰고 있는데 **나라별 화면만 안 쓰고
   있었습니다**(b878, 사용자 신고: 「별 4.5 이상이면 한줄평이랑 맛집추천도 떠야 하는데 안 떠」). */
import { 물을까, 묻기Html } from './cmtask.js?v=b882';

let ctx = {
  별: () => null,              /* 도시 id → 내 별점(없으면 null) */
  저장: async () => true,      /* (도시 id, 별 또는 null) → 됐나 */
  해외수: () => 0,             /* 해외 별 매긴 수 */
  방금확정: () => false,       /* 이번 저장으로 해외 10곳이 됐나 */
  도시열기: () => {},
  성향열기: () => {},
  문턱: 10,
};
export function setRateCcCtx(o){ ctx = { ...ctx, ...o }; }

const 열쇠 = 'rate_cc';
const 읽기 = () => { try { const v = JSON.parse(localStorage.getItem(열쇠) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const 쓰기 = v => { try { localStorage.setItem(열쇠, JSON.stringify(v)); } catch {} };

let 고른 = 읽기();          /* 고른 나라 코드(cc) */
let 칩 = null;              /* 지금 보는 나라 */
let 고르는중 = false;       /* 「나라 다시 고르기」 */
/* (대륙 펼침 · 찾는 글자는 아래 고르기그리기 옆 — 펼친대륙 · 찾기) */
let 끝판 = false;           /* ③ 을 보여 주는 중 */
let 끝봤음 = false;         /* ③ 은 한 번만 — 방금확정은 성향을 보러 갈 때까지 참으로 남아서, 「더 매기기」 뒤 별마다 또 뜨면 안 됨 */
let 내려보낼 = null;        /* 2초 뒤 다시 그리기 */

const 나라들 = () => {
  const n = {};
  for (const c of cities || []) n[c.cc] = (n[c.cc] || 0) + 1;
  return Object.entries(n).filter(([cc]) => countryName[cc])
    .sort((a, b) => b[1] - a[1] || String(countryName[a[0]]).localeCompare(countryName[b[0]], 'ko'));
};
const 수 = cc => (cities || []).filter(c => c.cc === cc).length;
const 깃발 = cc => `<svg viewBox="0 0 36 36" aria-hidden="true"><use href="#f-${esc(String(cc).toLowerCase())}"/></svg>`;

/* 평가 탭으로 올 때(app.js) — 앱을 켜고 «처음» 올 때만 나라별로 엽니다. 그 뒤로는 보던 자리 그대로(b875, 사용자:
   「다른 탭 갔다 오는 건 그대로」) — 전체 도시를 보던 사람·나라를 고르던 사람을 되돌리지 않습니다. */
let 처음왔나 = true;
export function rateCcOpen(){
  if (처음왔나){ 처음왔나 = false; $('rateview')?.classList.add('ccmode'); 고르는중 = false; 끝판 = false; }
  segPaint();
  if (rateCcOn()) draw();
}
/* 평가 탭을 한 번 더 눌렀을 때(app.js 탭처음으로) — «제일 처음»으로(b875, 사용자: 「그냥 제일 처음으로 가 줘」).
   나라별 · 아무것도 안 고른 나라 고르기. 고른 나라 기억도 지웁니다. 전체 도시를 보고 있었으면 나라별로. */
export function rateCcHome(){
  처음왔나 = false;
  $('rateview')?.classList.add('ccmode');
  segPaint();
  고른 = []; 쓰기(고른); 칩 = null;
  if (history.state?.t2 === 'ratecc') history.replaceState(null, '');   /* 처음으로 갔으니 목록 기록은 버림 */
  고르는중 = true; 끝판 = false; 펼친대륙 = new Set(); 찾기 = '';
  clearTimeout(내려보낼);
  draw();
}
export const rateCcOn = () => $('rateview')?.classList.contains('ccmode') === true;

function segPaint(){
  const on = rateCcOn();
  document.querySelectorAll('#rtseg [data-rtmode]').forEach(b => b.classList.toggle('on', (b.dataset.rtmode === 'cc') === on));
}

/* 받은끝 = 평가 탭이 별점 받기를 끝낸 뒤 부름(app.js). 그 전엔 그리지 않습니다 — 내 별점 없이 그리면 매긴 곳이 안 매긴 줄로
   위에 뜨고, 그때 누르면 「10곳 다 매겼어요」도 못 셉니다(b874 점검, rating.js saveRate 의 별받음). */
export async function draw(받은끝 = false){
  const 판 = $('ratecc'); if (!판) return;
  if (!별받음 || !cities){
    판.innerHTML = 받은끝
      ? `<div class="empty">별점을 못 받아왔어요.<br><span class="memo">연결을 확인하고 평가 탭을 다시 열어 주세요.</span></div>`
      : `<div class="empty"><span class="load">도시 목록을 받는 중…</span></div>`;
    return;
  }
  /* ⚠ 매긴 도시의 나라를 미리 골라 두던 것(b874)은 걷었습니다(b875, 사용자: 「가 본 나라들은 자동으로 다 선택되어 있는데
     첫 초기 화면으로 뜨는 게 낫지 않냐 · 이거 언제 내가 다 해제해」) — 많이 다닌 사람은 30개 넘게 칠해져 하나씩 빼야 했음. */
  await flagSprite();
  if (끝판) return 끝그리기(판);
  if (!고른.length) 고르는중 = true;   /* 고르는 화면은 «다음»을 누를 때까지 — 하나 누르자마자 넘어가면 안 됨 */
  if (!고른.length || 고르는중) return 고르기그리기(판);
  if (!고른.includes(칩)) 칩 = 고른[0];
  목록그리기(판);
}

/* ── ① 가 본 나라 고르기 ── */
/* 대륙별로 한 화면(b877, 사용자: 「대륙별로 보여 주고 펼쳐서 더 찾자」 → 「4×2 로 · 나머지는 펼쳐서 · 맨 위엔 그래도 찾는 칸」).
   대륙마다 도시 많은 나라부터 8개국(4×2), 그 아래 「○○ N개국 더 보기」로 그 대륙만 펼침. 골라 둔 나라는 접혀 있어도 보임.
   찾는 칸: 치면 모든 대륙에서 맞는 나라만(접힌 것까지). 저절로 키보드를 띄우지 않음(b875 사용자).
   ⚠ 찾는 칸은 다시 그리지 않습니다 — 한글을 치는 도중에 칸을 갈아 끼우면 글자 조합이 끊깁니다. 껍데기(제목·칸)는 한 번,
     그 아래 #rcc_cts 와 「다음」 자리만 다시 그립니다. */
const 대륙차례 = ['아시아', '유럽', '북아메리카', '오세아니아', '남아메리카', '아프리카'];
const 대륙칸 = 8;
let 펼친대륙 = new Set(), 찾기 = '';
function 고르기그리기(판){
  if (!판.querySelector('#rcc_q')){
    판.innerHTML = `<div class="rcc-top"><div class="rcc-h">가 본 나라를 골라 주세요</div><span id="rcc_next"></span></div>
      <p class="rcc-s">고른 나라 도시만 보여 드려요. 여러 개 골라도 돼요.</p>
      <input type="search" class="rcc-q" id="rcc_q" placeholder="나라 이름 찾기 (스위스 / ㅅㅇㅅ)" autocomplete="off" enterkeyhint="search">
      <div id="rcc_cts"></div>`;
    $('rcc_q').value = 찾기;
  }
  /* 「다음」은 제목 옆 하나뿐(b876) — 안 골랐으면 아예 안 띄움(회색 막힌 단추를 남기지 않음).
     ⚠ **고르기 시작하면 큰 제목을 「N개 고름」으로 바꿉니다(b878).** 「전체 해제」가 붙으면서
       375px 에서 제목·해제·다음 셋이 한 줄에 안 들어갑니다. 고르는 중에는 안내보다 **지금 몇 개인지**가
       쓸모 있고, 안내는 바로 아래 부제가 계속 하고 있습니다.
     ⚠ 「전체 해제」는 고른 것이 있을 때만(사용자: 「전체해제 버튼도 없어서 하나씩 눌러야해」). */
  const 제목 = 판.querySelector('.rcc-h');
  if (제목) 제목.textContent = 고른.length ? `${고른.length}개 고름` : '가 본 나라를 골라 주세요';
  $('rcc_next').innerHTML = 고른.length
    ? `<button type="button" class="ghost rcc-clear" data-rccclear>전체 해제</button>` +
      `<button type="button" class="primary rcc-next" data-rccnext>다음 ›</button>` : '';
  const q = 찾기.trim();
  const 맞나 = cc => { const 이름 = String(countryName[cc] || ''); return !q || (onlyCho(q) ? chosung(이름).includes(q) : 이름.includes(q)); };
  const 묶음 = {};
  for (const [cc, n] of 나라들()) if (맞나(cc)) (묶음[continentOf[cc] || '기타'] ||= []).push([cc, n]);
  /* 찾을 때는 대륙 안에서 그 글자로 «시작하는» 나라 먼저(「스」→ 스페인·스위스가 라오스보다 위) */
  if (q){
    const 시작 = cc => { const 이름 = String(countryName[cc] || ''); return (onlyCho(q) ? chosung(이름).startsWith(q) : 이름.startsWith(q)) ? 1 : 0; };
    for (const k in 묶음) 묶음[k].sort((x, y) => 시작(y[0]) - 시작(x[0]));
  }
  const 차례 = [...대륙차례.filter(k => 묶음[k]), ...Object.keys(묶음).filter(k => !대륙차례.includes(k))];
  const 칸 = ([cc, n]) => `<button type="button" class="rcc-c${고른.includes(cc) ? ' on' : ''}" data-rccpick="${esc(cc)}" aria-pressed="${고른.includes(cc)}">
      ${깃발(cc)}<b>${esc(countryName[cc])}</b><span>${n}곳</span></button>`;
  const 대륙 = k => {
    const 다 = 묶음[k], 펼 = !!q || 펼친대륙.has(k);
    const 보일 = 펼 ? 다 : [...다.slice(0, 대륙칸), ...다.slice(대륙칸).filter(([cc]) => 고른.includes(cc))];
    const 남음 = 다.length - 보일.length;
    const 고른수 = 다.filter(([cc]) => 고른.includes(cc)).length;
    return `<section class="rcc-ct">
      <div class="rcc-cth"><b>${esc(k)}</b>${고른수 ? `<span class="on">${고른수}개 고름</span>` : ''}</div>
      <div class="rcc-grid rcc-g4">${보일.map(칸).join('')}</div>
      ${q ? '' : 남음 > 0 ? `<button type="button" class="ghost rcc-more" data-rccct="${esc(k)}">${esc(k)} ${남음}개국 더 보기 ⌄</button>`
        : 펼 && 다.length > 대륙칸 ? `<button type="button" class="ghost rcc-more" data-rccct="${esc(k)}">접기 ⌃</button>` : ''}
    </section>`;
  };
  $('rcc_cts').innerHTML = 차례.length ? 차례.map(대륙).join('') : `<p class="rcc-none">「${esc(q)}」에 맞는 나라가 없어요.</p>`;
}

/* ── ② 고른 나라 도시 ── */
function 줄(c){
  const s = ctx.별(c.id);
  return `<div class="rrow rcc-row" data-rcccity="${esc(c.id)}">
      ${c.image_url ? `<img class="thumb" src="${esc(c.image_url)}" alt="" loading="lazy">` : `<span class="thumb ph">${esc(c.name.slice(0, 1))}</span>`}
      <div class="t"><b>${esc(c.name)}</b>${
        /* 영문 이름은 걷었습니다(b878, 사용자: 「영어는 지워버려 도시명 영어가 왜 나온거야」) —
           우리말 이름 옆에 영문이 또 있을 이유가 없고, 그 자리를 평균·한줄평이 씁니다. */''}${
        /* 평균·한줄평 수(b878, 사용자: 「도시마다 평균별점이랑 후기 몇개인지 보여줘야 하는데 안 뜨네」).
           ⚠ **새로 만들지 않습니다** — 전체 도시 목록이 쓰는 `avgTail` 그대로입니다(rate.js).
             거기서 「나를 뺀 평균」과 「한줄평 N」 규칙이 이미 정해져 있어, 여기서 따로 세면 두 화면 숫자가 갈립니다.
           ⚠ 도시 이름 **아래 줄**입니다 — 이름 옆에 붙이면 긴 이름(「보스니아 헤르체고비나」)에서 잘립니다. */
        (() => { const t = avgTail(cityStat[c.id], myRates[c.id]); return t ? `<span class="memo rcc-avg">${esc(t.slice(3))}</span>` : ''; })()
      }</div>
      <span class="stars" data-rccstar="${esc(c.id)}">${starHtml(s)}</span></div>`;
}
function 목록그리기(판){
  const n = ctx.해외수(), 문턱 = ctx.문턱;
  const 칩들 = [...고른].sort((a, b) => 수(b) - 수(a));
  const 다 = (cities || []).filter(c => c.cc === 칩);
  const 안 = 다.filter(c => ctx.별(c.id) == null)
    /* 유명한 곳부터 — 평가 탭과 같은 차례(rate.js 인기표 → fame → pop_rank → 가나다). fame 만으로는 한국 14곳이 한 칸이라 가나다가 됐음 */
    .sort((a, b) => 인기(a) - 인기(b) || (a.fame ?? 9) - (b.fame ?? 9) || (a.pop_rank ?? 999) - (b.pop_rank ?? 999) || a.name.localeCompare(b.name, 'ko'));
  const 매 = 다.filter(c => ctx.별(c.id) != null)
    .sort((a, b) => ctx.별(b.id) - ctx.별(a.id) || a.name.localeCompare(b.name, 'ko'));
  const 막대 = n < 문턱 ? `<div class="rcc-goal"><div class="t">여행 성향까지 <b>${문턱 - n}곳</b> 남았어요</div><b class="n">${n}/${문턱}</b></div>
      <div class="rcc-bar"><i style="width:${Math.round(n / 문턱 * 100)}%"></i></div>` : '';
  판.innerHTML = `${막대}
    <div class="rcc-chips">${칩들.map(cc => `<button type="button" class="rcc-chip${cc === 칩 ? ' on' : ''}" data-rccchip="${esc(cc)}">${esc(countryName[cc])} ${수(cc)}</button>`).join('')}</div>
    ${칩 === 'KR' ? `<p class="rcc-kr">한국 도시는 기록에만 남고 성향엔 안 들어가요</p>` : ''}
    <p class="rcc-hint">가 본 곳만 별을 눌러요. 안 간 곳은 넘어가면 돼요.</p>
    <div class="rcc-list">${안.map(줄).join('') || `<p class="rcc-none">${esc(countryName[칩])} 도시를 다 매겼어요.</p>`}</div>
    ${매.length ? `<div class="rcc-sub">매긴 곳 <span>${매.length}</span></div><div class="rcc-list done">${매.map(줄).join('')}</div>` : ''}
    <button type="button" class="ghost rcc-again" data-rccagain>나라 다시 고르기</button>`;
}

/* ── ③ 해외 10곳을 채운 순간 ── */
function 끝그리기(판){
  판.innerHTML = `<div class="rcc-end"><div class="big" aria-hidden="true">🎉</div>
      <h2>${ctx.문턱}곳 다 매겼어요!</h2>
      <p>여행 성향이 나왔어요.<br>오늘은 여기까지 해도 돼요.</p>
      <button type="button" class="primary" data-rccpersona>내 여행 성향 보기</button>
      <button type="button" class="ghost" data-rccmoreon>더 매기기</button></div>`;
}

function 다시그리기곧(){
  clearTimeout(내려보낼);
  내려보낼 = setTimeout(() => { if (rateCcOn()) draw(); }, 2000);
}

document.addEventListener('click', async e => {
  const 판 = $('ratecc');
  const seg = e.target.closest('#rtseg [data-rtmode]');
  if (seg){
    const cc = seg.dataset.rtmode === 'cc';
    $('rateview')?.classList.toggle('ccmode', cc);
    segPaint();
    if (cc) draw();
    else ctx.전체열기?.();
    return;
  }
  if (!판 || !판.contains(e.target)) return;
  if (e.target.closest('[data-rccclear]')){
    고른 = []; 고르는중 = true;        /* 기억은 「다음」을 누를 때(아래 rccnext 와 같은 규칙) */
    return draw();
  }
  const pick = e.target.closest('[data-rccpick]');
  if (pick){
    const cc = pick.dataset.rccpick;
    고른 = 고른.includes(cc) ? 고른.filter(x => x !== cc) : [...고른, cc];
    고르는중 = true;                    /* 기억은 「다음」을 누를 때(쓰기) */
    return draw();
  }
  const ct = e.target.closest('[data-rccct]');
  if (ct){ const k = ct.dataset.rccct; 펼친대륙.has(k) ? 펼친대륙.delete(k) : 펼친대륙.add(k); return draw(); }
  if (e.target.closest('[data-rccnext]')){
    if (!고른.length) return;
    고르는중 = false; 찾기 = ''; 쓰기(고른);
    if (history.state?.t2 !== 'ratecc') history.pushState({ t2: 'ratecc' }, '');   /* 뒤로가기 = 나라 고르기(b876) */
    칩 = [...고른].sort((a, b) => 수(b) - 수(a))[0];
    await draw(); 판.scrollIntoView({ block: 'start' }); return;
  }
  if (e.target.closest('[data-rccagain]')){
    if (history.state?.t2 === 'ratecc'){ history.back(); return; }   /* 기록을 되감으면 아래 popstate 가 고르기로 */
    고르는중 = true; await draw(); 판.scrollIntoView({ block: 'start' }); return;
  }
  const chip = e.target.closest('[data-rccchip]');
  if (chip){ 칩 = chip.dataset.rccchip; clearTimeout(내려보낼); return draw(); }
  if (e.target.closest('[data-rccpersona]')){ 끝판 = false; return ctx.성향열기(); }
  if (e.target.closest('[data-rccmoreon]')){ 끝판 = false; return draw(); }

  const st = e.target.closest('.st');
  const wrap = st?.closest('[data-rccstar]');
  if (wrap){
    const id = wrap.dataset.rccstar;
    const v = starValue(st, e.clientX);
    const cur = ctx.별(id);
    const next = (v === 0 || Number(cur) === v) ? null : v;   /* 같은 별 다시 누르면 지움(평가 탭과 같음) */
    paintStars(wrap, next, true);
    const 됐나 = await ctx.저장(id, next);
    if (됐나 === false){ paintStars(wrap, cur ?? null, true); return; }
    if (ctx.방금확정() && !끝봤음){ 끝판 = 끝봤음 = true; clearTimeout(내려보낼); return draw(); }
    /* ── ★4.5 이상이면 그 줄 «바로 밑»에 한줄평·맛집 묻기(b878) ──────────────
     * ⚠ 줄 «안»에 넣으면 안 됩니다 — 줄 전체가 `data-rcccity` 라 누르면 도시 화면이 열립니다.
     *   형제로 붙입니다(rating.js 가 같은 이유로 그렇게 합니다).
     * ⚠⚠ **붙였으면 2초 뒤 다시 그리기를 «끕니다».** 안 끄면 묻는 줄이 2초 만에
     *   사라집니다 — 그 다시 그리기는 매긴 도시를 「매긴 곳」 칸으로 내려보내는
     *   것이라, 줄이 통째로 새로 만들어지면서 형제로 붙인 것도 같이 날아갑니다.
     *   (고치기 전에 붙여 보고 2초 뒤 사라지는 것을 봤습니다.)
     *   사용자가 ×(그만 묻기)를 누르거나 글을 남기면 그때 다시 그려집니다. */
    const 행 = wrap.closest('.rcc-row');
    const 묻던 = 행?.nextElementSibling?.classList.contains('cmask') ? 행.nextElementSibling : null;
    const 도시 = (cities || []).find(x => x.id === id);
    if (행 && 도시 && 물을까(id, next, myRates[id]?.comment)){
      if (!묻던) 행.insertAdjacentHTML('afterend', 묻기Html(id, 도시.name, myRates[id]?.comment, true));
      clearTimeout(내려보낼);
      return;
    }
    묻던?.remove();
    다시그리기곧();
    return;
  }
  const row = e.target.closest('[data-rcccity]');
  if (row) ctx.도시열기(row.dataset.rcccity);
});

/* 찾는 칸(b877) — 칸은 그대로 두고 아래 목록만 다시(위 ⚠). 한글은 조합 중에도 input 이 오지만 칸을 안 건드리니 안 끊깁니다. */
document.addEventListener('input', e => {
  if (e.target.id !== 'rcc_q') return;
  찾기 = e.target.value;
  draw();
});
document.addEventListener('keydown', e => { if (e.target.id === 'rcc_q' && e.key === 'Enter' && !e.isComposing) e.target.blur(); });

/* 뒤로가기(b876, 사용자: 「도시 고르고 나서 다시 고르고 싶어서 뒤로가기 하는데 안 됨」) — 목록 기록(t2:ratecc)에서 벗어나면 고르기로.
   도시 화면 등 위에 얹힌 것을 닫는 뒤로가기는 tripview.js 사슬이 먼저 받고, 그때 기록은 다시 ratecc 라 여기선 아무것도 안 함. */
window.addEventListener('popstate', () => {
  if (history.state?.t2 === 'ratecc' || 고르는중 || 끝판 || !rateCcOn()) return;
  고르는중 = true; clearTimeout(내려보낼);
  draw().then(() => $('ratecc')?.scrollIntoView({ block: 'start' }));
});
