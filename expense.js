/* ── 지출 · 환율 · 정산 ───────────────────────────────────────────────
 * 여행 상세의 '지출' 구역 전부입니다. 쓴 돈을 적고, 그날 환율로 못박고,
 * 누가 얼마를 누구에게 보내야 하는지까지 여기서 끝냅니다.
 *
 * ── app.js 에서 떼어낸 여덟 번째 조각입니다(b335) ────────────────────
 * **여행 상세를 화면 단위로 자르는 첫 칼입니다.** 여행 상세는 1,000줄이
 * 넘어서 통째로는 못 뗍니다. 그런데 지출은 그 안에서 가장 잘 닫혀 있습니다 —
 * 자기 자료(expenses)를 자기가 받아오고, 자기 화면만 그리고, 밖에서
 * 부르는 길이 `loadExpenses` 하나뿐입니다.
 *
 * app.js 만 아는 것은 **둘**입니다: 로그인한 사람, 일정 다시 그리기.
 * (일정을 다시 그리는 이유는 지출이 일정 줄에 금액으로 붙기 때문입니다.)
 * 원래는 여섯이었는데 넷을 아래층으로 내려서 줄였습니다 —
 *   nameOf → trip.js  (지출만 쓰는 줄 알았는데 네 화면이 더 씁니다)
 *   todayYmd → calc.js  ·  emptyDo → dom.js  ·  legFor 는 legNear 를 직접
 * 이렇게 하니 ctx 가 둘로 줄었습니다. **떼어낼수록 얽힘이 줄어드는 자리입니다.**
 *
 * 층: dom.js · db.js · net.js · calc.js · trip.js · ui.js 만 씁니다. */
import { $, esc, toast, emptyDo } from './dom.js?v=b818';
import { sb } from './db.js?v=b818';
import { fail, netTimeout, offNote, isOffline, write, drawOffbar } from './net.js?v=b818';
import { money, NO_CENTS, settleMath, dayLabel, legNear, todayYmd, hm } from './calc.js?v=b818';
import { trip, plans, legs, members, expenses, setExpenses, nameOf,
         pickedDay, tab, setSettleOn } from './trip.js?v=b818';
import { arm } from './ui.js?v=b818';

/* app.js 만 아는 것 둘. **`me` 는 값이 아니라 함수로 받습니다** —
   로그인할 때마다 바뀌는데 값으로 받으면 처음 것을 붙들고 있습니다. */
let ctx = { me: () => null, drawPlans: () => {} };
export function setExpenseCtx(o){ ctx = { ...ctx, ...o }; }

/* ── 환율 ───────────────────────────────────────────────────────────
 * 유럽중앙은행이 매일 내는 값을 씁니다. 키가 없어도 되고 공개 자료입니다.
 *
 * **쓴 날의 환율을 지출에 못박아 저장합니다.** 볼 때마다 새로 받아오면
 * 오늘 본 사람과 내일 본 사람의 "너 나한테 얼마"가 달라집니다.
 * 정산은 사람마다 같은 숫자가 나와야 합니다.
 *
 * 실패하면 환산을 안 하고 통화별로 나눠 보여줍니다. 틀린 숫자를 내놓느니
 * 안 내놓는 편이 낫습니다. */
/* 기준을 EUR 로 고정합니다.
   from=KRW 로 받으면 EUR 이 0.0006 처럼 네 자리로 잘려 와서 되돌릴 때
   1,667원이 됩니다. 실제는 1,658원 — 0.5% 가 틀어집니다.
   EUR 기준이면 KRW=1657.99 로 제대로 옵니다. */
/* 주소가 api.frankfurter.app 에서 api.frankfurter.dev/v1 로 옮겨갔습니다.
   옛 주소도 301 로 넘겨주긴 하는데 **그 301 응답에 CORS 헤더가 없습니다.**
   브라우저는 리다이렉트를 따라가기 전에 그걸 보고 막아버립니다 — 그래서
   통화와 상관없이 환율이 전부 실패했습니다. 화면에는 "유럽중앙은행이 안 내는
   통화일 수 있다"고 떴는데, GBP 는 당연히 내는 통화입니다. 틀린 진단이었습니다.
   (curl 로는 멀쩡히 보여서 더 헷갈립니다. curl 은 CORS 를 안 봅니다.) */
const FX_API = 'https://api.frankfurter.dev/v1';

/* 왜 실패했는지 부르는 쪽이 알아야 안내를 제대로 씁니다. */
let fxLastFail = '';

