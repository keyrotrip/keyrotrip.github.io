/* ── 방명록 (2026-10-16, db/138 · 사용자: 보관함 빈 칸 → 「방명록으로 가자」 · 「비밀 댓글도 가능하게」) ─────────
 *
 * 두 자리에서 같은 그림을 씁니다:
 *   ① 사람 화면(people.js) 머리 「방명록」 단추 → 들어간 판 — 남의 방명록: 쓰기 칸 + 목록 / 내 사람 화면이면 목록만
 *   ② 보관함 → 방명록(shelf.js) — 내 방명록: 목록 + 글마다 한 줄 답 · 지우기 · 신고
 * 정한 것(사용자): 쓰기는 그 사람 화면을 볼 수 있는 사람 · 보기는 그 화면을 보는 사람 모두 ·
 *   비밀 글은 주인과 쓴 사람만(남에게는 «비밀 글이에요» 자리만) · 답은 주인만 한 줄.
 * ⚠ 비밀 글을 거르는 곳은 **서버**입니다(guestbook_list 가 본문·이름을 null 로 줌). 여기는 받은 대로 그립니다.
 * ⚠ 내 글엔 내 반응 없음(메모 own-content-actions): 내가 쓴 글에는 «신고»가 없고 «지우기»만.
 * ⚠ 지우기는 두 번 눌러야(첫 번에 «정말 지우기»로 바뀜 — 맛집 내 글 삭제와 같음, b866).
 * 층: dom · net · guestdata(서버) · cityrev(«2일 전»). 사람 열기는 ctx 로 받습니다(people.js 를 읽으면 고리). */
import { $, esc, toast, avatarImg, emptyDo } from './dom.js?v=b887';
import { netTimeout } from './net.js?v=b887';
import { 방명록읽기, 내방명록숫자, 방명록쓰기, 방명록답, 방명록지우기, 방명록신고 } from './guestdata.js?v=b887';
import { 언제 } from './cityrev.js?v=b887';
import { 이름먼저 } from './nameask.js?v=b887';   /* 이름이 남에게 처음 보일 때 「이름을 정하고 남길까요?」(2026-10-16) */

let ctx = { me: () => null, openPerson: () => {} };
export function setGuestCtx(o){ ctx = { ...ctx, ...o }; }

const 글상한 = 200, 답상한 = 100;
/* 내 방명록이 바뀌면(답·지우기·신고) 보관함 칸 숫자도 — home.js 가 처음 세는 것과 같은 함수 */
const 숫자다시 = () => 내방명록숫자().then(r => { const el = $('s_guest'); if (el && !r.error) el.textContent = r.data?.[0]?.total ?? 0; }, () => {});
/* 신고 사유 — 사람 신고(db/101 people_reports)의 다섯 가지 중 방명록에 맞는 셋 */
const 사유들 = ['욕설·괴롭힘', '스팸·광고', '기타'];

const 얼굴 = (url, id, 이름) => avatarImg(url, id, 이름,
  'width:28px;height:28px;border-radius:50%;object-fit:cover;flex:none', 'thumb');

/* 한 글 */
function 줄(x, 주인이름){
  if (x.secret && x.body == null){
    /* 남에게 보이는 비밀 글 — 누가 썼는지도 안 보입니다(서버가 비워 줌) */
    return `<div class="gbrow gblock" data-gbid="${x.id}"><span class="gblockic" aria-hidden="true">🔒</span>
      <span>비밀 글이에요</span><em>${esc(언제(x.created_at))}</em></div>`;
  }
  const 이름 = x.name || '여행자';
  const 표 = [x.secret ? '<span class="gbtag">비밀</span>' : '',
              x.hidden ? '<span class="gbtag hid">신고로 가려짐</span>' : ''].join('');
  const 단추 = [];
  if (x.owner_me) 단추.push(`<button type="button" data-gbact="reply">${x.reply ? '답 고치기' : '답 달기'}</button>`);
  if (x.owner_me || x.mine) 단추.push(`<button type="button" data-gbact="del">지우기</button>`);
  if (!x.mine && !x.hidden) 단추.push(`<button type="button" data-gbact="report">신고</button>`);
  return `<div class="gbrow" data-gbid="${x.id}" data-gbreply="${esc(x.reply || '')}">
    <div class="gbwho"><span class="gbface" data-gbperson="${esc(x.author || '')}">${얼굴(x.avatar_url, x.author, 이름)}</span>
      <b data-gbperson="${esc(x.author || '')}">${esc(이름)}</b>${표}<em>${esc(언제(x.created_at))}</em></div>
    <div class="gbbody">${esc(x.body || '')}</div>
    ${x.reply ? `<div class="gbreply"><b>${esc(x.owner_me ? '나' : 주인이름)}</b>${esc(x.reply)}</div>` : ''}
    ${단추.length ? `<div class="gbacts">${단추.join('')}</div>` : ''}
    <div class="gbmore"></div>
  </div>`;
}

