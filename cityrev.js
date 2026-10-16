/* ── 도시 후기(한줄평) — 좋아요 · 답글 · 후기 화면(b858) ─────────────────
 * 사용자(10-13): 「여행 후기를 강화해야하는데 … 평균 옆에 후기 몇 개인지 · 후기 좋아요 · 답글」
 *   → 왓챠피디아처럼: 도시 화면엔 후기 셋 + 「모두 보기」, 후기를 누르면 따로 한 화면(답글 · 맨 아래 「등록」).
 *   줄 모양은 사용자가 고름: 이름 → 「★ 4.5」 네모 → 글 → 「♡ 3  💬 2 · 2일 전」(하트·말풍선 둘 다 아이콘).
 * 서버는 db/122(review_like · review_reply_add · review_replies_list · review_one · city_comments).
 *   후기에는 번호가 없어서 (쓴 사람, 도시) 둘로 가리킵니다 — data-crva(쓴 사람) · data-crvc(도시).
 *
 * ⚠ **덮는 층입니다(`#crvview`, position:fixed, z 1145)** — 친구 화면(1140) 위, 사람 화면(1150) 아래.
 *   후기 화면에서 이름을 누르면 사람 화면이 그 위로 뜹니다. 뒤로가기는 tripview.js 사슬(사람 → 후기 → 친구).
 * ⚠ 판은 «겹»으로 쌓습니다(모두 보기 → 후기 하나). 겹마다 history 한 칸.
 * ⚠ 높이는 보이는 창(--vvtop · --vvh, ui.js 가 잼)에 맞춥니다 — 맨 아래 입력칸이 키보드 위에 앉게.
 *   bottom:0 은 아이폰 홈 화면 앱에서 키보드 뒤로 갑니다([[ios-keyboard-sheet]]).
 * ⚠ 좋아요·답글 단추는 도시 화면 줄에도 있습니다 — 누르기는 document 에 한 번 답니다(아래).
 */
import { $, esc, toast, avatarImg } from './dom.js?v=b884';
import { sb } from './db.js?v=b884';
import { netTimeout } from './net.js?v=b884';
import { cities, cityCountry } from './cities.js?v=b884';
import { arm } from './ui.js?v=b884';
import { openPhotos } from './photoview.js?v=b884';

let ctx = { me: () => null, openPerson: () => {}, openCity: () => {}, cityNow: () => null, redrawCity: () => {}, redrawFoods: () => {} };
export function setCityRevCtx(o){ ctx = { ...ctx, ...o }; }

let 겹 = [];              /* [{ 판:'all', city, 정렬 } | { 판:'one', a, city, 정렬 } | { 판:'fs', city, 가게 } | { 판:'fn', id, city }] */
/* 맛집 답글(b866, db/127) — 사용자: 「맛집 추천도 한줄평처럼 답글」 → 「추천한 사람 글마다 따로」.
   같은 덮는 층·같은 답글 칸·같은 ⋯ 메뉴를 씁니다. 'fs' = 한 가게의 추천 글 모음, 'fn' = 추천 글 하나 + 답글. */
let 차례 = 0;
let 메뉴대상 = null;      /* ⋯ 를 누른 것: { 종류:'rv'|'rp', a, city, id, uid, 글 } */

export const isCityRevOpen = () => 겹.length > 0;