async function fxFor(date){
  const key = `t2:fx:${date}`;
  const hit = localStorage.getItem(key);
  if (hit){ try { return JSON.parse(hit); } catch { localStorage.removeItem(key); } }

  /* 아직 환율이 안 나온 날짜(미래·오늘·주말)는 404 입니다. 그럴 땐 최신값을 씁니다. */
  for (const d of [date, 'latest']){
    try {
      const r = await fetch(`${FX_API}/${d}?base=EUR`);
      if (!r.ok) continue;
      const j = await r.json();
      if (!j?.rates) continue;
      const v = { date: j.date, rates: j.rates };
      try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
      fxLastFail = '';
      return v;
    } catch { fxLastFail = 'net'; }   /* 연결 자체가 안 된 것 */
  }
  if (!fxLastFail) fxLastFail = 'net';
  return null;
}

/* 현지 통화 1 = 집 통화 얼마. 못 구하면 null 이고 환산하지 않습니다. */
async function rateOf(cur, home, date){
  if (cur === home) return 1;
  const fx = await fxFor(date);
  if (!fx) return null;
  const at = c => c === 'EUR' ? 1 : fx.rates[c];   /* 기준이 EUR 이라 EUR 은 1 */
  const a = at(cur), b = at(home);
  return (a && b) ? b / a : null;
}

export async function loadExpenses(){
  $('experr').classList.add('hide');
  const 그여행 = trip.id;          /* 늦은 답 막기(b799) — tripview.js 의 loadPlans 머리말 */
  const { data, error } = await netTimeout(sb.from('expenses')
    /* expense_shares 는 "이건 나랑 지훈만" 같은 지출에만 줄이 생깁니다.
       비어 있으면 참여자 균등입니다. 표는 처음부터 있었는데 아무도 안 읽고 있었습니다. */
    .select('id,date,title,amount,currency,amount_home,fx_rate,category,payer_id,memo,method,' +
            'plan_id,expense_shares(user_id,weight)')
    .eq('trip_id', 그여행)
    .is('deleted_at', null)
    .order('date', { ascending:false }).order('created_at', { ascending:false }));
  if (trip?.id !== 그여행) return;
  if (error){
    if (isOffline(error)){ offNote('expenses'); $('exptotal').innerHTML = ''; drawOffbar(); return; }
    $('expenses').innerHTML = ''; return fail(error, 'exp'); }
  setExpenses(data);
  drawExpenses();
  drawSettle();
  /* **일정 줄이 지출을 씁니다**(plan_id 로 붙은 금액). 둘은 같이 출발해서
     어느 쪽이 먼저 올지 모르므로, 지출이 늦게 오면 일정을 다시 그립니다.
     안 그러면 여행을 연 첫 화면에서만 금액이 안 붙어 있습니다. */
  if ((plans || []).length) ctx.drawPlans();
}

