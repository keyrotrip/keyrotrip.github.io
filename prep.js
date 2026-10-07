/* ── 여행 준비 — 예약 · 서류 · 준비물 · 링크 ──────────────────────────
 * 여행 전에 챙겨두고 여행 중에 꺼내 보는 것 넷입니다. 하는 일은 다르지만
 * 모양이 같습니다: 목록을 받아와 그리고, 한 줄 더하고, 지웁니다.
 *
 * ── app.js 에서 떼어낸 아홉 번째 조각입니다(b336) ────────────────────
 * **딸린 것이 하나도 없습니다.** app.js 만 아는 이름을 한 개도 안 씁니다 —
 * 여덟 조각 중 처음입니다. ctx 도 setPrepCtx 도 없습니다. 그래서 골랐습니다.
 * 넷을 따로 뗄 수도 있었지만 한 파일에 둡니다. `softDel` 을 넷이 같이 쓰고,
 * 넷 다 여행 상세의 같은 탭 안에 있습니다. 나누면 같은 코드가 네 벌 됩니다.
 *
 * 밖으로 나가는 길은 넷뿐입니다 — loadBookings · loadPacking · loadLinks ·
 * closeDocs. 서류는 시트로 열리므로 닫는 길만 밖에서 필요합니다.
 *
 * 층: dom.js · db.js · net.js · calc.js · trip.js · ui.js 만 씁니다. */
import { $, esc, toast, emptyDo } from './dom.js?v=b830';
import { sb } from './db.js?v=b830';
import { fail, netTimeout, offNote, drawOffbar, cacheGet, cacheSet, NOROW } from './net.js?v=b830';
import { hm } from './calc.js?v=b830';
import { trip, bookings, setBookings, members, nameOf } from './trip.js?v=b830';
import { arm } from './ui.js?v=b830';

/* ── 예약 ───────────────────────────────────────────────────────────
 * 여행 중에 제일 자주 열어보는 것입니다 — 항공편 번호, 숙소 예약번호.
 * 읽기 전용 공유 링크에는 절대 안 나갑니다 (get_shared_trip 에 아예 없습니다). */
const KIND_K = { 항공:'이동', 기차:'이동', 렌터카:'이동', 숙소:'숙소',
                 식당:'식사', 티켓:'관광', 기타:'기타' };

export async function loadBookings(){
  $('bookerr').classList.add('hide');
  const 그여행 = trip.id;          /* 늦은 답 막기(b799) — tripview.js 의 loadPlans 머리말 */
  let { data, error } = await netTimeout(sb.from('bookings')
    .select('id,kind,title,ref,start_date,start_time,end_date,end_time,address,tel,memo')
    .eq('trip_id', 그여행).is('deleted_at', null)
    .order('start_date', { nullsFirst:false }).order('start_time', { nullsFirst:false }));
  if (trip?.id !== 그여행) return;
  /* 항공편 번호와 호텔 예약번호는 **여행 중에 제일 자주 여는 것**입니다.
     공항에서 연결이 안 된다고 못 보면 그때가 제일 곤란합니다. 받아둡니다. */
  const bck = 'book:' + 그여행;
  if (error){
    const old = cacheGet(bck);
    if (!old){ offNote('bookings'); drawOffbar(); return; }
    setBookings(old); drawOffbar();
  } else { cacheSet(bck, data); setBookings(data); }
  data = bookings;

  $('bookings').innerHTML = data.length ? data.map(b => {
    const k = 'k-' + (KIND_K[b.kind] || '기타');
    const when = [b.start_date, hm(b.start_time)].filter(Boolean).join(' ') +
      (b.end_date && b.end_date !== b.start_date
        ? ' ~ ' + b.end_date + (b.end_time ? ' ' + hm(b.end_time) : '')
        : b.end_time ? '~' + hm(b.end_time) : '');
    const sub = [when, b.address, b.tel, b.memo].filter(Boolean).join(' · ');
    return `<div class="plan">
      <span class="kdot ${esc(k)}"></span>
      <div class="body"><b>${esc(b.title)}</b>
        <span class="ktag ${esc(k)}">${esc(b.kind)}</span>
        ${b.ref ? `<span class="refno">${esc(b.ref)}</span>` : ''}
        ${sub ? `<span class="memo">${esc(sub)}</span>` : ''}</div>
      ${trip.myRole === 'viewer' ? '' :
        `<button class="ghost" aria-label="지우기" data-bact="del" data-id="${esc(b.id)}"
                 style="color:var(--bad); align-self:start; padding:2px 6px">×</button>`}</div>`;
  }).join('')
    /* 예약은 `추가` 를 눌러야 폼이 열립니다 — 숨어 있으니 단추를 답니다.
       ⚠ 보기 전용 일행에게는 안 답니다(b799) — 저장이 막혀 있어 눌러도 실패합니다. */
    : trip.myRole === 'viewer'
      ? emptyDo('아직 넣어둔 예약이 없어요.', null, null, '일행이 넣으면 여기에 모여요.')
      : emptyDo('아직 넣어둔 예약이 없어요.', '첫 예약 넣기', 'addbookbtn',
                '항공권·숙소를 넣어두면 여행 중에 찾기 쉬워요.');
}

