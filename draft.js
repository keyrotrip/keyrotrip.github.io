/* ── AI 일정 초안 ─────────────────────────────────────────────────────
 * 새 여행을 만들 때 "AI가 짜줄게요" 를 고르면 오는 화면입니다.
 * AI 가 내놓은 하루하루를 **넣기 전에 보여주고** 고를 수 있게 합니다 —
 * 바로 일정에 꽂아버리면 마음에 안 드는 줄을 하나씩 지워야 합니다.
 *
 * 초안은 **기기에 들고 있습니다**(`DKEY`, localStorage). 서버에 안 넣는
 * 이유는 아직 여행이 아니기 때문입니다 — 넣기를 안 누르면 버려질 것에
 * 표를 만들 이유가 없습니다. 앱을 껐다 켜도 살아 있고, 넣으면 지웁니다.
 *
 * ── app.js 에서 떼어낸 스물여섯 번째 조각입니다(b350) ────────────────
 * app.js 만 아는 것은 넷 — 로그인한 사람, 도시 고르개 채우기, 앱 화면 켜기,
 * 그리고 다 넣은 뒤 여행 열기.
 *
 * ⚠ **끝을 812 줄에서 끊었습니다.** 그 아래 `showProfile` 부터는 화면 전환
 * 가족이라 남겨뒀습니다 — 머리말('AI 일정 초안')이 그것까지 덮고 있었을
 * 뿐입니다. b345·b347 과 같은 함정입니다.
 *
 * 취향 칸은 새 여행 마법사와 **DOM 하나를 같이 씁니다**(`movePrefs`).
 * 두 벌로 만들면 한쪽만 고치는 날이 옵니다.
 *
 * 층: dom.js · db.js · net.js · calc.js · trip.js 와 이미 떼어낸
 *     citysearch.js · newtrip.js · plancheck.js 를 씁니다. */
import { $, esc } from './dom.js?v=b822';
import { sb } from './db.js?v=b822';
import { fail } from './net.js?v=b822';
import { D1, asDate, todayYmd, dayLabel } from './calc.js?v=b822';
import { plans, legs } from './trip.js?v=b822';
import { loadCities } from './citysearch.js?v=b822';
import { openNew, movePrefs } from './newtrip.js?v=b822';
import { review } from './plancheck.js?v=b822';

let ctx = { me: () => null, fillCityList: () => {},
            showApp: () => {}, openTrip: async () => {} };
export function setDraftCtx(o){ ctx = { ...ctx, ...o }; }

/* ── AI 일정 초안 ────────────────────────────────────────────────────
 * 문서가 "P를 끌어오는 핵심"이라고 한 자리입니다.
 * 짜준 것을 바로 넣지 않습니다. 계산으로 한 번 검사해서 보여주고,
 * 넣을지는 사람이 정합니다 — AI 는 쓰지 않고 제안만 합니다. */
let draftTrip = null, draftOut = null;

/* 짜준 것을 기기에 남겨둡니다. 화면을 나갔다 오면 사라지던 것을 막습니다 —
   AI 횟수를 써서 받은 결과인데 넣기도 전에 날리면 안 됩니다.
   서버에 두지 않는 것은 아직 내 것도 아닌 초안이기 때문입니다.
   넣거나 지우면 그때 없앱니다. */
const DKEY = id => 't2:draft:' + id;
function saveDraft(id, out){
  try { localStorage.setItem(DKEY(id), JSON.stringify({ ...out, at: Date.now() })); }
  catch {}                              /* 저장 공간이 꽉 차도 초안 자체는 살아 있습니다 */
}
function readDraft(id){
  try {
    const s = localStorage.getItem(DKEY(id));
    if (!s) return null;
    const d = JSON.parse(s);
    /* 두 주가 지난 초안은 여행 날짜가 지났을 수 있습니다. 붙들고 있지 않습니다. */
    if (!d?.actions?.length || Date.now() - (d.at || 0) > 14 * 864e5){
      localStorage.removeItem(DKEY(id)); return null;
    }
    return d;
  } catch { return null; }
}
const dropDraft = id => { try { localStorage.removeItem(DKEY(id)); } catch {} };

/* preselect 를 주면 그 여행을 고른 채로 엽니다 — 새 여행 마지막 단계에서
   'AI 가 짜줄게요' 로 들어올 때 씁니다.
   lean 이면 묻는 칸(d_ask)을 접습니다. 거기서 방금 다 고르고 왔으니까요. */