function drawExpenses(){
  if (!expenses.length){
    $('exptotal').innerHTML = '';
    /* ⚠ 보기 전용 일행에게는 단추를 안 답니다(b799, GPT 리포트에서 찾음) — 머리의 「추가」는
       숨겼는데(opentrip.js) 빈 화면 단추가 숨은 단추를 대신 눌러 폼이 열리고, 저장은 막혀 실패했습니다. */
    const 보기만 = trip.myRole === 'viewer';
    $('expenses').innerHTML = emptyDo('아직 지출이 없어요.',
      보기만 ? null : '첫 지출 넣기', 보기만 ? null : 'addexpbtn',
      보기만 ? '일행이 넣으면 여기에 모여요.' : '넣어두면 일행과 나눠 낼 몫이 자동으로 계산돼요.');
    return;
  }
  const byCur = {};
  for (const e of expenses) byCur[e.currency] = (byCur[e.currency] || 0) + Number(e.amount);
  const detail = Object.entries(byCur).map(([c, v]) => money(v, c)).join(' · ');

  /* 환산된 것만 합칩니다. 못 구한 환율을 짐작해 채우면 틀린 총액이 나옵니다. */
  const done = expenses.filter(e => e.amount_home != null);
  const missing = expenses.length - done.length;
  const total = done.reduce((s, e) => s + Number(e.amount_home), 0);

  /* 분류별로 얼마나 썼는지. 숫자만 늘어놓으면 어디에 많이 쓴 건지 안 보입니다.
     환산된 것만 셉니다 — 못 구한 환율을 섞으면 비중이 틀립니다. */
  const byCat = {};
  done.forEach(e => {
    const k = e.category || '기타';
    byCat[k] = (byCat[k] || 0) + Number(e.amount_home);
  });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const bar = total > 0
    ? `<div class="cbar">${cats.map(([k, v]) =>
        `<i class="k-${esc(k)}" style="width:${(v / total * 100).toFixed(2)}%"></i>`).join('')}</div>
       <div class="clegend">${cats.map(([k, v]) =>
        `<span><i class="k-${esc(k)}"></i>${esc(k)}
           <b>${esc(money(v, trip.home_currency))}</b>
           <em>${Math.round(v / total * 100)}%</em></span>`).join('')}</div>`
    : '';

  $('exptotal').innerHTML =
    `<div class="picked" style="margin-bottom:var(--s-sm); display:block">
       <div class="c">모두 합쳐</div>
       ${done.length
         ? `<b style="font-size:calc(21px * var(--ts))">${esc(money(total, trip.home_currency))}</b>`
         : ''}
       <div class="c">${esc(detail)}</div>
       ${missing ? `<div class="c" style="color:var(--bad); margin-top:6px">
            환율을 못 구한 지출 ${missing}건은 합계에서 빠졌어요.
            <button class="ghost" id="fxfill" style="padding:2px 8px; color:var(--primary)">
              환율 채우기</button></div>` : ''}
       ${bar}
     </div>`;
  if (missing) $('fxfill').onclick = fillRates;

  let html = '', last = null;
  for (const e of expenses){
    if (e.date !== last){
      html += `<div class="daysep">${esc(dayLabel(e.date, trip))}</div>`;
      last = e.date;
    }
    const k = e.category ? 'k-' + e.category : '';
    /* 몫이 따로 적힌 지출은 그렇다고 적어줍니다. 안 적으면 정산 숫자만 보고
       왜 나만 많이 나왔는지 알 수가 없습니다. */
    /* ⚠ **한 명이면 「나눠 냄」이 아닙니다(b752).** 기록만 남기고 정산에서
       빼려고 «나만» 켜 둔 지출인데 「1명이 나눠 냄」이라고 적혀 있었습니다 —
       나눈 적이 없는데 나눴다고 말하는 셈입니다. */
    const 몫 = e.expense_shares || [];
    const 몫말 = 몫.length === 1
      ? `${몫[0].user_id === ctx.me()?.id ? '나' : nameOf(몫[0].user_id)}만 쓴 것`
      : 몫.length ? `${몫.length}명이 나눠 냄` : null;
    /* 카드·현금(b753). 안 고른 옛 지출은 조용합니다. */
    const 낸법 = e.method === 'card' ? '카드' : e.method === 'cash' ? '현금' : null;
    const sub = [e.payer_id ? nameOf(e.payer_id) + ' 결제' : '결제자 없음',
                 낸법, 몫말, e.memo]
                .filter(Boolean).join(' · ');
    html += `<div class="plan">
      <span class="kdot ${esc(k)}"></span>
      <div class="body"><b>${esc(e.title)}</b>
        ${e.category ? `<span class="ktag ${esc(k)}">${esc(e.category)}</span>` : ''}
        ${sub ? `<span class="memo">${esc(sub)}</span>` : ''}</div>
      <div class="amt">
        <b>${esc(money(Number(e.amount), e.currency))}</b>
        ${e.currency !== trip.home_currency && e.amount_home != null
          ? `<div class="memo">${
              esc(money(Number(e.amount_home), trip.home_currency))}</div>` : ''}</div>
      ${trip.myRole === 'viewer' ? '' :
        `<button class="ghost" data-xact="edit" data-id="${esc(e.id)}"
                 style="align-self:start; padding:2px 6px">수정</button>
         <button class="ghost" aria-label="지우기" data-xact="del" data-id="${esc(e.id)}"
                 style="color:var(--bad); align-self:start; padding:2px 6px">×</button>`}</div>`;
  }
  $('expenses').innerHTML = html;
}

/* 정산 — 비어 있으면 전원 균등입니다 (문서의 expense_shares 규칙).
   나간 사람도 셈에 넣습니다. 빼면 그 사람이 낸 돈이 갈 곳이 없어집니다.
   집 통화 하나로 정산합니다 — 실제로 "너 나한테 12만원" 하고 보내지,
   유로 따로 프랑 따로 보내지 않습니다. */
/* settleMath 는 calc.js 로 옮겼습니다 (맨 위 import, 그대로 옮겼습니다 — 규칙과
   자투리 처리 설명은 거기 있습니다). b231 에서 __settleCheck 도 그리로 갔습니다 —
   셈과 그 검사가 다른 파일에 있으면 둘은 반드시 어긋납니다. */