/* ── 여행 서류 ──────────────────────────────────────────────────────
 * 공항 카운터·호텔 프런트에서 여는 화면입니다. **이미 받아둔 예약만
 * 그립니다** — 여기서 새로 질의하면 로밍이 안 되는 그 순간에 빈 화면이
 * 됩니다. 예약은 `loadBookings` 가 `book:<여행>` 으로 담아두므로
 * 비행기모드에서 앱을 켜도 그대로 나옵니다.
 *
 * 준비 탭 목록과 **같은 자료를 다르게 보여줍니다.** 목록은 훑는 것이고
 * 여기는 한 건을 보여주는 것입니다 — 그래서 예약번호가 제일 큽니다. */
const DOC_LABEL = { 항공:'항공권', 숙소:'숙소', 식당:'식당', 티켓:'티켓', 기타:'예약' };

function drawDocs(){
  const list = bookings || [];
  $('docsub').textContent = list.length ? `${list.length}건 · 연결 없이도 보여요`
                                        : '연결 없이도 보여요';
  if (!list.length){
    $('docs').innerHTML =
      '<div class="empty">넣어둔 예약이 없어요. 준비 탭에서 항공권·숙소를 넣어두면 ' +
      '공항에서 연결이 안 돼도 여기서 볼 수 있어요.</div>';
    return;
  }
  const 줄 = (k, v, href) => v
    ? `<div class="dl"><b>${esc(k)}</b><span>${
        href ? `<a href="${esc(href)}">${esc(v)}</a>` : esc(v)}</span></div>` : '';

  $('docs').innerHTML = list.map(b => {
    /* 날짜와 시각을 한 줄로 붙이면 훑을 때는 편한데 확인할 때는 어디가
       시작이고 끝인지 헷갈립니다. 여기서는 갈라 적습니다. */
    const 시작 = [b.start_date, hm(b.start_time)].filter(Boolean).join(' ');
    const 끝   = [b.end_date, hm(b.end_time)].filter(Boolean).join(' ');
    return `<div class="doccard">
      <div class="dk">${esc(DOC_LABEL[b.kind] || b.kind)}</div>
      <div class="dt">${esc(b.title)}</div>
      ${b.ref ? `<button class="dref" data-copy="${esc(b.ref)}">${esc(b.ref)}</button>` : ''}
      ${줄(b.kind === '숙소' ? '체크인' : '시작', 시작)}
      ${끝 && 끝 !== 시작 ? 줄(b.kind === '숙소' ? '체크아웃' : '끝', 끝) : ''}
      ${줄('주소', b.address)}
      ${줄('전화', b.tel, b.tel ? 'tel:' + String(b.tel).replace(/[^\d+]/g, '') : '')}
      ${줄('메모', b.memo)}
    </div>`;
  }).join('');
}

