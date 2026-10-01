/* ── AI 제안 카드 ────────────────────────────────────────────────────
 * AI 가 돌려준 것을 카드로 그리고, 누르면 일정·후보·짐으로 담습니다.
 * 담은 뒤 되돌리는 띠(showUndo)와 일정 검토(runReview)도 여기 있습니다.
 *
 * ── app.js 에서 떼어낸 일곱 번째 조각입니다(b334) ───────────────────
 * 대화 자체는 app.js 에 남아 있고(무엇을 묻고 무엇을 받는지), 여기는
 * **받은 것을 화면에 놓고 담는 일**입니다. aiui.js(점 세 개·사진·출처)와
 * 짝입니다.
 *
 * ctx 로 받는 것 다섯 — 대화 닫기 · 일정 다시 받기 · 검토 계산 ·
 * 오늘 날짜 만들기 · 로그인한 사람. 담고 나면 대화를 닫고 일정으로
 * 보내야 해서 저쪽을 부를 일이 생깁니다.
 *
 * 층: dom.js · db.js · calc.js · trip.js · net.js 만 씁니다. */
import { $, esc, toast } from './dom.js?v=b816';
import { asDate, D1, ymd } from './calc.js?v=b816';
import { setAiTripId, setSuggested, suggested } from './ai.js?v=b816';
import { sb } from './db.js?v=b816';
import { fail, netTimeout, NOROW } from './net.js?v=b816';
import { trip, plans, legs, setPlans, pickedDay, setPlanSeedGeo } from './trip.js?v=b816';
import { arm } from './ui.js?v=b816';

/* 검토 결과의 등급 색. **app.js 에도 같은 표가 있었는데 여기서 내보냅니다** —
   두 곳에 적어두면 언젠가 한쪽만 고칩니다(D1·asDate 에서 겪은 것과 같은 일). */
export const LVCOLOR = { 심각:'var(--bad)', 주의:'var(--k-food)', 참고:'var(--ink-48)' };

let ctx = {
  me: () => null, closeAi: () => {}, loadPlans: async () => {},
  review: () => ({}),
};
export function setCardsCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 제안 카드 ──────────────────────────────────────────────────────
 * AI 는 직접 쓰지 않습니다 (문서 7장). 제안만 카드로 내고 담는 것은 사용자가 합니다.
 * 카드는 저장하지 않습니다 — 다음 질문을 하면 사라집니다.
 * 남겨두면 이미 담은 것을 또 담게 되고, 무엇이 최신인지 헷갈립니다. */