function drawSettle(){
  const active = members.filter(m => !m.left_at);
  /* 애매한 것이 하나라도 섞이면 합이 안 맞습니다. 쓸 수 있는 것만 씁니다. */
  const rows    = expenses.filter(e => e.amount_home != null && e.payer_id);
  const noFx    = expenses.filter(e => e.amount_home == null).length;
  const noPayer = expenses.filter(e => e.amount_home != null && !e.payer_id).length;

  if (!rows.length || members.length < 2){
    setSettleOn(false); $('settlecard').classList.add('hide'); return;
  }
  setSettleOn(true);
  $('settlecard').classList.toggle('hide', tab !== 'exp');

  const cur = trip.home_currency;
  /* 화면이 찍는 자리와 같은 단위로 셈해야 숫자끼리 아귀가 맞습니다. */
  const { total, bal, moves } =
    settleMath(rows, active, NO_CENTS.includes(cur) ? 1 : 0.01);

  const skipped = [
    noFx    ? `환율을 못 구한 ${noFx}건` : '',
    noPayer ? `누가 냈는지 안 적은 ${noPayer}건` : '',
  ].filter(Boolean).join(' · ');

  /* .row 로 늘어놓았더니 이름·금액이 다 17px 이라 한 사람이 세 줄을 먹고,
     정작 중요한 "누가 누구에게 얼마"가 스크롤 아래로 밀렸습니다.
     대시보드와 같은 촘촘한 줄(.arow)을 씁니다 — 금액은 자릿수를 맞춰 훑히게. */
  $('settle').innerHTML =
    `<div class="stltop">
       <span class="v">${esc(money(total, cur))}</span>
       <span class="k">${active.length}명이 나눠요</span></div>

     <div class="agrp">누가 얼마</div>
     ${bal.slice().reverse().map(b => `<div class="arow">
        <span class="k"><b>${esc(nameOf(b.id))}</b>
          <span class="m">낸 돈 ${esc(money(b.paid, cur))} ·
               쓴 돈 ${esc(money(b.owed, cur))}</span></span>
        <span class="v" style="color:${b.v >= 0 ? 'var(--ok)' : 'var(--bad)'}">${
          b.v >= 0 ? '+' : '−'}${esc(money(Math.abs(b.v), cur))}</span>
      </div>`).join('')}

     <div class="agrp">이렇게 보내면 끝나요</div>
     ${moves.length
       ? moves.map(m => `<div class="arow stlmove">
            <span class="k"><b>${esc(nameOf(m.from))}</b>
              <span class="ar">→</span> <b>${esc(nameOf(m.to))}</b></span>
            <span class="v">${esc(money(m.v, cur))}</span></div>`).join('')
       : '<div class="empty" style="padding:10px 0">딱 맞아요. 주고받을 것이 없어요.</div>'}

     ${skipped ? `<div class="snote" style="color:var(--bad)">
          ${esc(skipped)}은 이 정산에 안 들어갔어요.</div>` : ''}`;
}

/* 환율이 비어 있는 지출을 그날 환율로 채웁니다.
   과거 날짜는 그날 값을, 아직 안 나온 날짜는 가장 최근 값을 씁니다. */
async function fillRates(){
  const btn = $('fxfill');
  btn.disabled = true; btn.innerHTML = '<span class="load">채우는 중…</span>';
  let ok = 0, fail_ = 0;
  for (const e of expenses.filter(x => x.amount_home == null)){
    const r = await rateOf(e.currency, trip.home_currency, e.date);
    if (r == null){ fail_++; continue; }
    const up = await sb.from('expenses')
      .update({ fx_rate: r, amount_home: Number(e.amount) * r })
      .eq('id', e.id).select('id');
    if (up.error || !up.data?.length) fail_++; else ok++;
  }
  await loadExpenses();
  /* 예전에는 실패하면 무조건 "유럽중앙은행이 안 내는 통화"라고 했습니다.
     실제로는 환율 서비스에 아예 연결이 안 되고 있었는데 그 안내를 보고
     통화 탓을 하게 됩니다. 무엇이 안 됐는지 갈라서 말합니다. */
  if (fail_) fail(fxLastFail === 'net'
    ? `${ok}건을 채웠어요. ${fail_}건은 환율 서비스에 연결하지 못했어요. ` +
      `잠시 뒤 다시 눌러보시고, 계속 안 되면 금액을 직접 적어주세요.`
    : `${ok}건을 채웠어요. ${fail_}건은 환율이 없어요 ` +
      `(유럽중앙은행이 안 내는 통화입니다).`, 'exp');
}

/* ── 지출 날짜의 기본값 ───────────────────────────────────────────────
 * ⚠ **오늘이 여행 밖이면 여행 첫날로 잡습니다 (b388).** 전에는 무조건
 *   `todayYmd()` 였습니다. 11월 여행을 8월에 짜면 지출이 8월 날짜로 들어가서
 *   일정과 연결이 안 되고("이 날은 일정이 없어요") 날짜별 집계도 틀어졌습니다.
 *   여행 중에는 오늘이 맞습니다 — 그때 쓰는 것이니까요. */