function openDocs(){
  $('docview').classList.remove('hide');
  scrollTo(0, 0);
  if (history.state?.t2 !== 'docs') history.pushState({ t2:'docs' }, '');
  drawDocs();
}
export function closeDocs(fromPop){
  if (!fromPop && history.state?.t2 === 'docs'){ history.back(); return; }
  $('docview').classList.add('hide');
}
$('docbtn').addEventListener('click', openDocs);
$('docback').addEventListener('click', () => closeDocs());

/* 예약번호는 옮겨 적다 틀리는 자리입니다. 눌러서 베낍니다. */
$('docs').addEventListener('click', async e => {
  const b = e.target.closest('[data-copy]'); if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); toast('예약번호를 베꼈어요'); }
  catch { toast('길게 눌러서 복사해 주세요'); }
});

$('addbookbtn').addEventListener('click', () => {
  $('bookcard').classList.toggle('hide');
  if ($('bookcard').classList.contains('hide')) return;
  if (!$('b_sdate').value) $('b_sdate').value = trip.start_date;
  $('b_title').focus();
});
$('b_cancel').addEventListener('click', () => {
  $('bookcard').classList.add('hide'); $('bookformerr').classList.add('hide');
});

$('b_create').addEventListener('click', async () => {
  const btn = $('b_create');
  $('bookformerr').classList.add('hide');
  const title = $('b_title').value.trim();
  if (!title) return fail('무엇을 예약했는지 적어주세요.', 'bookform');

  btn.disabled = true; btn.innerHTML = '<span class="load">넣는 중…</span>';
  const { data, error } = await sb.from('bookings').insert({
    trip_id: trip.id, kind: $('b_kind').value, title,
    ref: $('b_ref').value.trim() || null,
    start_date: $('b_sdate').value || null, start_time: $('b_stime').value || null,
    end_date: $('b_edate').value || null,   end_time: $('b_etime').value || null,
    address: $('b_addr').value.trim() || null,
    tel: $('b_tel').value.trim() || null,
    memo: $('b_memo').value.trim() || null,
  }).select('id');
  btn.disabled = false; btn.textContent = '넣기';
  if (error) return fail(error, 'bookform');
  if (!data?.length) return fail(NOROW.save, 'bookform');

  ['b_title','b_ref','b_addr','b_tel','b_memo','b_stime','b_etime','b_edate']
    .forEach(id => $(id).value = '');
  $('bookcard').classList.add('hide');
  await loadBookings();
});

$('bookings').addEventListener('click', e => softDel(e, 'bact', 'bookings', loadBookings, 'book'));

/* ── 준비물 ─────────────────────────────────────────────────────────
 * 담당을 참여자와 이어야 "내가 챙길 것"만 볼 수 있습니다.
 * 도쿄 앱은 문자열이라 그게 안 됐습니다. */