/* 칸 하나를 (다시) 채웁니다. 칸의 data-* 에 주인·모드가 적혀 있습니다. */
async function 채우기(칸){
  const 주인 = 칸.dataset.gbowner, 내것 = 칸.dataset.gbself === '1', 보관함 = 칸.dataset.gbshelf === '1';
  const 목록칸 = 칸.querySelector('.gblist');
  const r = await netTimeout(방명록읽기(주인));
  if (!칸.isConnected) return;                 /* 그사이 다른 화면으로 갔습니다 */
  if (!r || r.error){
    목록칸.innerHTML = `<div class="empty">방명록을 못 불러왔어요.<br><span class="memo">${esc(r?.error?.message || '연결을 확인해 주세요')}</span></div>`;
    return;
  }
  const 글들 = r.data || [];
  const 수 = 글들.filter(x => !x.hidden).length;
  /* 들어간 판이면 머리(.whosubhd)가 칸 바로 앞에 따로 있습니다(방명록칸 판:true) */
  const 수칸 = 칸.querySelector('.gbcount') || 칸.previousElementSibling?.querySelector?.('.gbcount');
  if (수칸) 수칸.textContent = 수 ? `${수}개` : '';
  if (보관함 && $('shelfcount')){
    const 기다림 = 글들.filter(x => !x.hidden && x.owner_me && !x.reply && x.body != null).length;
    $('shelfcount').textContent = 수 ? `${수}개${기다림 ? ` · 답 기다리는 글 ${기다림}` : ''}` : '';
  }
  if (!글들.length){
    목록칸.innerHTML = 내것
      ? emptyDo('아직 방명록이 없어요.', null, null, '친구가 내 화면에서 한마디 남기면 여기 모여요.')
      : `<div class="gbempty">첫 방명록을 남겨 보세요.</div>`;
    return;
  }
  목록칸.innerHTML = 글들.map(x => 줄(x, 칸.dataset.gbname || '주인')).join('');
}

/* ① 사람 화면 — 칸 HTML 을 돌려주고, 붙인 뒤 `방명록채우기` 를 부릅니다. */
export function 방명록칸(주인, { self = false, 이름 = '', 판 = false } = {}){
  /* 판: 사람 화면의 들어간 판으로 열 때 — 머리를 다른 판(people.js 판머리)과 같은 모양으로 */
  const 머리 = 판 ? `<div class="whosubhd"><h2>방명록 <span class="gbcount memo"></span></h2></div>`
                  : `<div class="gbhd"><b>방명록</b><span class="gbcount memo"></span></div>`;
  return `${판 ? 머리 : ''}<div class="card gbbox" id="whogb" data-gbowner="${esc(주인)}" data-gbself="${self ? 1 : 0}" data-gbname="${esc(이름)}">
    ${판 ? '' : 머리}
    ${self ? '' : `<div class="gbwrite">
      <textarea class="gbin" rows="2" maxlength="${글상한}" placeholder="${esc(이름 || '이 사람')}님에게 한마디 남겨요"></textarea>
      <div class="gbbar"><label class="gbsecret"><input type="checkbox" class="gbsec"> <span aria-hidden="true">🔒</span> 비밀 글</label>
        <span class="gbn memo">0/${글상한}</span>
        <button type="button" class="primary small" data-gbact="send">남기기</button></div>
    </div>`}
    <div class="gblist"><div class="empty"><span class="load">방명록을 여는 중…</span></div></div>
  </div>`;
}
export function 방명록채우기(){ const 칸 = $('whogb'); if (칸) return 채우기(칸); }