const 지출기본날 = () => {
  if (pickedDay) return pickedDay;
  const t = todayYmd();
  if (!trip?.start_date) return t;
  if (t < trip.start_date) return trip.start_date;
  if (t > trip.end_date)   return trip.end_date;
  return t;
};

/* ── 고치는 중인 지출 ─────────────────────────────────────────────────
 * ⚠ **지출에는 수정이 아예 없었습니다 (b388).** 줄에 삭제(×)만 있어서,
 *   금액이나 통화를 잘못 넣으면 지우고 처음부터 다시 넣어야 했습니다.
 *   바로 위 통화 덮어쓰기와 겹치면 특히 아팠습니다 — 틀리게 저장되는 길은
 *   있는데 고치는 길이 없었습니다. 일정에는 「수정」이 있는데 지출만 없어서
 *   같은 앱 안에서 규칙도 달랐습니다. */
let 고치는지출 = null;

/* 폼을 채우고 엽니다. `e` 가 있으면 고치기, 없으면 새로 넣기입니다. */
function openExpForm(e){
  고치는지출 = e || null;
  통화손댐 = !!e;          /* 고칠 때는 저장된 통화를 지키는 것이 맞습니다 */
  $('expcard').classList.remove('hide');
  /* 통화는 그날 있는 곳이 기본입니다. 구간마다 나라가 다르면 통화도 다릅니다.
     집 통화도 함께 둡니다 — 한국에서 미리 결제한 것들 때문입니다. */
  const curs = [...new Set([...legs.map(l => l.currency), trip.currency,
                            trip.home_currency, 'USD', 'EUR', e?.currency].filter(Boolean))];
  $('x_cur').innerHTML = curs.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $('x_payer').innerHTML = members.map(m =>
    `<option value="${esc(m.user_id)}">` +
    `${esc(nameOf(m.user_id))}${m.left_at ? ' (탈퇴함)' : ''}</option>`).join('') +
    `<option value="">공동 (결제자 없음)</option>`;

  $('x_title').value  = e?.title  || '';
  $('x_amount').value = e ? String(e.amount) : '';
  $('x_memo').value   = e?.memo   || '';
  $('x_date').value   = e?.date   || 지출기본날();
  $('x_cat').value    = e?.category || '';
  $('x_payer').value  = e?.payer_id ?? ctx.me().id;
  /* ⚠ 새로 넣을 때는 **아무것도 안 고른 채**로 둡니다. 「카드」를 미리
     켜 두면 현금으로 낸 것까지 카드로 적히고, 그건 안 적느니만 못합니다. */
  $('x_method').querySelectorAll('[data-method]').forEach(b =>
    b.classList.toggle('on', !!e?.method && b.dataset.method === e.method));
  drawExpPlans();
  $('x_plan').value = e?.plan_id || '';
  drawShareChips();
  syncExpCur();
  if (e) $('x_cur').value = e.currency;
  /* 제목과 단추가 다른 말을 하면 새로 만드는 줄 알고 취소합니다. */
  $('x_formtitle').textContent = e ? '지출 고치기' : '지출 추가';
  $('x_create').textContent    = e ? '고치기' : '넣기';
  $('expformerr').classList.add('hide');
  if (!e) $('x_title').focus();
  $('expcard').scrollIntoView({ block:'nearest', behavior:'smooth' });
}

$('addexpbtn').addEventListener('click', () => {
  /* 고치던 중에 「추가」를 누르면 새로 넣기로 돌아갑니다. */
  if (!$('expcard').classList.contains('hide') && !고치는지출){
    $('expcard').classList.add('hide'); return;
  }
  openExpForm(null);
});

/* ── 지출을 일정에 붙이기 ───────────────────────────────────────────
 * `expenses.plan_id` 는 **처음부터 표에 있었는데 채울 길이 없었습니다**
 * (001_schema 439줄). expense_shares 와 같은 경우입니다.
 *
 * 붙여두면 일정 줄에서 그날 그 자리에 얼마 썼는지가 바로 보입니다 —
 * 지출 탭으로 건너가 제목을 눈으로 짝지을 일이 없어집니다.
 *
 * **고른 날의 일정만 내놓습니다.** 11일치를 다 늘어놓으면 고를 수가 없고,
 * 다른 날 일정에 붙으면 그 줄의 합계가 엉뚱해집니다.
 * 날짜를 바꾸면 목록도 따라 바뀝니다 — 안 그러면 8/14 일정을 고른 채로
 * 날짜만 8/16 으로 바꿔 저장하는 일이 생깁니다. */