export async function loadPacking(){
  $('packerr').classList.add('hide');
  const 그여행 = trip.id;          /* 늦은 답 막기(b799) — tripview.js 의 loadPlans 머리말 */
  let { data, error } = await netTimeout(sb.from('packing')
    .select('id,title,done,assignee_id,category')
    .eq('trip_id', 그여행).is('deleted_at', null)
    .order('sort_order').order('created_at'));
  if (trip?.id !== 그여행) return;
  const pck = 'pack:' + 그여행;
  if (error){
    const old = cacheGet(pck);
    if (!old){ offNote('packing'); $('packcount').textContent = ''; drawOffbar(); return; }
    data = old; drawOffbar();
  } else cacheSet(pck, data);

  const done = data.filter(p => p.done).length;
  $('packcount').textContent = data.length ? `${done}/${data.length}` : '';
  /* 다 채우는 맛이 있어야 계속 씁니다. */
  $('packbar').classList.toggle('hide', !data.length);
  $('packbar').firstElementChild.style.width =
    data.length ? (done / data.length * 100).toFixed(1) + '%' : '0%';

  $('k_who').innerHTML = `<option value="">담당 없음</option>` + members
    .filter(m => !m.left_at)
    .map(m => `<option value="${esc(m.user_id)}">${esc(nameOf(m.user_id))}</option>`).join('');
  if (!$('k_cat').options.length)
    $('k_cat').innerHTML = PACK_CATS.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');

  /* 빈 목록에서 하나씩 적기 시작하는 것이 제일 귀찮습니다. */
  $('k_seed').classList.toggle('hide', data.length > 0 || trip.myRole === 'viewer');

  /* 분류로 묶습니다. 스무 개가 한 줄로 늘어서면 뭘 챙겼는지 안 보입니다.
     칸은 처음부터 있었는데 화면이 안 쓰고 있었습니다. */
  const g = {};
  data.forEach(p => (g[p.category || '기타'] = g[p.category || '기타'] || []).push(p));
  const order = PACK_CATS.filter(k => g[k])
    .concat(Object.keys(g).filter(k => !PACK_CATS.includes(k)));

  $('packing').innerHTML = data.length
    ? order.map(k => `<div class="daysep">${esc(k)}
         <span class="dstat">${g[k].filter(p => p.done).length}/${g[k].length}</span></div>` +
        g[k].map(p =>
          `<div class="row"><input type="checkbox" data-pk="${esc(p.id)}"
              ${p.done ? 'checked' : ''} ${trip.myRole === 'viewer' ? 'disabled' : ''}
              style="width:auto; flex:none; margin:0">
            <span class="label"${p.done ? ' style="opacity:.45; text-decoration:line-through"' : ''}>
              ${esc(p.title)}</span>
            ${p.assignee_id ? `<span class="badge">${esc(nameOf(p.assignee_id))}</span>` : ''}
            ${trip.myRole === 'viewer' ? '' :
              `<button class="ghost" aria-label="지우기" data-kact="del" data-id="${esc(p.id)}"
                       style="color:var(--bad); padding:2px 6px">×</button>`}</div>`).join('')
      ).join('')
    /* 입력폼이 바로 아래 늘 보입니다 — 단추를 달지 않습니다. */
    : emptyDo('아직 챙길 것이 없어요.', null, null,
              '아래에 적어두면 빠뜨리지 않아요.');
}

/* 분류는 짐 싸는 순서대로 둡니다 — 없으면 못 가는 것부터. */
const PACK_CATS = ['서류', '전자기기', '옷', '세면·약', '기타'];
/* 어느 여행에나 해당하는 것만 넣습니다. 나라별로 다른 것(어댑터 모양 같은)은
   AI 에게 물어보는 편이 낫습니다. */
const PACK_SEED = [
  ['서류', ['여권', '항공권 · 탑승권', '숙소 예약 확인서', '여행자보험', '해외 되는 카드']],
  ['전자기기', ['휴대폰 충전기', '보조배터리', '멀티 어댑터', '이어폰']],
  ['옷', ['속옷 · 양말', '잠옷', '겉옷', '편한 신발']],
  ['세면·약', ['세면도구', '상비약', '자외선 차단제']],
];

$('k_seed').addEventListener('click', async () => {
  const b = $('k_seed');
  b.disabled = true; b.innerHTML = '<span class="load">넣는 중…</span>';
  const rows = PACK_SEED.flatMap(([cat, items], gi) =>
    items.map((title, i) => ({ trip_id: trip.id, category: cat, title,
                               sort_order: gi * 100 + i })));
  const r = await sb.from('packing').insert(rows).select('id');
  b.disabled = false; b.textContent = '기본 준비물 한 번에 넣기';
  if (r.error) return fail(r.error, 'pack');
  if (!r.data?.length) return fail(NOROW.save, 'pack');
  toast(`${r.data.length}개를 넣었어요`);
  await loadPacking();
});