/* ② 보관함 → 방명록(shelf.js 가 부름) — #shelflist 에 내 방명록 */
export function openGuestbookShelf(){
  const me = ctx.me(); if (!me) return;
  $('shelflist').innerHTML = `<div class="gbbox gbshelf" data-gbowner="${esc(me.id)}" data-gbself="1" data-gbshelf="1">
    <div class="gblist"><div class="empty"><span class="load">방명록을 여는 중…</span></div></div></div>`;
  return 채우기($('shelflist').querySelector('.gbbox'));
}

/* ── 누르기 · 쓰기 ─────────────────────────────────────────────────────── */
async function 부르기(약속, 성공말){
  const r = await netTimeout(약속);
  if (!r || r.error){ toast(r?.error?.message || '연결을 확인해 주세요'); return false; }
  if (성공말) toast(성공말);
  return true;
}

if (typeof document !== 'undefined'){
  document.addEventListener('input', e => {
    const t = e.target.closest?.('.gbin'); if (!t) return;
    const n = t.closest('.gbbox')?.querySelector('.gbn');
    if (n) n.textContent = `${t.value.length}/${글상한}`;
  });

  document.addEventListener('click', async e => {
    const 칸 = e.target.closest?.('.gbbox'); if (!칸) return;
    const 사람 = e.target.closest('[data-gbperson]');
    if (사람 && 사람.dataset.gbperson) return ctx.openPerson(사람.dataset.gbperson);
    const b = e.target.closest('[data-gbact]'); if (!b) return;
    const 행 = b.closest('.gbrow'), id = 행 ? Number(행.dataset.gbid) : null;
    const 더 = 행?.querySelector('.gbmore');
    const 할일 = b.dataset.gbact;

    if (할일 === 'send'){
      const 입력 = 칸.querySelector('.gbin'), 글 = (입력?.value || '').trim();
      if (!글) return toast('남길 말을 적어 주세요');
      b.disabled = true;
      await 이름먼저();
      const 됨 = await 부르기(방명록쓰기(칸.dataset.gbowner, 글, 칸.querySelector('.gbsec')?.checked), '방명록을 남겼어요');
      b.disabled = false;
      if (!됨) return;
      입력.value = ''; const 비 = 칸.querySelector('.gbsec'); if (비) 비.checked = false;
      const n = 칸.querySelector('.gbn'); if (n) n.textContent = `0/${글상한}`;
      return 채우기(칸);
    }
    if (할일 === 'reply'){
      더.innerHTML = `<div class="gbedit"><input class="gbrin" maxlength="${답상한}" placeholder="한 줄 답 남기기"
          value="${esc(행.dataset.gbreply || '')}">
        <button type="button" class="primary small" data-gbact="replysave">저장</button>
        <button type="button" class="ghost small" data-gbact="close">취소</button></div>`;
      return 더.querySelector('.gbrin')?.focus();
    }
    if (할일 === 'replysave'){
      const 답 = (더.querySelector('.gbrin')?.value || '').trim();
      b.disabled = true;
      const 됨 = await 부르기(방명록답(id, 답), 답 ? '답을 달았어요' : '답을 지웠어요');
      b.disabled = false;
      if (됨){ 숫자다시(); return 채우기(칸); }
      return;
    }
    if (할일 === 'close'){ 더.innerHTML = ''; return; }
    if (할일 === 'del'){
      /* 두 번 눌러야 지웁니다 — 첫 번에 글자가 바뀝니다 */
      if (!b.dataset.sure){ b.dataset.sure = '1'; b.textContent = '정말 지우기'; b.classList.add('danger'); return; }
      const 됨 = await 부르기(방명록지우기(id), '지웠어요');
      if (됨){ 숫자다시(); return 채우기(칸); }
      return;
    }
    if (할일 === 'report'){
      더.innerHTML = `<div class="gbreasons"><span class="memo">신고하면 이 글이 바로 가려지고 관리자가 봐요</span>
        ${사유들.map(r => `<button type="button" class="ghost small" data-gbact="reason" data-r="${esc(r)}">${esc(r)}</button>`).join('')}
        <button type="button" class="ghost small" data-gbact="close">취소</button></div>`;
      return;
    }
    if (할일 === 'reason'){
      b.disabled = true;
      const 됨 = await 부르기(방명록신고(id, b.dataset.r), '신고했어요. 글을 가렸어요');
      if (됨){ 숫자다시(); return 채우기(칸); }
      b.disabled = false;
    }
  });
}