export function drawCards(d){
  const acts = d?.actions || [];
  /* **같은 곳을 두 장으로 내지 않습니다.**
     "삼고정문 둘째날에 넣어줘" 처럼 한 곳을 말하면 AI 가 그것을 actions 에도
     places 에도 담아 보낼 때가 있습니다. 그러면 '일정으로 넣기' 아래 한 장,
     '일정 후보로' 아래 한 장 — **같은 장소가 카드 둘**로 뜨고
     사용자는 둘이 무엇이 다른지 알 수가 없습니다.
     일정 카드에는 이미 [일정에 넣기]와 [일정 후보로]가 **둘 다** 있으므로
     고를 것은 거기서 다 고를 수 있습니다. 이름이 겹치면 일정 카드만 남깁니다.
     (띄어쓰기·대소문자만 다른 것도 같은 곳으로 봅니다 — AI 가 매번 똑같이
      적어주지는 않습니다.) */
  /* **글자가 똑같은지로 보면 안 잡힙니다.** 실제로 온 것은
     일정 `쌍용각 식사` · 장소 `쌍용각` 이었습니다 — AI 는 일정에는 무엇을 하는지까지
     붙이고 장소에는 이름만 씁니다. 그래서 **한쪽이 다른 쪽에 들어 있으면** 같은 곳으로
     봅니다. 두 글자는 넘어야 합니다 — '역' 같은 한 글자는 아무 데나 걸립니다. */
  const 다듬기 = s => String(s ?? '').trim().replace(/\s+/g, '').toLowerCase();
  const 제목들 = acts.map(a => 다듬기(a.title)).filter(Boolean);
  const 같은곳 = name => {
    const n = 다듬기(name);
    if (n.length < 2) return false;
    return 제목들.some(t => t === n || t.includes(n) || (n.length >= 2 && n.includes(t)));
  };
  const places = (d?.places || []).filter(p => !같은곳(p.name));
  lastTake = [];                    /* 새 제안이 나오면 되돌릴 대상도 새로 시작합니다 */
  if (!acts.length && !places.length){ $('cards').innerHTML = ''; return; }

  /* **"지도에는 안 떠요 · 위치를 못 찾았어요"를 뺐습니다.**
     이 줄을 카드마다 달아뒀는데, 서버 프롬프트가 AI 에게 "좌표는 적지 않는다,
     우리가 나중에 채운다"고 시키고 있습니다. 그러니 AI 카드는 **거의 언제나**
     좌표가 없고, 이 줄은 카드마다 빠짐없이 떴습니다 — 실제로 받아보니
     다섯 장이 전부 달고 나왔습니다. 늘 켜져 있는 경고는 경고가 아니라 배경입니다.
     게다가 "못 찾았어요"는 찾아봤다는 뜻인데 아직 찾아보지도 않았습니다.
     좌표는 담은 뒤에 '좌표 채우기'가 붙입니다. 그때 못 찾으면 그쪽이 말합니다. */
  setSuggested({ actions: acts, places });

  /* 하나씩 누르게 하면 제안이 다섯이면 다섯 번을 누릅니다. 초안은 서른 번입니다.
     한 번에 담고, 아니다 싶으면 방금 담은 것만 되돌립니다.

     **날짜를 물어봅니다.** 개별로 넣을 때는 폼에서 날짜를 정하게 고쳤는데(b181)
     다 담기는 여전히 AI 가 붙인 날짜로 들어갔습니다. 그 날짜는 대개 여행 첫날일
     뿐 근거가 없습니다. 스무 개를 하나씩 정하게 할 수는 없으니 **한 번만** 묻습니다.
       그대로  — AI 가 적어준 날짜를 씁니다(예전 동작)
       특정일  — 고른 날짜에 다 넣습니다. 하루를 통째로 짜는 경우입니다 */
  const dayOpts = (trip && acts.length)
    ? (() => {
        /* **로컬 자정으로 만들어 UTC 로 잘라 읽고 있었습니다.** 한국(UTC+9)에서는
           9시간이 빠지면서 목록이 통째로 하루씩 앞으로 밀렸습니다 —
           8/14~8/16 여행인데 "Day 1 · 08-13" 이 나왔고, 그걸 고르면
           **여행 시작 전날에 일정이 들어갔습니다.** 실기기에서 확인했습니다.
           날짜 문자열을 다룰 때는 앱의 다른 곳과 같이 asDate(UTC 자정) + D1 로
           셈하고 ymd 로 되돌립니다. 둘이 짝이라 시간대를 안 탑니다. */
        const out = []; const e = trip.end_date;
        for (let d = asDate(trip.start_date), i = 1; ymd(d) <= e && i <= 60;
             d = new Date(d.getTime() + D1), i++){
          const v = ymd(d);
          out.push(`<option value="${v}">Day ${i} · ${v.slice(5)}</option>`);
        }
        return out.join('');
      })() : '';

  $('cards').innerHTML =
    (acts.length + places.length > 1
      ? `<div class="takeall">
           <button class="small" data-takeall="1">이 ${acts.length + places.length}개 다 담기</button>
           ${dayOpts ? `<select id="takeday" class="small" title="일정을 넣을 날">
                <option value="">날짜는 그대로</option>${dayOpts}</select>` : ''}
           <button class="ghost hide" id="undotake">방금 담은 것 되돌리기</button>
         </div>` : '') +
    /* **일정으로 온 것도 후보로 보낼 수 있어야 합니다.** 불러오기로 스무 개를
       읽어오면 그중 몇 개는 "갈지 말지 아직 모르겠는 곳"입니다. 지금까지는
       일정에 넣거나 버리거나 둘뿐이라, 애매한 것을 일정에 넣어놓고 나중에
       지우는 수밖에 없었습니다. 단추를 하나 더 답니다. */
    (acts.length ? `<div class="daysep">일정으로 넣기</div>` : '') +
    acts.map((a, i) => {
      const k = a.category ? 'k-' + a.category : '';
      /* 단추를 **제목 아래**로 내립니다. 오른쪽에 세워두었더니 제목이
         밀려 두 줄로 접히고, 좁은 자리에 단추 둘이 겹쳐 보였습니다. */
      /* **시각이 없으면 그 칸을 아예 안 그립니다.** 전에는 `–` 를 찍었는데,
         AI 제안은 시각이 없는 것이 흔해서 줄마다 뜻 없는 줄표가 하나씩
         서 있었습니다. 빈 칸을 남기면 제목이 50px 밀려 시작합니다. */
      return `<div class="plan">
        ${a.start_time ? `<div class="when">${esc(a.start_time)}</div>` : ''}
        <span class="kdot ${esc(k)}"></span>
        <div class="body"><b>${esc(a.title)}</b>
          <span class="memo">${esc(a.date)}${a.memo ? ' · ' + esc(a.memo) : ''}</span>
          <div class="takepair">
            <button class="small" data-take="a"  data-i="${i}"
                    data-label="일정에 넣기">일정에 넣기</button>
            <button class="small alt" data-take="ap" data-i="${i}"
                    data-label="일정 후보로">일정 후보로</button>
          </div>
        </div></div>`;
    }).join('') +
    (places.length ? `<div class="daysep">일정 후보로 담기</div>` : '') +
    places.map((p, i) => {
      const k = p.category ? 'k-' + p.category : '';
      /* 위 일정 카드와 같은 자리에 둡니다 — 한쪽은 오른쪽, 한쪽은 아래면
         같은 목록 안에서 단추가 두 군데에 있는 셈이 됩니다. */
      /* **현지 이름은 우리말 이름과 다를 때만 답니다.** 국내 장소는 AI 가
         name_local 에 같은 이름을 되돌려주는데, 그대로 이어 붙이니
         "트리고 삼척해변점 / 트리고 삼척해변점 · 삼척해변 뷰가 멋진…" 처럼
         제목이 바로 아래 한 번 더 나왔습니다. 현지 이름이 쓸모 있는 때는
         택시 기사에게 보여줄 때처럼 **글자가 다를 때**뿐입니다. */
      const loc = p.name_local && p.name_local !== p.name ? p.name_local : null;
      return `<div class="plan">
        <span class="kdot ${esc(k)}"></span>
        <div class="body"><b>${esc(p.name)}</b>
          <span class="memo">${esc([loc, p.why].filter(Boolean).join(' · '))}</span>
          <div class="takepair">
            <button class="small" data-take="p" data-i="${i}"
                    data-label="일정 후보로">일정 후보로</button>
          </div>
        </div></div>`;
    }).join('');
}