$('k_add').addEventListener('click', async () => {
  const t = $('k_title').value.trim();
  if (!t) return;
  $('packerr').classList.add('hide');
  $('k_add').disabled = true;
  const { data, error } = await sb.from('packing').insert({
    trip_id: trip.id, title: t, assignee_id: $('k_who').value || null,
    category: $('k_cat').value || null,
  }).select('id');
  $('k_add').disabled = false;
  if (error) return fail(error, 'pack');
  if (!data?.length) return fail(NOROW.save, 'pack');
  $('k_title').value = '';
  await loadPacking();
});
$('k_title').addEventListener('keydown', e => {
  if (e.key === 'Enter'){ e.preventDefault(); $('k_add').click(); }
});
$('packing').addEventListener('change', async e => {
  const c = e.target.closest('input[data-pk]'); if (!c) return;
  const r = await sb.from('packing').update({ done: c.checked })
    .eq('id', c.dataset.pk).select('id');
  if (r.error){ c.checked = !c.checked; return fail(r.error, 'pack'); }
  await loadPacking();
});
$('packing').addEventListener('click', e => softDel(e, 'kact', 'packing', loadPacking, 'pack'));

/* ── 링크 ── 예약 확인 페이지, 블로그, 지도 같은 것 */
export async function loadLinks(){
  $('linkerr').classList.add('hide');
  const 그여행 = trip.id;          /* 늦은 답 막기(b799) — tripview.js 의 loadPlans 머리말 */
  let { data, error } = await netTimeout(sb.from('links')
    .select('id,title,url,category').eq('trip_id', 그여행)
    .is('deleted_at', null).order('created_at'));
  if (trip?.id !== 그여행) return;
  const lck = 'link:' + 그여행;
  if (error){
    const old = cacheGet(lck);
    if (!old){ offNote('links'); drawOffbar(); return; }
    data = old; drawOffbar();
  } else cacheSet(lck, data);
  $('links').innerHTML = data.length ? data.map(l =>
    `<div class="row"><span class="label">
        <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"
           style="color:var(--primary)"><b>${esc(l.title)}</b></a>
        <div class="memo" style="word-break:break-all">${esc(l.url)}</div></span>
      ${trip.myRole === 'viewer' ? '' :
        `<button class="ghost" aria-label="지우기" data-lkact="del" data-id="${esc(l.id)}"
                 style="color:var(--bad); padding:2px 6px">×</button>`}</div>`).join('')
    /* 여기도 입력폼이 늘 보입니다. */
    : emptyDo('아직 담아둔 링크가 없어요.', null, null,
              '예약 확인 페이지나 블로그를 담아두세요.');
}

$('l_add').addEventListener('click', async () => {
  const t = $('l_title').value.trim(), u = $('l_url').value.trim();
  $('linkerr').classList.add('hide');
  if (!u) return fail('주소를 넣어주세요.', 'link');
  /* http 없이 붙여넣는 일이 많습니다. 그대로 두면 앱 안 경로로 열립니다. */
  const url = /^https?:\/\//i.test(u) ? u : 'https://' + u;
  $('l_add').disabled = true;
  const { data, error } = await sb.from('links')
    .insert({ trip_id: trip.id, title: t || url, url }).select('id');
  $('l_add').disabled = false;
  if (error) return fail(error, 'link');
  if (!data?.length) return fail(NOROW.save, 'link');
  $('l_title').value = ''; $('l_url').value = '';
  await loadLinks();
});
$('l_url').addEventListener('keydown', e => {
  if (e.key === 'Enter'){ e.preventDefault(); $('l_add').click(); }
});
$('links').addEventListener('click', e => softDel(e, 'lkact', 'links', loadLinks, 'link'));

/* 세 곳이 지우는 방식이 같습니다. 한 번 묻고, 진짜로 안 지우고 숨깁니다. */
async function softDel(e, attr, table, reload, errBox){
  const b = e.target.closest(`button[data-${attr}]`); if (!b) return;
  if (b.dataset.armed !== '1'){
    arm(b, '정말 지울까요?'); return;
  }
  b.disabled = true;
  const r = await sb.from(table).update({ deleted_at: new Date().toISOString() })
    .eq('id', b.dataset.id).select('id');
  b.disabled = false;
  if (r.error) return fail(r.error, errBox);
  if (!r.data?.length) return fail(NOROW.edit, errBox);
  await reload();
}