export async function openDraft(preselect, lean){
  const today = todayYmd();
  const { data } = await sb.from('trips')
    .select('id,title,destination,start_date,end_date')
    .gte('end_date', today).order('start_date').limit(20);

  /* 탭 화면 다섯은 이제 덱 한 덩어리입니다(b474). */
  ['tabdeck','aiview','cityview']
    .forEach(v => $(v).classList.add('hide'));
  $('draftview').classList.remove('hide');
  movePrefs('d_prefslot');        /* 새 여행 화면에 가 있었다면 도로 가져옵니다 */
  window.scrollTo({ top:0 });
  if (history.state?.t2 !== 'draft') history.pushState({ t2:'draft' }, '');

  /* 여행이 하나도 없으면 새로 만드는 쪽이 처음부터 열려 있어야 합니다. */
  const list = data || [];
  if (preselect) draftTrip = preselect;
  else draftTrip = list.some(t => t.id === draftTrip) ? draftTrip
                 : (list[0]?.id || 'new');
  $('d_trips').innerHTML = list.map(t => {
    const n = Math.round((asDate(t.end_date) - asDate(t.start_date)) / D1) + 1;
    return `<span class="day${t.id === draftTrip ? ' on' : ''}" data-dtrip="${esc(t.id)}">
      ${esc(t.title)} <span class="n">${n}일</span></span>`;
  }).join('') +
    `<span class="day" data-dtrip="new">＋ 새 여행</span>`;

  /* 새 여행에서 넘어왔으면 묻는 칸을 접고, 제목을 그 여행 이름으로 답니다.
     'AI 일정 만들기'라고 적혀 있으면 아직 만드는 중인 줄 압니다. */
  const mine = list.find(t => t.id === draftTrip);
  $('d_ask').classList.toggle('hide', !!lean);
  $('d_more').classList.toggle('hide', !lean);
  $('d_title').textContent = lean && mine ? mine.title : 'AI 일정 만들기';

  await loadCities();
  ctx.fillCityList();
  /* 접혀 있던 옛날 폼(어디로·시작·며칠)은 이제 안 씁니다. 여행 만들기는
     새 여행 화면 한 군데서만 합니다 — '새 여행' 칩이 그리로 보냅니다. */
  $('d_new').classList.add('hide');
  $('drafterr').classList.add('hide');
  showSavedDraft();
}

/* 저장해 둔 초안이 있으면 되살립니다. 없으면 결과 자리를 비웁니다. */
function showSavedDraft(){
  const d = draftTrip && draftTrip !== 'new' ? readDraft(draftTrip) : null;
  if (d){ draftOut = d; drawDraft(); $('d_go').textContent = '다시 짜기'; }
  else  { draftOut = null; $('d_result').innerHTML = ''; $('d_go').textContent = '일정 짜기'; }
}

export function closeDraft(fromPop){
  if (!fromPop && history.state?.t2 === 'draft'){ history.back(); return; }
  $('draftview').classList.add('hide');
  $('reviewview').classList.add('hide');
  ctx.showApp('home');
}
$('draftback').addEventListener('click', () => closeDraft());

/* 접어둔 것을 도로 펼칩니다. 다시 짜고 싶을 때 취향을 바꿀 길입니다. */
$('d_more').addEventListener('click', () => {
  $('d_ask').classList.remove('hide');
  $('d_more').classList.add('hide');
  $('d_ask').scrollIntoView({ behavior:'smooth', block:'nearest' });
});

$('draftview').addEventListener('click', e => {
  const t = e.target.closest('[data-dtrip]');
  if (!t) return;
  /* 여기서도 여행을 만들 수 있게 옛날 폼(d_new)이 접혀 있었습니다. 그러면
     만드는 길이 셋이 됩니다 — 홈, 여행 탭, 그리고 여기. 모양도 다 다릅니다.
     그 화면으로 보냅니다. 만들고 나면 'AI가 짜줄게요'로 여기 다시 옵니다. */
  if (t.dataset.dtrip === 'new'){ openNew(); return; }
  draftTrip = t.dataset.dtrip;
  document.querySelectorAll('#d_trips .day').forEach(x =>
    x.classList.toggle('on', x.dataset.dtrip === draftTrip));
  showSavedDraft();            /* 여행마다 초안이 따로 있습니다 */
});

/* 칩 고르기. 속도와 아침은 하나만, 뭘 위주로는 여러 개입니다.
   **prefblock 자신에 답니다.** 이 칸들은 새 여행 3단계와 초안 화면을
   오가므로, 바깥 화면에 걸어두면 옮겨간 쪽에서 안 눌립니다. */
$('prefblock').addEventListener('click', e => {
  for (const [box, key] of [['d_pace','pace'], ['d_morning','morning']]){
    const one = e.target.closest(`#${box} [data-${key}]`);
    if (one){
      document.querySelectorAll(`#${box} .day`).forEach(x => x.classList.remove('on'));
      one.classList.add('on');
      return;
    }
  }
  const f = e.target.closest('#d_focus [data-focus]');
  if (f) f.classList.toggle('on');
});