/* 방금 담은 것들. 되돌리기가 이걸 봅니다.
   담을 때마다 새로 시작합니다 — 열 번 전에 담은 것까지 지우면 그건 사고입니다. */
let lastTake = [];

/* ── 카드를 일정 폼으로 보내기 ────────────────────────────────────────
 * 예전에는 '일정에 넣기'가 곧바로 저장했습니다. AI 가 정해준 날짜·시각
 * 그대로라서, 사용자가 보기에는 **아무 데나 들어간** 것이었습니다.
 * 손으로 넣을 때는 날짜와 시각을 고르는데 불러온 것만 그냥 꽂히는 셈입니다.
 * 이제 일정 추가 폼을 **미리 채워서** 열어줍니다. 정하는 것은 사용자가 합니다.
 *
 * 좌표는 폼에 칸이 없습니다. 여기 들고 있다가 저장할 때 같이 넣습니다 —
 * 안 그러면 이동시간 검사의 재료가 사라집니다. (후보 → 일정도 같은 구멍이
 * 있었습니다. 이 변수를 그쪽에서도 씁니다.) */
/* ⚠ 여기 `let planSeedGeo = null` 로 숨어 있었습니다(b364 에서 trip.js 로).
   바로 위 주석이 "이 변수를 그쪽에서도 씁니다" 라고 이미 적어두고 있었는데,
   정작 선언은 이 파일 안에만 있었습니다 — geocode.js 와 app.js 는 그냥
   이름을 불렀고 셋 다 터졌습니다. **여럿이 쓰는 것은 trip.js 에 둡니다.** */