function drawExpPlans(){
  const d = $('x_date').value;
  const list = (plans || []).filter(p => p.date === d);
  const keep = $('x_plan').value;
  $('x_plan').innerHTML = '<option value="">안 고름</option>' +
    list.map(p => `<option value="${esc(p.id)}">${
      p.start_time ? esc(hm(p.start_time)) + ' · ' : ''}${esc(p.title)}</option>`).join('');
  /* 날짜가 그대로면 고른 것을 지키고, 바뀌었으면 저절로 '안 고름'이 됩니다. */
  if (keep && list.some(p => p.id === keep)) $('x_plan').value = keep;
  const none = !list.length;
  $('x_plan').disabled = none;
  $('x_plan').previousElementSibling.textContent =
    none ? '어디서 (이 날은 일정이 없어요)' : '어디서 (선택)';
}
$('x_date').addEventListener('change', drawExpPlans);

/* ── 누가 나눠 내나 ─────────────────────────────────────────────────
 * expense_shares 표는 처음부터 있었는데 채울 길이 없었습니다. 여기가 그 길입니다.
 * 처음에는 전원이 켜져 있습니다 — 대부분은 손댈 일이 없고, 손대지 않으면
 * 아무 줄도 안 만들어 균등으로 둡니다. 있는 그대로가 기본값입니다.
 * 혼자 가는 여행에서는 아예 안 보여줍니다. */
function drawShareChips(){
  const active = members.filter(m => !m.left_at);
  $('x_sharebox').classList.toggle('hide', active.length < 2);
  /* ⚠⚠ **고칠 때는 «저장된 몫»을 켭니다(b717, b698 점검 일곱째).** ⚠⚠
   *   여태 무엇을 하든 **전원을 켜서** 그렸습니다. 그래서 「나랑 지훈만」
   *   으로 넣어둔 지출을 고치려고 열면 넷이 다 켜져 있었습니다 — 화면이
   *   「전원 균등」이라고 말하는데 자료는 둘이었습니다. 정산 숫자를 보고
   *   따질 때 제일 헷갈리는 종류의 거짓말입니다.
   * ⚠ 줄이 하나도 없으면 그것이 곧 균등이라 전원을 켜는 것이 «맞습니다».
   * ⚠ 이미 나간 일행의 몫은 여기 안 나옵니다(칩은 남은 사람만 그립니다).
   *   고쳐서 저장하면 그 줄은 빠집니다 — 나간 사람을 계속 끼워 두려면
   *   칩을 남은 사람 기준으로 그리는 위 줄부터 바꿔야 합니다. */
  const 적힌 = (고치는지출?.expense_shares || []).map(s => s.user_id);
  const 켤것 = 적힌.length ? new Set(적힌) : null;
  $('x_shares').innerHTML = active.map(m =>
    `<button class="day${!켤것 || 켤것.has(m.user_id) ? ' on' : ''}"` +
    ` data-share="${esc(m.user_id)}">${esc(nameOf(m.user_id))}</button>`
  ).join('');
  나만단추();
}
/* ⚠ 둘 중 하나입니다. 다시 누르면 꺼집니다 — 잘못 눌렀을 때 되돌릴 길이
   없으면 안 됩니다(안 고른 것도 답입니다). */
$('x_method')?.addEventListener('click', e => {
  const b = e.target.closest('[data-method]'); if (!b) return;
  const 켜짐 = b.classList.contains('on');
  $('x_method').querySelectorAll('[data-method]').forEach(x => x.classList.remove('on'));
  if (!켜짐) b.classList.add('on');
});

$('x_shares').addEventListener('click', e => {
  const b = e.target.closest('[data-share]'); if (!b) return;
  b.classList.toggle('on');
  /* 아무도 없으면 나눌 수가 없습니다. 마지막 하나는 못 끄게 합니다. */
  if (!$('x_shares').querySelector('.on')){
    b.classList.add('on');
    toast('적어도 한 명은 있어야 해요.');
  }
  나만단추();
});

/* ── 「나만」 한 번 누르기 (b752, 사용자 요청) ────────────────────────
 * 「지출 등록은 했는데 나만 쓴거라 기록용으로 두고 더치페이에는 포함 안
 * 하는」 경우입니다. **셈은 이미 그렇게 돕니다** — 몫이 나 하나면 낸 돈과
 * 쓴 돈이 같아져 내 잔액에 0 을 더하고 남의 숫자는 안 변합니다
 * (calc.js 의 settleMath). 없던 것은 «한 번에 하는 길»뿐이었습니다.
 * ⚠ 여행 총액에는 그대로 잡힙니다. 여행에서 쓴 돈인 것은 맞습니다.
 * ⚠ 눌러서 되돌릴 수 있어야 합니다 — 나만 켜져 있으면 「전원」으로 바뀝니다. */