$('d_go').addEventListener('click', async () => {
  if (!draftTrip) return fail('여행을 골라주세요.', 'draft');
  /* 여행이 하나도 없으면 'new' 가 골라져 있습니다. 짤 여행이 없으니
     만드는 화면으로 보냅니다 — 여기서 만들지는 않습니다. */
  if (draftTrip === 'new') return openNew();
  $('drafterr').classList.add('hide');
  $('d_go').disabled = true; $('d_go').textContent = '짜는 중… 20초쯤 걸립니다';
  $('d_result').innerHTML = '';

  const prefs = {
    pace:    document.querySelector('#d_pace .on')?.dataset.pace || 'normal',
    morning: document.querySelector('#d_morning .on')?.dataset.morning || 'early',
    focus:   [...document.querySelectorAll('#d_focus .on')].map(x => x.dataset.focus),
  };
  const { data, error } = await sb.functions.invoke('chat',
    { body: { trip_id: draftTrip, mode: 'draft', prefs,
              message: $('d_note').value.trim() || null } });

  $('d_go').disabled = false; $('d_go').textContent = '다시 짜기';

  if (error){
    let why = error.message;
    try { why = (await error.context?.json())?.error || why; } catch {}
    return fail(/not found|Failed to send/i.test(why)
      ? 'AI 기능이 아직 준비되지 않았어요. 만든 사람에게 알려주세요.'
      : why, 'draft');
  }
  if (data?.error) return fail(data.error, 'draft');
  if (!data?.actions?.length)
    return fail('일정을 만들지 못했습니다. 다시 눌러보세요.', 'draft');

  draftOut = data;
  saveDraft(draftTrip, data);
  drawDraft();
});

function drawDraft(){
  const acts = [...(draftOut.actions || [])]
    .sort((a, b) => (a.date + (a.start_time || '99:99'))
                     .localeCompare(b.date + (b.start_time || '99:99')));
  /* 짜준 것을 그대로 믿지 않습니다. 우리 계산기로 한 번 훑습니다 — 공짜입니다. */
  const t = { start_date: acts[0].date, end_date: acts[acts.length - 1].date };
  const found = review(t, acts.map(a => ({ ...a, id: 'x' })), legs || []);
  const bad = found.filter(f => f.lv === '심각');

  const days = draftOut.days || [...new Set(acts.map(a => a.date))].sort();
  const empty = days.filter(d => !acts.some(a => a.date === d));

  const byDay = {};
  acts.forEach(a => (byDay[a.date] = byDay[a.date] || []).push(a));

  $('d_result').innerHTML =
    `<div class="card">
       <h2>이렇게 짜봤어요 <span class="val">${acts.length}개</span></h2>
       ${draftOut.reply ? `<div class="memo" style="margin-bottom:10px">${
         esc(draftOut.reply).slice(0, 400)}</div>` : ''}
       ${bad.length || empty.length
         ? `<div class="row" style="border:0; padding:0 0 10px; margin:0">
              <span class="kdot" style="margin-top:6px; background:var(--bad)"></span>
              <span class="label"><b>넣기 전에 봐주세요</b>
                <div class="memo">${esc([
                  ...bad.slice(0, 3).map(f => f.t),
                  empty.length ? `${empty.length}일이 비어 있어요` : ''
                ].filter(Boolean).join(' · '))}</div></span>
            </div>`
         : `<div class="memo" style="margin-bottom:10px">
              겹치거나 무리한 일정은 없어요.</div>`}

       ${days.map(d => `<div style="margin-top:10px">
         <div class="label" style="font-weight:600">${esc(dayLabel(d, { start_date: days[0] }))}</div>
         ${(byDay[d] || []).map(a => `<div class="plan">
            <div class="when">${esc(a.start_time || '–')}</div>
            <span class="kdot ${a.category ? 'k-' + esc(a.category) : ''}"></span>
            <div class="body"><b>${esc(a.title)}</b>${
              a.memo ? `<span class="memo">${esc(a.memo)}</span>` : ''}</div>
          </div>`).join('') || '<div class="empty">이 날은 비어 있어요.</div>'}
       </div>`).join('')}

       <button class="primary" id="d_apply" style="width:100%; margin-top:14px">
         이대로 ${acts.length}개 넣기</button>
       <button class="ghost" id="d_drop" style="width:100%; margin-top:6px">
         이 초안 지우기</button>
       <div class="memo" style="text-align:center; margin-top:8px">
         넣은 뒤에도 하나씩 고치거나 지울 수 있어요.
         넣기 전까지는 이 초안이 기기에 남아 있어요.</div>
     </div>`;

  $('d_drop').onclick = () => { dropDraft(draftTrip); showSavedDraft(); };

  $('d_apply').onclick = async () => {
    $('d_apply').disabled = true; $('d_apply').innerHTML = '<span class="load">넣는 중…</span>';
    const rows = acts.map(a => ({
      trip_id: draftTrip, date: a.date, start_time: a.start_time,
      title: a.title, category: a.category, memo: a.memo,
      lat: a.lat, lng: a.lng, created_by: ctx.me().id,
    }));
    /* RLS 에 막히면 오류가 아니라 0행이 돌아옵니다. 넣은 수를 반드시 세야 합니다. */
    const r = await sb.from('plans').insert(rows).select('id');
    if (r.error){ $('d_apply').disabled = false; return fail(r.error, 'draft'); }
    if (!r.data?.length){
      $('d_apply').disabled = false;
      return fail('하나도 넣지 못했습니다. 이 여행에 쓸 권한이 있는지 확인해주세요.', 'draft');
    }
    dropDraft(draftTrip);          /* 넣었으니 더 들고 있을 이유가 없습니다 */
    closeDraft();
    ctx.openTrip(draftTrip);
  };
}