export function openPlanForm(seed){
  /* 이미 열려 있으면 닫고 다시 엽니다. addplanbtn 이 toggle 이라
     열린 채로 누르면 오히려 닫힙니다. */
  $('plancard').classList.add('hide');
  $('addplanbtn').click();
  $('p_title').value = seed.title || '';
  $('p_cat').value   = seed.category || '';
  $('p_memo').value  = seed.memo || '';
  $('p_date').value  = seed.date || pickedDay || trip.start_date;
  $('p_start').value = seed.start_time || '';
  $('p_end').value   = seed.end_time || '';
  setPlanSeedGeo((seed.lat != null && seed.lng != null)
    ? { lat: seed.lat, lng: seed.lng } : null);
  /* 시트로 뜨므로 끌어올 것이 없습니다 — 여기 있던 scrollIntoView 는 뗐습니다
     (b366). 누르는 순간에는 아직 문서 맨 아래의 보통 요소라 화면이 밑으로
     굴러갔습니다. 사연은 app.js 의 addplanbtn 자리에 적어뒀습니다. */
}

/* 카드 한 장을 담습니다. 담긴 줄의 id 를 돌려줍니다 (되돌리기용).
   day 를 주면 그 날짜로 넣습니다 — 다 담기에서 날짜를 하나로 고른 경우입니다. */
async function takeCard(kind, i, tripId, day){
  if (kind === 'a'){
    const a = suggested.actions[i];
    /* 날짜를 정해줬으면 그것을 씁니다. AI 가 적어준 날짜는 대개 여행 첫날일
       뿐 근거가 없어서, 하루를 통째로 짜는 경우에는 그쪽이 맞습니다.
       **시각은 그대로 둡니다** — 순서까지 뭉개면 오전·오후가 뒤섞입니다. */
    const date = day || a.date;
    /* 같은 날 맨 뒤로. 좌표가 있으면 같이 넣습니다 — 이동 시간 검사의 재료입니다. */
    const same = plans.filter(p => p.date === date);
    const r = await sb.from('plans').insert({
      trip_id: tripId, date, title: a.title,
      start_time: a.start_time || null, category: a.category,
      memo: a.memo, lat: a.lat, lng: a.lng,
      sort_order: same.length ? Math.max(...same.map(p => +p.sort_order)) + 1 : 0,
    }).select('id');
    if (r.error) throw r.error;
    if (!r.data?.length) throw new Error(NOROW.save);
    return { table:'plans', id:r.data[0].id };
  }
  /* 'ap' = 일정으로 온 것을 후보로 보냅니다. 날짜와 시각은 버립니다 —
     후보는 "언제 갈지 아직 안 정한 곳"이라 날짜가 있으면 뜻이 어긋납니다.
     대신 원래 며칠에 있던 것인지는 메모에 적어둡니다. 지우면 나중에
     "이게 왜 여기 있지"가 됩니다. */
  const src = kind === 'ap' ? suggested.actions[i] : suggested.places[i];
  const p = kind === 'ap'
    ? { name: src.title, name_local: null, category: src.category, lat: src.lat, lng: src.lng,
        why: [src.memo, src.date ? `불러올 때 ${src.date}` : ''].filter(Boolean).join(' · ') }
    : src;
  const r = await sb.from('candidates').insert({
    trip_id: tripId, title: p.name, title_local: p.name_local,
    category: p.category, memo: p.why, lat: p.lat, lng: p.lng,
    source: 'ai',
  }).select('id');
  if (r.error) throw r.error;
  if (!r.data?.length) throw new Error(NOROW.save);
  return { table:'candidates', id:r.data[0].id };
}

/* 밖에서 되돌릴 목록을 비우는 **유일한 길**입니다.
   ⚠ `aiscreen.js` 가 '대화 지우기' 에서 `lastTake = []` 를 그냥 적고
   있었습니다(b364 에서 고침). `lastTake` 는 이 파일 안의 `let` 이라 저쪽에는
   없는 이름이고, 모듈은 늘 strict 라 **거기서 터져 지웠다는 말도 안 떴습니다.**
   비운 뒤 단추까지 같이 감춥니다 — 목록만 비우고 단추를 두면 "0개 되돌리기"
   가 남습니다. */
export function clearLastTake(){ lastTake = []; showUndo(); }

function showUndo(){
  const u = $('undotake'); if (!u) return;
  u.classList.toggle('hide', !lastTake.length);
  u.textContent = `방금 담은 ${lastTake.length}개 되돌리기`;
}