function 나만뿐인가(){
  const 칩 = [...$('x_shares').querySelectorAll('[data-share]')];
  const 켠것 = 칩.filter(b => b.classList.contains('on'));
  return 켠것.length === 1 && 켠것[0].dataset.share === ctx.me()?.id;
}
/* 체크 줄은 «지금 나만인가»를 그대로 비춥니다 — 칩을 손으로 껐다 켰다
   해도 늘 맞습니다. 글자는 안 바꿉니다(그게 b752 의 잘못이었습니다). */
function 나만단추(){
  $('x_onlyme')?.classList.toggle('on', 나만뿐인가());
}
$('x_onlyme')?.addEventListener('click', () => {
  const 나 = ctx.me()?.id;
  const 칩 = [...$('x_shares').querySelectorAll('[data-share]')];
  /* 일행 목록에 내가 없으면(있을 수 없지만) 아무도 안 켜지는 일을 막습니다. */
  if (!칩.some(b => b.dataset.share === 나))
    return toast('내 몫을 찾지 못했어요.');
  const 되돌리기 = 나만뿐인가();
  칩.forEach(b => b.classList.toggle('on', 되돌리기 || b.dataset.share === 나));
  나만단추();
});
const pickedShares = () =>
  [...$('x_shares').querySelectorAll('[data-share].on')].map(b => b.dataset.share);
/* ── 날짜를 바꾸면 그날 있는 곳의 통화로 맞춥니다 ─────────────────────
 * ⚠ **사람이 통화를 손댔으면 건드리지 않습니다 (b388).** 전에는 무조건
 *   덮어썼습니다. 그런데 폼에서 **통화 칸이 날짜 칸보다 위에 있어서**,
 *   위에서 아래로 자연스럽게 채우면 통화를 고른 뒤에 날짜를 정하게 됩니다 —
 *   즉 **고른 통화가 늘 지워졌습니다.**
 *   실사용 점검에서 ₩10,000 이 ¥10,000(₩87,467)으로 저장됐고,
 *   42만원짜리 숙소가 367만원으로 기록됐습니다. 화면에는 아무 표시도 없었습니다.
 *   한국에서 미리 결제한 숙소·항공권을 원화로 적는 것은 아주 흔한 일입니다.
 *
 * 자동으로 맞추는 것 자체는 남깁니다 — 구간마다 통화가 다른 여행에서
 * 매번 고르게 하면 그게 더 번거롭습니다. **손댄 적이 없을 때만** 맞춥니다. */
let 통화손댐 = false;
$('x_cur').addEventListener('change', () => { 통화손댐 = true; });
function syncExpCur(){
  if (통화손댐) return;
  const l = legNear(legs, $('x_date').value);
  if (l) $('x_cur').value = l.currency;
}
$('x_date').addEventListener('change', syncExpCur);
$('x_cancel').addEventListener('click', () => {
  $('expcard').classList.add('hide'); $('expformerr').classList.add('hide');
  /* 되돌려 두지 않으면 다음에 「추가」를 눌렀을 때 고치기 상태가 남습니다. */
  고치는지출 = null; 통화손댐 = false;
  $('x_formtitle').textContent = '지출 추가';
  $('x_create').textContent = '넣기';
});