/* ── 작은 것들 ─────────────────────────────────────────────────────── */
const 하트 = on => `<svg class="crvic${on ? ' on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.3A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z"/></svg>`;
const 말풍선 = '<svg class="crvic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h15v10.5H10l-5.5 4v-4z"/></svg>';
export const 별칸 = v => v == null ? '' : `<span class="crvpill"><i aria-hidden="true">★</i>${Number(v).toFixed(1)}</span>`;
export function 언제(t){
  const d = new Date(t), 초 = (Date.now() - d) / 1000;
  if (!isFinite(초)) return '';
  if (초 < 60) return '방금';
  if (초 < 3600) return `${Math.floor(초 / 60)}분 전`;
  if (초 < 86400) return `${Math.floor(초 / 3600)}시간 전`;
  if (초 < 86400 * 7) return `${Math.floor(초 / 86400)}일 전`;
  const y = String(d.getFullYear()).slice(2), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${dd}`;
}
const 사진 = (url, id, 이름, px) => avatarImg(url, id, 이름,
  `width:${px}px;height:${px}px;border-radius:50%;object-fit:cover;flex:none`, 'thumb');

/* 좋아요·답글 줄 — 도시 화면 줄 · 후기 화면 머리가 같이 씁니다 */
function 반응줄(x, 시각 = true, 내단추 = false){
  const 나 = ctx.me()?.id, 내것 = x.user_id === 나;
  return `<div class="crvact">
    <button type="button" class="crvlike${x.liked ? ' on' : ''}" data-crvlike data-crva="${esc(x.user_id)}"
            data-crvc="${esc(x.city)}" aria-pressed="${x.liked ? 'true' : 'false'}"
            aria-label="좋아요${x.n_like ? ` ${x.n_like}개` : ''}"${내것 ? ' disabled' : ''}>${하트(x.liked)}<span class="num">${x.n_like || ''}</span></button>
    <button type="button" class="crvrep" data-crvopen data-crva="${esc(x.user_id)}" data-crvc="${esc(x.city)}"
            aria-label="답글${x.n_reply ? ` ${x.n_reply}개` : ' 달기'}">${말풍선}<span class="num">${x.n_reply || ''}</span></button>
    ${시각 ? `<span class="crvwhen">${esc(언제(x.created_at))}</span>` : ''}
    ${내것 && 내단추 ? `<span class="crvmyb"><button type="button" class="ghost" data-cvmyedit>수정</button><button type="button" class="ghost" data-cvmydel>삭제</button></span>` : ''}
  </div>`;
}

/* ── 도시 화면의 후기 줄(셋) — city.js 가 부릅니다 ───────────────────── */
export function revRowsHtml(list, cityId, 전체수){
  /* 아무도 안 쓴 도시 — 「첫 한줄평」(b859, 사용자가 고른 셋째 방안). 처음이라는 것이 쓸 이유가 됩니다.
     ⚠ 내 한줄평도 이 목록에 들어오므로(city_comments), 비었다는 건 나도 안 썼다는 뜻입니다. */
  /* b867: 부제·점선 상자 걷음(사용자: 「밑줄 친 부제 좀 없애 너무 지저분해」) — 한 줄만. 맛집 칸(cmtask.js)과 같은 .secempty.
     제목 줄(「한줄평 N · 좋아요 순」)은 이제 index.html 의 .cvsechd 가 맡습니다(city.js 가 숫자를 채움). */
  if (!list.length) return '<div class="secempty">아직 한줄평이 없어요</div>';
  const 줄 = list.map(x => ({ ...x, city: cityId })).map(x => `
    <div class="crvrow">
      <button class="ghost crvwho" data-person="${esc(x.user_id)}">
        ${사진(x.avatar_url, x.user_id, x.name, 36)}<b>${esc(x.name)}</b>${x.is_friend ? '<span class="crvf">팔로잉</span>' : ''}</button>
      ${별칸(x.stars)}
      <div class="crvtxt" data-crvopen data-crva="${esc(x.user_id)}" data-crvc="${esc(cityId)}">${esc(x.comment)}</div>
      ${반응줄(x, true, true)}
    </div>`).join('');
  return `<div class="crvsec">${줄}
    ${전체수 > list.length ? `<button type="button" class="ghost crvall" data-crvall="${esc(cityId)}">모두 보기</button>` : ''}</div>`;
}

/* ── 덮는 층 열기·닫기 ─────────────────────────────────────────────── */
function 판열기(새){
  겹.push(새);
  history.pushState({ t2: 'cityrev', n: 겹.length }, '');
  $('crvview').classList.remove('hide');
  그리기();
}
export function openCityRevs(city){ 판열기({ 판: 'all', city, 정렬: 'like' }); }
export function openFoodShop(city, 가게){ 판열기({ 판: 'fs', city, 가게 }); }
export function openFoodNote(id, city, 옵션 = {}){
  판열기({ 판: 'fn', id: Number(id), city });
  if (옵션.쓰기) setTimeout(() => $('crv_in')?.focus(), 0);
}
export function openCityRev(a, city, 옵션 = {}){
  판열기({ 판: 'one', a, city, 정렬: 'like' });
  if (옵션.쓰기) setTimeout(() => $('crv_in')?.focus(), 0);
}
export function closeCityRev(fromPop){
  if (!fromPop && history.state?.t2 === 'cityrev'){ history.back(); return; }
  $('crv_in')?.blur();
  if (fromPop && 갈도시 != null){
    const c = 갈도시; 갈도시 = null;
    겹 = []; 차례++; $('crvview').classList.add('hide'); 도시다시();
    if (ctx.cityNow?.() !== c) ctx.openCity(c);
    return;
  }
  겹.pop(); 차례++;
  if (!겹.length){ $('crvview').classList.add('hide'); 도시다시(); return; }
  그리기();
}
/* 닫고 나면 도시 화면의 숫자·하트를 맞춥니다(이 화면에서 누른 것이 있으니) */
let 바뀜 = false;
function 도시다시(){ if (바뀜){ 바뀜 = false; ctx.redrawCity?.(); ctx.redrawFoods?.(); } }

function 그리기(){
  const 지금 = 겹[겹.length - 1];
  const 이번 = ++차례;
  $('crvbody').innerHTML = '<div class="empty"><span class="load">불러오는 중…</span></div>';
  $('crvbody').scrollTop = 0;
  $('crvtitle').textContent = 지금.판 === 'all' ? `${cities.find(c => c.id === 지금.city)?.name || ''} 한줄평`
    : 지금.판 === 'fs' ? (지금.가게 || '맛집 추천') : 지금.판 === 'fn' ? '맛집 추천' : '한줄평';
  $('crvmenu').classList.toggle('hide', 지금.판 !== 'one' && 지금.판 !== 'fn');
  $('crvinp').classList.toggle('hide', (지금.판 !== 'one' && 지금.판 !== 'fn') || !ctx.me());
  if ($('crv_in')) {
    $('crv_in').value = '';
    $('crv_in').placeholder = 지금.판 === 'fn' ? '추천 글에 답글을 남겨보세요.' : '한줄평에 답글을 남겨보세요.';
    등록칠();
  }
  return 지금.판 === 'all' ? 모두그리기(지금, 이번) : 지금.판 === 'fs' ? 가게그리기(지금, 이번)
       : 지금.판 === 'fn' ? 추천하나그리기(지금, 이번) : 하나그리기(지금, 이번);
}

async function 모두그리기(지금, 이번){
  const r = await netTimeout(sb.rpc('city_comments', { p_city: 지금.city, p_sort: 지금.정렬, p_limit: 100 }));
  if (이번 !== 차례) return;
  if (!r || r.error){ $('crvbody').innerHTML = `<div class="empty">지금은 불러올 수 없어요.</div>`; return; }
  const 목록 = (r.data || []).map(x => ({ ...x, city: 지금.city }));
  $('crvbody').innerHTML = `<div class="crvhd2"><span>한줄평 ${목록.length}개</span>${정렬단추(지금.정렬)}</div>` +
    (목록.length ? 목록.map(x => `
    <div class="crvrow">
      <button class="ghost crvwho" data-person="${esc(x.user_id)}">
        ${사진(x.avatar_url, x.user_id, x.name, 36)}<b>${esc(x.name)}</b>${x.is_friend ? '<span class="crvf">팔로잉</span>' : ''}</button>
      ${별칸(x.stars)}
      <div class="crvtxt" data-crvopen data-crva="${esc(x.user_id)}" data-crvc="${esc(x.city)}">${esc(x.comment)}</div>
      ${반응줄(x)}
    </div>`).join('') : '<div class="empty">아직 한줄평이 없어요.</div>');
}

const 정렬단추 = s => `<button type="button" class="ghost crvsortb" data-crvsort aria-label="정렬 바꾸기">
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M3.5 7.5 7 4l3.5 3.5M17 20V4M13.5 16.5 17 20l3.5-3.5"/></svg>
  ${s === 'new' ? '최신 순' : '좋아요 순'}</button>`;

async function 하나그리기(지금, 이번){
  const [r, rp] = await Promise.all([
    netTimeout(sb.rpc('review_one', { p_author: 지금.a, p_city: 지금.city })),
    netTimeout(sb.rpc('review_replies_list', { p_author: 지금.a, p_city: 지금.city, p_sort: 지금.정렬 })),
  ]);
  if (이번 !== 차례) return;
  const x = r?.data?.[0];
  if (!r || r.error || rp?.error){ $('crvbody').innerHTML = '<div class="empty">지금은 불러올 수 없어요.</div>'; return; }
  if (!x){ $('crvbody').innerHTML = '<div class="empty">지워졌거나 볼 수 없는 한줄평이에요.</div>';
           $('crvinp').classList.add('hide'); $('crvmenu').classList.add('hide'); return; }
  x.city = 지금.city;
  지금.글 = x.comment; 지금.이름 = x.name;
  const c = cities.find(z => z.id === 지금.city);
  const 좋아한 = x.likers || [];
  const 첫 = 좋아한[0];
  const 답글 = rp.data || [];
  const 나 = ctx.me()?.id;
  $('crvbody').innerHTML = `
    <div class="crvtop">
      <div class="l">
        <button class="ghost crvwho sm" data-person="${esc(x.user_id)}">${사진(x.avatar_url, x.user_id, x.name, 22)}<span>${esc(x.name)}</span></button>
        <h3 class="crvcity" data-crvcity="${esc(지금.city)}">${esc(c?.name || '')}</h3>
        <div class="m">${esc(c ? cityCountry(c) : '')} · ${esc(언제(x.created_at))}</div>
        ${별칸(x.stars)}
      </div>
      ${c?.image_url ? `<img class="crvimg" src="${esc(c.image_url)}" alt="" data-crvcity="${esc(지금.city)}"
           onerror="this.remove()">` : ''}
    </div>
    <div class="crvbig">${esc(x.comment)}</div>
    ${x.n_like && 첫 ? `<div class="crvlikers"><span class="row">${좋아한.map(p => 사진(p.avatar, p.id, p.name, 22)).join('')}</span>
      '${esc(첫.name)}'님${x.n_like > 1 ? ` 외 ${x.n_like - 1}명이` : '이'} 좋아해요</div>` : ''}
    <div class="crvpad">${반응줄(x, false)}</div>
    <div class="crvgap"></div>
    <div class="crvhd2"><span>답글 ${답글.length}개</span>${답글.length > 1 ? 정렬단추(지금.정렬) : ''}</div>
    ${답글.length ? 답글.map(p => `
      <div class="crpline">
        <button class="ghost" data-person="${esc(p.user_id)}" aria-label="${esc(p.name)} 프로필">${사진(p.avatar_url, p.user_id, p.name, 32)}</button>
        <div class="b">
          <div class="n"><b data-person="${esc(p.user_id)}">${esc(p.name)}</b><small>${esc(언제(p.created_at))}</small></div>
          <div class="x">${esc(p.body)}</div>
          <div class="f">
            <button type="button" class="crvlike sm${p.liked ? ' on' : ''}" data-crplike="${p.id}"
                    aria-pressed="${p.liked ? 'true' : 'false'}" aria-label="좋아요"${p.user_id === 나 ? ' disabled' : ''}>${하트(p.liked)}<span class="num">${p.n_like || ''}</span></button>
            ${ctx.me() && p.user_id !== ctx.me()?.id ? `<button type="button" class="ghost crpto" data-crpto="${esc(p.user_id)}" data-name="${esc(p.name)}">답글 달기</button>` : ''}
            <button type="button" class="ghost crpmore" data-crpmore="${p.id}" data-uid="${esc(p.user_id)}"
                    data-txt="${esc(p.body)}" aria-label="더 보기">⋯</button>
          </div>
        </div>
      </div>`).join('') : '<div class="crvnone">첫 답글을 남겨 보세요.</div>'}`;
}

/* ── 맛집: 한 가게의 추천 글 모음(b866) ─────────────────────────────── */
async function 가게그리기(지금, 이번){
  const r = await netTimeout(sb.rpc('food_notes', { p_city: 지금.city, p_name: 지금.가게 }));
  if (이번 !== 차례) return;
  if (!r || r.error){ $('crvbody').innerHTML = '<div class="empty">지금은 불러올 수 없어요.</div>'; return; }
  const 목록 = r.data || [];
  const 전체 = 목록[0]?.n_all ?? 0, 글없음 = Math.max(0, 전체 - 목록.length);
  const c = cities.find(z => z.id === 지금.city);
  $('crvbody').innerHTML = `<div class="crvhd2"><span>${esc(c?.name || '')} · 추천 ${전체}명</span></div>` +
    (목록.length ? 목록.map(x => `
    <div class="crvrow">
      <button class="ghost crvwho" data-person="${esc(x.user_id)}">${사진(x.avatar_url, x.user_id, x.name, 36)}<b>${esc(x.name)}</b></button>
      <div class="fdbody"><div class="fdl"><div class="crvtxt" data-fdnote="${x.id}" data-city="${esc(지금.city)}">${esc(x.note)}</div></div>
        ${x.photo ? `<img class="fdph" src="${esc(x.photo)}" alt="" loading="lazy" data-fdnote="${x.id}" data-city="${esc(지금.city)}" onerror="this.remove()">` : ''}</div>
      <div class="crvact"><button type="button" class="crvrep" data-fdnote="${x.id}" data-city="${esc(지금.city)}"
        aria-label="답글${x.n_reply ? ` ${x.n_reply}개` : ' 달기'}">${말풍선}<span class="num">${x.n_reply || ''}</span></button>
        <span class="crvwhen">${esc(언제(x.created_at))}</span></div>
    </div>`).join('') : '<div class="empty">아직 추천 글이 없어요.</div>') +
    (글없음 ? `<div class="crvnone">글 없이 추천만 ${글없음}명</div>` : '');
}

/* ── 맛집: 추천 글 하나 + 답글(b866) ────────────────────────────────── */
async function 추천하나그리기(지금, 이번){
  const [r, rp] = await Promise.all([
    netTimeout(sb.rpc('food_note_one', { p_id: 지금.id })),
    netTimeout(sb.rpc('food_replies_list', { p_id: 지금.id })),
  ]);
  if (이번 !== 차례) return;
  const x = r?.data?.[0];
  if (!r || r.error || rp?.error){ $('crvbody').innerHTML = '<div class="empty">지금은 불러올 수 없어요.</div>'; return; }
  if (!x){ $('crvbody').innerHTML = '<div class="empty">지워졌거나 볼 수 없는 추천 글이에요.</div>';
           $('crvinp').classList.add('hide'); $('crvmenu').classList.add('hide'); return; }
  지금.글 = x.note; 지금.주인 = x.user_id; 지금.city = x.city_id; 지금.사진 = x.photo || null;
  const c = cities.find(z => z.id === x.city_id);
  const 답글 = rp.data || [];
  $('crvbody').innerHTML = `
    <div class="crvtop">
      <div class="l">
        <button class="ghost crvwho sm" data-person="${esc(x.user_id)}">${사진(x.avatar_url, x.user_id, x.name, 22)}<span>${esc(x.name)}</span></button>
        <h3 class="crvcity">${esc(x.shop)}</h3>
        <div class="m"><span data-crvcity="${esc(x.city_id)}">${esc(c?.name || '')}</span> 맛집 추천 · ${esc(언제(x.created_at))}</div>
      </div>
      ${/* 오른쪽 위 도시 사진은 뺌(b871, 사용자: 「우상단에 후쿠오카 사진은 안뜨는게 나은듯」 — 음식 사진과 겹쳐 보임). 도시 이름은 아래 줄이 누르면 도시로 */''}
    </div>
    ${x.photo ? `<img class="fdbig" src="${esc(x.photo)}" alt="" data-fdbig onerror="this.remove()">` : ''}
    <div class="crvbig">${esc(x.note)}</div>
    <div class="crvgap"></div>
    <div class="crvhd2"><span>답글 ${답글.length}개</span></div>
    ${답글.length ? 답글.map(p => `
      <div class="crpline">
        <button class="ghost" data-person="${esc(p.user_id)}" aria-label="${esc(p.name)} 프로필">${사진(p.avatar_url, p.user_id, p.name, 32)}</button>
        <div class="b">
          <div class="n"><b data-person="${esc(p.user_id)}">${esc(p.name)}</b><small>${esc(언제(p.created_at))}</small></div>
          <div class="x">${esc(p.body)}</div>
          <div class="f">
            ${ctx.me() && p.user_id !== ctx.me()?.id ? `<button type="button" class="ghost crpto" data-crpto="${esc(p.user_id)}" data-name="${esc(p.name)}">답글 달기</button>` : ''}
            <button type="button" class="ghost crpmore" data-crpmore="${p.id}" data-uid="${esc(p.user_id)}"
                    data-txt="${esc(p.body)}" aria-label="더 보기">⋯</button>
          </div>
        </div>
      </div>`).join('') : '<div class="crvnone">첫 답글을 남겨 보세요. 궁금한 걸 물어봐도 좋아요.</div>'}`;
}

/* ── 누르기 — 도시 화면 줄과 후기 화면 둘 다 ───────────────────────────── */
document.addEventListener('click', async e => {
  const 좋 = e.target.closest('[data-crvlike]');
  if (좋){ e.preventDefault(); return 후기좋아요(좋); }
  const rl = e.target.closest('[data-crplike]');
  if (rl){ e.preventDefault(); return 답글좋아요(rl); }
  const 열 = e.target.closest('[data-crvopen]');
  if (열){ e.preventDefault(); return openCityRev(열.dataset.crva, 열.dataset.crvc, { 쓰기: 열.classList.contains('crvrep') && !!ctx.me() }); }
  const 다 = e.target.closest('[data-crvall]');
  if (다){ e.preventDefault(); return openCityRevs(다.dataset.crvall); }
  /* 맛집 답글(b866) — 도시 화면 맛집 줄(cmtask.js)·가게 글 모음 둘 다 */
  const 맛글 = e.target.closest('[data-fdnote]');
  if (맛글){ e.preventDefault(); return openFoodNote(맛글.dataset.fdnote, 맛글.dataset.city, { 쓰기: 맛글.classList.contains('crvrep') && !!ctx.me() }); }
  const 맛가게 = e.target.closest('[data-fdshop]');
  if (맛가게){ e.preventDefault(); return openFoodShop(맛가게.dataset.city, 맛가게.dataset.fdshop); }
  if (e.target.closest('[data-crvjump]')){       /* 도시 화면 평균 밑 「후기 N」 → 후기 칸으로 */
    e.preventDefault(); $('cv_comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (!$('crvview') || $('crvview').classList.contains('hide') || !$('crvview').contains(e.target)) return;
  /* 아래는 후기 화면 안에서만 */
  const 지금 = 겹[겹.length - 1];
  if (e.target.closest('#crvback')) return closeCityRev();
  const 사람 = e.target.closest('[data-person]');
  if (사람) return ctx.openPerson(사람.dataset.person);
  if (e.target.closest('[data-crvsort]')){ 지금.정렬 = 지금.정렬 === 'new' ? 'like' : 'new'; return 그리기(); }
  const 도시 = e.target.closest('[data-crvcity]');
  if (도시) return 도시로(도시.dataset.crvcity);
  if (e.target.closest('#crv_send')) return 등록();
  if (e.target.closest('#crvmenu')){
    메뉴대상 = 지금.판 === 'fn'
      ? { 종류: 'fn', a: 지금.주인, city: 지금.city, uid: 지금.주인, 글: 지금.글 || '', id: 지금.id, 사진: 지금.사진 }
      : { 종류: 'rv', a: 지금.a, city: 지금.city, uid: 지금.a, 글: 지금.글 || '' };
    return 메뉴열기();
  }
  if (e.target.closest('[data-fdbig]')) return openPhotos([e.target.closest('[data-fdbig]').src], 0);
  const 답 = e.target.closest('[data-crpto]');
  if (답){   /* 답글 달기(b869) — 칸에 「@이름 」을 넣고 커서 */
    지금.대상 = { id: 답.dataset.crpto, name: 답.dataset.name };
    const i = $('crv_in'); i.value = `@${답.dataset.name} `; 등록칠(); i.focus(); i.setSelectionRange?.(i.value.length, i.value.length);
    return;
  }
  const 더 = e.target.closest('[data-crpmore]');
  if (더){
    메뉴대상 = { 종류: 지금.판 === 'fn' ? 'fp' : 'rp', id: Number(더.dataset.crpmore), uid: 더.dataset.uid, 글: 더.dataset.txt,
               a: 지금.판 === 'fn' ? 지금.주인 : 지금.a, city: 지금.city };
    return 메뉴열기();
  }
});

/* 도시 화면으로 — 후기 겹을 다 걷고(history 도 겹 수만큼) 그 도시를 엽니다. 이미 그 도시면 걷기만.
   ⚠ history.go(-n) 은 popstate 를 «한 번» 부릅니다 — 그때 closeCityRev(true) 가 갈도시를 보고 다 걷습니다.
     여기서 겹을 먼저 비우면 popstate 사슬이 후기 화면을 지나쳐 도시 화면을 닫아 버립니다. */
let 갈도시 = null;
function 도시로(city){
  갈도시 = city;
  history.go(-겹.length);
}

async function 후기좋아요(b){
  if (!ctx.me()){ toast('로그인하면 좋아요를 누를 수 있어요'); return; }
  if (b.disabled) return;
  const on = !b.classList.contains('on');
  const 수칸 = b.querySelector('.num'), 전수 = Number(수칸.textContent || 0);
  칠하기(b, on, 전수 + (on ? 1 : -1));
  const r = await netTimeout(sb.rpc('review_like', { p_author: b.dataset.crva, p_city: b.dataset.crvc, p_on: on }));
  if (!r || r.error){ 칠하기(b, !on, 전수); toast(r?.error?.message || '연결을 확인해 주세요'); return; }
  /* 같은 후기의 하트가 화면에 둘일 수 있습니다(도시 화면 줄 + 후기 화면) — 다 맞춥니다 */
  document.querySelectorAll(`[data-crvlike][data-crva="${CSS.escape(b.dataset.crva)}"][data-crvc="${CSS.escape(b.dataset.crvc)}"]`)
    .forEach(x => 칠하기(x, on, r.data));
  바뀜 = true;
}
async function 답글좋아요(b){
  if (!ctx.me()){ toast('로그인하면 좋아요를 누를 수 있어요'); return; }
  if (b.disabled) return;
  const on = !b.classList.contains('on');
  const 수칸 = b.querySelector('.num'), 전수 = Number(수칸.textContent || 0);
  칠하기(b, on, 전수 + (on ? 1 : -1));
  const r = await netTimeout(sb.rpc('reply_like', { p_id: Number(b.dataset.crplike), p_on: on }));
  if (!r || r.error){ 칠하기(b, !on, 전수); toast(r?.error?.message || '연결을 확인해 주세요'); return; }
  칠하기(b, on, r.data);
}
function 칠하기(b, on, n){
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.querySelector('.crvic')?.classList.toggle('on', on);
  b.querySelector('.num').textContent = n > 0 ? String(n) : '';
}

/* ── 답글 쓰기 ─────────────────────────────────────────────────────── */
function 등록칠(){ $('crv_send')?.classList.toggle('on', !!$('crv_in')?.value.trim()); }
$('crv_in')?.addEventListener('input', 등록칠);
$('crv_in')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing){ e.preventDefault(); 등록(); }
});
let 보내는중 = false;
async function 등록(){
  const 지금 = 겹[겹.length - 1];
  const 글 = $('crv_in').value.trim();
  if (!글 || 보내는중 || (지금?.판 !== 'one' && 지금?.판 !== 'fn')) return;
  보내는중 = true; $('crv_send').disabled = true;
  /* 답글에 답하기(b869, A안) — 「@이름 」으로 시작하면 그 사람에게도 알림(p_to). 글을 지워 @이 사라졌으면 안 보냅니다. */
  const 대상 = 지금.대상 && 글.startsWith('@' + 지금.대상.name) ? 지금.대상.id : null;
  const r = 지금.판 === 'fn'
    ? await netTimeout(sb.rpc('food_reply_add', { p_id: 지금.id, p_body: 글, ...(대상 ? { p_to: 대상 } : {}) }))
    : await netTimeout(sb.rpc('review_reply_add', { p_author: 지금.a, p_city: 지금.city, p_body: 글, ...(대상 ? { p_to: 대상 } : {}) }));
  보내는중 = false; $('crv_send').disabled = false;
  if (!r || r.error){ toast(r?.error?.message || '연결을 확인해 주세요'); return; }
  $('crv_in').value = ''; 등록칠(); $('crv_in').blur(); 지금.대상 = null;
  바뀜 = true;
  지금.정렬 = 'new';         /* 방금 쓴 것이 보이게 */
  await (지금.판 === 'fn' ? 추천하나그리기 : 하나그리기)(지금, ++차례);
  const 끝 = $('crvbody'); 끝.scrollTop = 끝.scrollHeight;
}

/* ── ⋯ 메뉴: 신고 · 지우기 · 고치기 ──────────────────────────────────── */
function 메뉴열기(){
  const 나 = ctx.me()?.id, m = 메뉴대상;
  const 내글 = m.uid === 나;
  const 내후기 = m.a === 나;
  /* 'fn'(내 맛집 추천 글)의 「고치기」는 도시 화면 그 줄의 「수정」으로 보냅니다(b866 검토 — 안 그러면 내 글 ⋯ 이 「닫기」뿐). */
  $('crvsheet_edit').classList.toggle('hide', !((m.종류 === 'rv' || m.종류 === 'fn') && 내글));
  $('crvsheet_edit').textContent = m.종류 === 'fn' ? '내 추천 글 고치기' : '내 한줄평 고치기';
  $('crvsheet_del').classList.toggle('hide', !((m.종류 === 'rp' || m.종류 === 'fp') && (내글 || 내후기)));
  $('crvsheet_repbtn').classList.toggle('hide', 내글 || !나);
  $('crvsheet_main').classList.remove('hide');
  $('crvsheet_rep').classList.add('hide');
  $('crvsheet').classList.remove('hide');
}
$('crvsheet')?.addEventListener('click', async e => {
  const 시트 = $('crvsheet');
  if (e.target.closest('[data-rs="close"]')){ 시트.classList.add('hide'); return; }
  const b = e.target.closest('[data-rs]'); if (!b || !메뉴대상) return;
  const m = 메뉴대상;
  if (b.dataset.rs === 'edit'){
    시트.classList.add('hide');
    도시로(m.city);
    if (m.종류 === 'fn'){   /* 내 맛집 추천 글 → 도시 화면 그 줄의 「수정」(맛집 칸은 늦게 오니 넉넉히) */
      setTimeout(() => { const 고 = document.querySelector('#cv_foods [data-fdedit]'); 고?.scrollIntoView({ block: 'center' }); 고?.click(); }, 1200);
      return;
    }
    setTimeout(() => { if ($('cv_mine')?.classList.contains('hide') === false) $('cv_mineedit')?.click();   /* 한 줄로 접혀 있으면 칸부터 엶(b862) */
      const n = $('cv_note'); if (n){ n.scrollIntoView({ block: 'center' }); n.focus(); } }, 500);
  } else if (b.dataset.rs === 'del'){
    if (b.dataset.armed !== '1'){ arm(b, '한 번 더 누르면 지워요'); return; }
    시트.classList.add('hide');
    const r = await netTimeout(sb.rpc(m.종류 === 'fp' ? 'food_reply_del' : 'review_reply_del', { p_id: m.id }));
    if (!r || r.error){ toast(r?.error?.message || '연결을 확인해 주세요'); return; }
    toast('답글을 지웠어요'); 바뀜 = true;
    const 지금 = 겹[겹.length - 1];
    if (지금?.판 === 'one') 하나그리기(지금, ++차례);
    else if (지금?.판 === 'fn') 추천하나그리기(지금, ++차례);
  } else if (b.dataset.rs === 'report'){
    $('crvsheet_main').classList.add('hide');
    $('crvsheet_rep').classList.remove('hide');
  } else if (b.dataset.rs === 'reason'){
    시트.classList.add('hide');
    const 도시 = cities.find(c => c.id === m.city)?.name || m.city;
    const 더 = `[${({ rv: '한줄평', rp: '답글', fn: '맛집 추천 글', fp: '맛집 답글' })[m.종류] || '답글'} · ${도시}] ${m.글}`.slice(0, 500);
    /* 사진이 있는 맛집 추천 글은 사진 신고로(b870, 사용자: 「사진은 신고 들어오면 일단 바로 내리자」) — 서버가 바로 숨기고 신고 목록에 남깁니다 */
    const 사진신고 = m.종류 === 'fn' && m.사진;
    const r = 사진신고
      ? await netTimeout(sb.rpc('food_photo_report', { p_id: m.id, p_reason: b.dataset.r }))
      : await netTimeout(sb.rpc('report_user', { p_user: m.uid, p_reason: b.dataset.r, p_detail: 더 }));
    toast(!r || r.error ? (r?.error?.message || '연결을 확인해 주세요') : 사진신고 ? '신고했어요. 사진은 바로 내렸어요' : '신고했어요. 살펴볼게요');
    if (사진신고 && r && !r.error){ 바뀜 = true; const 지금 = 겹[겹.length - 1]; if (지금?.판 === 'fn') 추천하나그리기(지금, ++차례); }
  }
});