$('cards').addEventListener('click', async e => {
  const tripId = $('ai_trip').value;

  /* ── 되돌리기 ── 진짜로 지우지 않고 숨깁니다. 다른 삭제와 같은 방식입니다. */
  if (e.target.id === 'undotake'){
    const u = e.target;
    u.disabled = true; u.innerHTML = '<span class="load">되돌리는 중…</span>';
    for (const t of lastTake)
      await sb.from(t.table).update({ deleted_at: new Date().toISOString() }).eq('id', t.id);
    lastTake = [];
    u.disabled = false; showUndo();
    /* 단추마다 원래 글자가 다릅니다(일정에 · 후보로 · 담기).
       '담기'로 일괄 되돌리면 일정 카드의 단추 두 개가 똑같아집니다. */
    $('cards').querySelectorAll('button[data-take]').forEach(x => {
      x.disabled = false; x.textContent = x.dataset.label || '담기';
      x.classList.remove('hide');      /* 담을 때 감춘 짝 단추를 되살립니다 */
    });
    const all = $('cards').querySelector('button[data-takeall]');
    if (all){ all.disabled = false; all.textContent = all.dataset.orig || all.textContent; }
    toast('되돌렸어요.');
    await runReview(tripId);
    if (trip) await ctx.loadPlans();
    return;
  }

  /* ── 다 담기 ── */
  const all = e.target.closest('button[data-takeall]');
  if (all){
    /* ⚠ **한 번 묻습니다 (b388).** 카드 한 장의 「일정에 넣기」는 값이 채워진
       폼을 열어 확인을 받는데, 여기는 여러 개를 확인 없이 바로 넣었습니다 —
       **위험한 쪽만 확인이 없었습니다.** 되돌리기가 바로 아래 있긴 하지만,
       그건 알아채야 쓸 수 있는 길입니다. */
    if (all.dataset.armed !== '1'){
      arm(all, `${$('takeday')?.value ? '고른 날로 ' : ''}정말 다 담을까요?`);
      return;
    }
    all.dataset.orig = all.dataset.orig || '다 담기';
    all.disabled = true;
    lastTake = [];
    /* 날짜를 골라뒀으면 일정은 전부 그 날로 갑니다. 비워두면 예전처럼
       AI 가 적어준 날짜를 씁니다. 후보는 날짜가 없으니 이 값과 무관합니다. */
    const day = $('takeday')?.value || '';
    const jobs = [
      ...suggested.actions.map((_, i) => ['a', i]),
      ...suggested.places.map((_, i) => ['p', i]),
    ];
    let done = 0;
    for (const [kind, i] of jobs){
      all.textContent = `담는 중… ${++done}/${jobs.length}`;
      try { lastTake.push(await takeCard(kind, i, tripId, day)); }
      catch (err){ all.disabled = false; all.textContent = all.dataset.orig;
                   showUndo(); return fail(err, 'ai'); }
    }
    all.textContent = `${jobs.length}개 담았어요`;
    /* 날짜를 바꿔 넣었으면 그 사실을 말해줍니다. 안 그러면 "왜 다 같은 날에
       있지"를 나중에 목록에서 발견하게 됩니다. */
    if (day) toast(`${day} 에 몰아넣었어요. 시각은 그대로예요.`);
    /* 다 담기는 일정은 일정으로, 후보는 후보로 넣습니다. 그러니 일정 카드의
       '후보로' 단추는 안 쓰인 것이라 글자를 바꾸지 않고 감춥니다. */
    $('cards').querySelectorAll('button[data-take]').forEach(x => {
      if (x.dataset.take === 'ap'){ x.disabled = true; x.classList.add('hide'); return; }
      x.disabled = true; x.textContent = '담았어요';
    });
    showUndo();
    await runReview(tripId);
    if (trip) await ctx.loadPlans();
    return;
  }

  /* ── 한 장씩 ── */
  const b = e.target.closest('button[data-take]'); if (!b) return;

  /* 일정으로 넣는 것만 폼을 거칩니다. 후보는 날짜가 없는 것이 본래 뜻이라
     고를 것이 없습니다 — 폼을 띄우면 오히려 한 단계가 늘 뿐입니다. */
  if (b.dataset.take === 'a'){
    const a = suggested.actions[+b.dataset.i];
    if (!a) return;
    if (!tripId) return fail('어느 여행인지 먼저 골라주세요.', 'ai');
    /* AI 시트를 닫고 폼을 엽니다. popstate 는 aiview 만 닫고 일정 폼은
       안 건드리므로 순서가 꼬이지 않습니다. */
    ctx.closeAi();
    openPlanForm(a);
    return;
  }

  b.disabled = true; b.innerHTML = '<span class="load">담는 중…</span>';
  try {
    lastTake.push(await takeCard(b.dataset.take, +b.dataset.i, tripId));
  } catch (err){
    b.disabled = false; b.textContent = b.dataset.label || '담기';
    return fail(err, 'ai');
  }
  b.textContent = '담았어요';
  /* 일정 카드에는 단추가 둘입니다. 하나를 담았으면 나머지도 잠급니다 —
     안 그러면 같은 것이 일정에도 후보에도 들어갑니다. */
  b.closest('.plan')?.querySelectorAll('button[data-take]').forEach(x => {
    if (x !== b){ x.disabled = true; x.classList.add('hide'); }
  });
  showUndo();
  await runReview(tripId);          /* 넣었으니 검토 배지도 다시 셉니다 */
});