$('x_create').addEventListener('click', async () => {
  const btn = $('x_create');
  $('expformerr').classList.add('hide');
  const title = $('x_title').value.trim();
  /* 12,000 처럼 쉼표를 넣는 사람이 많습니다. 그대로 받으면 NaN 이 됩니다. */
  const amount = Number($('x_amount').value.replace(/[,\s]/g, ''));
  const date = $('x_date').value;

  if (!title)                    return fail('무엇에 썼는지 적어주세요.', 'expform');
  if (!isFinite(amount) || amount <= 0)
                                 return fail('금액을 숫자로 적어주세요.', 'expform');
  if (!date)                     return fail('날짜를 골라주세요.', 'expform');

  btn.disabled = true; btn.innerHTML = '<span class="load">넣는 중…</span>';
  /* 쓴 날 환율을 여기서 못박습니다. 나중에 볼 때마다 새로 받아오면
     사람마다 정산 금액이 달라집니다. */
  const cur = $('x_cur').value;
  const rate = await rateOf(cur, trip.home_currency, date);

  const row = {
    title, amount, date, currency: cur,
    fx_rate: rate, amount_home: rate == null ? null : amount * rate,
    category: $('x_cat').value || null,
    plan_id: $('x_plan').value || null,
    payer_id: $('x_payer').value || null,
    method: $('x_method').querySelector('[data-method].on')?.dataset.method || null,
    memo: $('x_memo').value.trim() || null
  };
  /* 고치는 중이면 같은 줄을 덮어씁니다. 지웠다 다시 넣으면 몫(share)과
     붙여둔 일정이 끊기고, 정산 기록에 구멍이 납니다. */
  const r = 고치는지출
    ? await write({ table:'expenses', action:'update', id: 고치는지출.id, row })
    : await write({ table:'expenses', action:'insert', row: { trip_id: trip.id, ...row } });
  const 고치던중 = !!고치는지출, 고친id = 고치는지출?.id;
  btn.disabled = false; btn.textContent = 고치던중 ? '고치기' : '넣기';

  if (!r.ok) return fail(r.why, 'expform');

  /* 몫을 손대지 않았으면(전원 켜짐) 아무 줄도 안 만듭니다 — 그게 곧 균등입니다.
     줄을 만들어 두면 나중에 일행이 늘었을 때 그 사람이 빠집니다. */
  const active = members.filter(m => !m.left_at);
  const picked = $('x_sharebox').classList.contains('hide') ? [] : pickedShares();
  const partial = picked.length && picked.length < active.length;

  $('x_title').value = ''; $('x_amount').value = ''; $('x_memo').value = '';
  $('expcard').classList.add('hide');
  고치는지출 = null; 통화손댐 = false;

  /* ⚠⚠ **고칠 때도 몫을 씁니다(b717).** ⚠⚠
     전에는 「고친 김에 몫까지 쓰면 이미 있던 줄과 겹친다」며 손대지
     않았습니다. 그런데 화면에는 칩이 «눌리는 채로» 있었으니, 껐다 켠 것이
     조용히 버려졌습니다 — 위 `drawShareChips` 를 고쳐 저장된 몫을 보여주게
     된 이상, 보이는 대로 저장되어야 합니다.
     ⚠ 겹침은 **먼저 지워서** 막습니다(덧붙이지 않습니다). 화면에 있는
       것이 곧 그 지출의 몫입니다.
     ⚠ 전원이 켜져 있으면 줄을 «안» 만듭니다 — 그게 균등이고, 줄을 남겨
       두면 나중에 일행이 늘었을 때 그 사람이 빠집니다(아래 새로 넣기와 같은 규칙).
     ⚠ 큐에 쌓였으면(연결 없음) 몫은 못 씁니다 — 그 줄은 서버에 바로
       써야 하는데 지금 못 갑니다. 그때는 말해 줍니다. */
  if (고치던중){
    if (r.queued){
      await loadExpenses();
      return toast('연결이 없어 들고 있어요. 나눠 낼 사람은 연결된 뒤 다시 봐주세요.');
    }
    const del = await sb.from('expense_shares').delete().eq('expense_id', 고친id);
    if (del.error) fail(del.error, 'exp');
    else if (partial){
      const sh = await sb.from('expense_shares')
        .insert(picked.map(uid => ({ expense_id: 고친id, user_id: uid, weight: 1 })));
      if (sh.error) fail(sh.error, 'exp');
    }
    await loadExpenses();
    return toast('고쳤어요');
  }

  if (r.queued){
    /* 큐에 쌓인 지출은 아직 id 가 없어서 몫을 붙일 수가 없습니다.
       조용히 균등으로 두면 나중에 정산이 틀립니다. 그래서 말합니다. */
    return toast(partial
      ? '연결이 없어 들고 있어요. 나눠 낼 사람은 연결된 뒤 다시 지정해주세요.'
      : '연결이 없어 들고 있어요. 터지면 바로 보냅니다.');
  }
  if (partial && r.id){
    const sh = await sb.from('expense_shares')
      .insert(picked.map(uid => ({ expense_id: r.id, user_id: uid, weight: 1 })))
      .select('user_id');
    if (sh.error) fail(sh.error, 'exp');
  }
  await loadExpenses();
});

$('expenses').addEventListener('click', async e => {
  const b = e.target.closest('button[data-xact]'); if (!b) return;
  /* 수정은 확인이 필요 없습니다 — 폼을 열 뿐이고 아직 아무것도 안 바뀝니다. */
  if (b.dataset.xact === 'edit'){
    const row = expenses.find(x => x.id === b.dataset.id);
    if (row) openExpForm(row);
    return;
  }
  if (b.dataset.armed !== '1'){
    arm(b, '정말 지울까요?'); return;
  }
  b.disabled = true;
  const r = await write({ table:'expenses', action:'delete', id: b.dataset.id });
  b.disabled = false;
  if (!r.ok) return fail(r.why, 'exp');
  if (r.queued){ b.closest('.plan, .ev')?.remove(); return toast('연결이 없어 들고 있어요.'); }
  await loadExpenses();
});