/* 검토는 채팅을 가리지 않게 접어둡니다. 버튼에는 몇 건인지만 답니다. */
$('reviewbtn').addEventListener('click', () => {
  $('reviewcard').classList.toggle('hide');
  if (!$('reviewcard').classList.contains('hide'))
    $('reviewcard').scrollIntoView({ behavior:'smooth', block:'nearest' });
});
$('reviewclose').addEventListener('click', () => $('reviewcard').classList.add('hide'));

/* 늦은 답 막기(b799, GPT 리포트 P0-2) — AI 화면에서 여행을 바꾸면 앞 여행의 검토가 늦게 와서
   새 여행 아래에 그려질 수 있었습니다. 부를 때마다 차례를 매기고, 받은 뒤 아직 내 차례인지 봅니다. */
let 검토차례 = 0;
export async function runReview(id){
  const 이번 = ++검토차례;
  setAiTripId(id);
  /* 여행을 안 골랐으면 검토할 것이 없습니다. 배지도 지웁니다. */
  if (!id){
    $('review').innerHTML = '<div class="empty">여행을 고르면 일정을 검토해드립니다.</div>';
    $('reviewdot').classList.add('hide');
    $('reviewbtn').classList.add('hide');
    return;
  }
  $('reviewbtn').classList.remove('hide');
  const [{ data:t }, { data:ps }, { data:lg }] = await Promise.all([
    sb.from('trips').select('*').eq('id', id).maybeSingle(),
    sb.from('plans').select('date,start_time,end_time,category,title,lat,lng')
      .eq('trip_id', id).is('deleted_at', null).order('date'),
    sb.from('trip_legs').select('destination,start_date,end_date,walk_max_km,' +
      'walk_min_per_km,walk_base_min,transit_factor,transit_base_min')
      .eq('trip_id', id).order('start_date')
  ]);
  if (이번 !== 검토차례) return;
  if (!t) return;
  const found = ctx.review(t, ps || [], lg || []);
  const noCoord = (ps || []).filter(p => p.lat == null).length;

  /* 버튼 배지는 짚어봐야 할 것만 셉니다. "비어 있습니다"까지 세면
     새 여행에서 숫자가 크게 뜨는데 실은 아무 문제도 아닙니다. */
  const n = found.filter(f => f.lv !== '참고').length;
  $('reviewdot').textContent = n;
  $('reviewdot').classList.toggle('hide', !n);
  $('reviewdot').style.color = found.some(f => f.lv === '심각')
    ? 'var(--bad)' : 'var(--k-food)';

  $('review').innerHTML = found.length
    ? found.map(f => `<div class="plan">
        <span class="kdot" style="background:${LVCOLOR[f.lv]}"></span>
        <div class="body"><b>${esc(f.t)}</b>
          <span class="memo">${esc(f.s)}</span></div>
        <span class="badge" style="color:${LVCOLOR[f.lv]}">${esc(f.lv)}</span></div>`).join('')
      + (noCoord ? `<div class="empty" style="text-align:left; padding:12px 0 0">
           좌표가 없는 일정 ${noCoord}개는 이동 시간을 못 쟀어요.</div>` : '')
    : `<div class="empty">문제를 못 찾았어요.<br>지금 일정은 무리가 없어 보입니다.</div>`;
}

